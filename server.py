import os
import sys
import json
import shutil
import subprocess
import threading
import tempfile
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory

# 处理 PyInstaller 打包后的路径
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')

# 工作目录 - 默认使用用户主目录下的 Codexa 工作区
WORKSPACE = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'Codexa', 'workspace')
os.makedirs(WORKSPACE, exist_ok=True)

# 日志存储
LOGS_FILE = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'Codexa', 'logs.json')

# 语言配置：扩展名 -> (语言名, 运行命令模板, 检查命令)
LANGUAGE_MAP = {
    '.py': ('Python', 'python "{file}"', 'python --version'),
    '.js': ('JavaScript', 'node "{file}"', 'node --version'),
    '.mjs': ('JavaScript', 'node "{file}"', 'node --version'),
    '.cjs': ('JavaScript', 'node "{file}"', 'node --version'),
    '.html': ('HTML', '', ''),
    '.htm': ('HTML', '', ''),
    '.css': ('CSS', '', ''),
    '.json': ('JSON', '', ''),
    '.java': ('Java', None, 'javac -version'),
    '.c': ('C', None, 'gcc --version'),
    '.cpp': ('C++', None, 'g++ --version'),
    '.cc': ('C++', None, 'g++ --version'),
    '.cs': ('C#', 'dotnet run --project "{dir}"', 'dotnet --version'),
    '.go': ('Go', 'go run "{file}"', 'go version'),
    '.rs': ('Rust', None, 'cargo --version'),
    '.rb': ('Ruby', 'ruby "{file}"', 'ruby --version'),
    '.php': ('PHP', 'php "{file}"', 'php --version'),
    '.sh': ('Shell', 'bash "{file}"', 'bash --version'),
    '.bat': ('Batch', 'cmd /c "{file}"', ''),
    '.cmd': ('Batch', 'cmd /c "{file}"', ''),
    '.ps1': ('PowerShell', 'powershell -ExecutionPolicy Bypass -File "{file}"', 'powershell --version'),
    '.ts': ('TypeScript', None, 'tsc --version'),
    '.lua': ('Lua', 'lua "{file}"', 'lua -v'),
    '.r': ('R', 'Rscript "{file}"', 'Rscript --version'),
    '.kt': ('Kotlin', None, 'kotlin -version'),
    '.swift': ('Swift', 'swift "{file}"', 'swift --version'),
    '.md': ('Markdown', '', ''),
    '.txt': ('Text', '', ''),
    '.xml': ('XML', '', ''),
    '.yaml': ('YAML', '', ''),
    '.yml': ('YAML', '', ''),
    '.toml': ('TOML', '', ''),
    '.ini': ('INI', '', ''),
    '.conf': ('Config', '', ''),
    '.sql': ('SQL', '', ''),
    '.vue': ('Vue', '', ''),
    '.jsx': ('JSX', '', ''),
    '.tsx': ('TSX', '', ''),
}


def load_logs():
    if os.path.exists(LOGS_FILE):
        try:
            with open(LOGS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []
    return []


def save_log(logs):
    try:
        with open(LOGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(logs, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def add_log(level, message, extra=None):
    logs = load_logs()
    entry = {
        'id': len(logs),
        'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'date': datetime.now().strftime('%Y-%m-%d'),
        'level': level,
        'message': message,
        'extra': extra or {}
    }
    logs.append(entry)
    # 最多保留 1000 条
    if len(logs) > 1000:
        logs = logs[-1000:]
    save_log(logs)
    return entry


def check_language_installed(ext):
    if ext not in LANGUAGE_MAP:
        return False, '未知语言'
    name, run_cmd, check_cmd = LANGUAGE_MAP[ext]
    if not check_cmd:
        # 不需要运行的语言（如 HTML/CSS/JSON）视为已安装
        return True, name
    try:
        result = subprocess.run(
            check_cmd, capture_output=True, text=True, timeout=10, shell=True
        )
        if result.returncode == 0:
            version = (result.stdout or result.stderr).strip().split('\n')[0]
            return True, f'{name} ({version})'
        else:
            return False, f'{name} 未安装'
    except Exception:
        return False, f'{name} 未安装'


def build_tree(path, base_path=None):
    if base_path is None:
        base_path = path
    name = os.path.basename(path)
    try:
        is_dir = os.path.isdir(path)
    except Exception:
        is_dir = False
    node = {
        'name': name,
        'path': os.path.relpath(path, base_path).replace('\\', '/') if path != base_path else '',
        'type': 'folder' if is_dir else 'file',
    }
    if is_dir:
        node['children'] = []
        try:
            entries = sorted(os.listdir(path), key=lambda x: (not os.path.isdir(os.path.join(path, x)), x.lower()))
            for entry in entries:
                if entry.startswith('.') and entry != '.codexa_logs.json':
                    continue
                child_path = os.path.join(path, entry)
                node['children'].append(build_tree(child_path, base_path))
        except PermissionError:
            pass
    return node


@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/api/files', methods=['GET'])
def api_files():
    tree = build_tree(WORKSPACE)
    return jsonify({'workspace': WORKSPACE, 'tree': tree})


@app.route('/api/file', methods=['GET'])
def api_file_read():
    rel_path = request.args.get('path', '')
    full_path = os.path.join(WORKSPACE, rel_path)
    if not os.path.isfile(full_path):
        return jsonify({'error': '文件不存在'}), 404
    try:
        with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        return jsonify({'path': rel_path, 'content': content})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/file', methods=['POST'])
def api_file_write():
    data = request.get_json()
    rel_path = data.get('path', '')
    content = data.get('content', '')
    full_path = os.path.join(WORKSPACE, rel_path)
    try:
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        add_log('info', f'已保存文件: {rel_path}')
        return jsonify({'success': True, 'path': rel_path})
    except Exception as e:
        add_log('error', f'保存文件失败: {rel_path}', {'error': str(e)})
        return jsonify({'error': str(e)}), 500


@app.route('/api/file/new', methods=['POST'])
def api_file_new():
    data = request.get_json()
    rel_path = data.get('path', '')
    full_path = os.path.join(WORKSPACE, rel_path)
    if os.path.exists(full_path):
        return jsonify({'error': '文件已存在'}), 409
    try:
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write('')
        add_log('info', f'新建文件: {rel_path}')
        return jsonify({'success': True, 'path': rel_path})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/folder/new', methods=['POST'])
def api_folder_new():
    data = request.get_json()
    rel_path = data.get('path', '')
    full_path = os.path.join(WORKSPACE, rel_path)
    if os.path.exists(full_path):
        return jsonify({'error': '文件夹已存在'}), 409
    try:
        os.makedirs(full_path, exist_ok=True)
        add_log('info', f'新建文件夹: {rel_path}')
        return jsonify({'success': True, 'path': rel_path})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/file/delete', methods=['POST'])
def api_file_delete():
    data = request.get_json()
    rel_path = data.get('path', '')
    full_path = os.path.join(WORKSPACE, rel_path)
    if not os.path.exists(full_path):
        return jsonify({'error': '不存在'}), 404
    try:
        if os.path.isdir(full_path):
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)
        add_log('info', f'已删除: {rel_path}')
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/file/move', methods=['POST'])
def api_file_move():
    data = request.get_json()
    source = data.get('source', '')
    target_dir = data.get('targetDir', '')
    src_full = os.path.join(WORKSPACE, source)
    tgt_full = os.path.join(WORKSPACE, target_dir, os.path.basename(source))
    if not os.path.exists(src_full):
        return jsonify({'error': '源文件不存在'}), 404
    if src_full == tgt_full or src_full == os.path.join(WORKSPACE, target_dir):
        return jsonify({'error': '源和目标相同'}), 400
    # 防止将文件夹移入自身子目录
    if os.path.isdir(src_full) and os.path.abspath(tgt_full).startswith(os.path.abspath(src_full) + os.sep):
        return jsonify({'error': '不能将文件夹移入自身子目录'}), 400
    try:
        os.makedirs(os.path.dirname(tgt_full), exist_ok=True)
        shutil.move(src_full, tgt_full)
        add_log('info', f'移动: {source} -> {target_dir}/{os.path.basename(source)}')
        return jsonify({'success': True, 'path': os.path.join(target_dir, os.path.basename(source)).replace('\\', '/')})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/file/saveas', methods=['POST'])
def api_file_saveas():
    data = request.get_json()
    source = data.get('source', '')
    target = data.get('target', '')
    content = data.get('content', '')
    src_full = os.path.join(WORKSPACE, source)
    tgt_full = os.path.join(WORKSPACE, target)
    try:
        os.makedirs(os.path.dirname(tgt_full), exist_ok=True)
        if content is not None:
            with open(tgt_full, 'w', encoding='utf-8') as f:
                f.write(content)
        elif os.path.isfile(src_full):
            shutil.copy2(src_full, tgt_full)
        add_log('info', f'另存为: {source} -> {target}')
        return jsonify({'success': True, 'path': target})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/import', methods=['POST'])
def api_import():
    data = request.get_json()
    source = data.get('source', '')
    target_name = data.get('name', os.path.basename(source))
    if not os.path.isfile(source):
        return jsonify({'error': '源文件不存在'}), 404
    tgt_full = os.path.join(WORKSPACE, target_name)
    # 避免重名
    base, ext = os.path.splitext(tgt_full)
    counter = 1
    while os.path.exists(tgt_full):
        tgt_full = f'{base}_{counter}{ext}'
        counter += 1
    try:
        shutil.copy2(source, tgt_full)
        rel = os.path.relpath(tgt_full, WORKSPACE).replace('\\', '/')
        add_log('info', f'导入文件: {rel}')
        return jsonify({'success': True, 'path': rel})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/languages', methods=['GET'])
def api_languages():
    ext = request.args.get('ext', '')
    if ext and not ext.startswith('.'):
        ext = '.' + ext
    if ext:
        installed, info = check_language_installed(ext)
        return jsonify({'ext': ext, 'installed': installed, 'info': info})
    # 返回所有语言及其安装状态
    results = {}
    for e in LANGUAGE_MAP:
        installed, info = check_language_installed(e)
        results[e] = {'installed': installed, 'info': info}
    return jsonify(results)


@app.route('/api/run', methods=['POST'])
def api_run():
    data = request.get_json()
    rel_path = data.get('path', '')
    full_path = os.path.join(WORKSPACE, rel_path)
    if not os.path.isfile(full_path):
        return jsonify({'error': '文件不存在'}), 404

    ext = os.path.splitext(rel_path)[1].lower()
    if ext not in LANGUAGE_MAP:
        add_log('error', f'不支持的语言: {ext}', {'file': rel_path})
        return jsonify({'error': f'不支持的文件类型: {ext}'}), 400

    name, run_cmd, check_cmd = LANGUAGE_MAP[ext]

    # 检查语言是否安装
    if check_cmd:
        installed, info = check_language_installed(ext)
        if not installed:
            add_log('error', f'语言未安装: {name}', {'file': rel_path})
            return jsonify({'error': f'{name} 未安装，请先安装后再运行', 'not_installed': True}), 400

    if not run_cmd:
        # 不可直接运行的文件（HTML/CSS/JSON等）
        add_log('info', f'{name} 文件无需运行: {rel_path}')
        return jsonify({'output': f'{name} 文件不支持直接运行。', 'exit_code': 0})

    # 运行代码
    output = ''
    exit_code = 0
    try:
        cmd = run_cmd.format(file=full_path, dir=os.path.dirname(full_path))
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=30,
            cwd=os.path.dirname(full_path), shell=True
        )
        output = result.stdout
        if result.stderr:
            output += ('\n' if output else '') + result.stderr
        exit_code = result.returncode
        add_log('success' if exit_code == 0 else 'error',
                f'运行 {rel_path} (退出码: {exit_code})',
                {'output': output[:500]})
    except subprocess.TimeoutExpired:
        output = '运行超时（30秒）'
        exit_code = -1
        add_log('error', f'运行超时: {rel_path}')
    except Exception as e:
        output = f'运行错误: {str(e)}'
        exit_code = -1
        add_log('error', f'运行异常: {rel_path}', {'error': str(e)})

    return jsonify({'output': output, 'exit_code': exit_code, 'language': name})


@app.route('/api/logs', methods=['GET'])
def api_logs():
    level = request.args.get('level', '')
    date = request.args.get('date', '')
    search = request.args.get('search', '')
    logs = load_logs()
    if level:
        logs = [l for l in logs if l['level'] == level]
    if date:
        logs = [l for l in logs if l['date'] == date]
    if search:
        logs = [l for l in logs if search.lower() in l['message'].lower()]
    return jsonify(logs)


@app.route('/api/logs/clear', methods=['POST'])
def api_logs_clear():
    save_log([])
    return jsonify({'success': True})


@app.route('/api/workspace', methods=['GET'])
def api_workspace():
    return jsonify({'path': WORKSPACE})


# ========== AI 本地 Ollama ==========
OLLAMA_URL = 'http://localhost:11434/api/chat'
KNOWLEDGE_BASE_DIR = r'D:\下载\下载结果'

# 两个本地模型
AI_MODELS = {
    'deepseek-r1:8b': 'DeepSeek R1 (8B 精确)',
    'deepseek-r1:1.5b': 'DeepSeek R1 (1.5B 快速)',
}

def load_knowledge_base():
    """加载知识库文件内容"""
    if not os.path.exists(KNOWLEDGE_BASE_DIR):
        return ''
    result = []
    try:
        for name in os.listdir(KNOWLEDGE_BASE_DIR):
            fpath = os.path.join(KNOWLEDGE_BASE_DIR, name)
            if os.path.isfile(fpath):
                ext = os.path.splitext(name)[1].lower()
                if ext in ('.txt', '.md', '.json', '.csv', '.log', '.py', '.js', '.ts', '.html', '.css', '.xml', '.yaml', '.yml', '.ini', '.conf'):
                    try:
                        with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                            content = f.read(8000)
                            result.append(f'--- {name} ---\n{content}\n')
                    except:
                        pass
            elif os.path.isdir(fpath):
                for sub in os.listdir(fpath)[:20]:
                    subpath = os.path.join(fpath, sub)
                    if os.path.isfile(subpath):
                        ext = os.path.splitext(sub)[1].lower()
                        if ext in ('.txt', '.md', '.json', '.csv', '.log'):
                            try:
                                with open(subpath, 'r', encoding='utf-8', errors='replace') as f:
                                    content = f.read(4000)
                                    result.append(f'--- {name}/{sub} ---\n{content}\n')
                            except:
                                pass
    except:
        pass
    return '\n'.join(result[:30])


@app.route('/api/ai/config', methods=['GET'])
def api_ai_config():
    return jsonify({'models': AI_MODELS, 'kb_path': KNOWLEDGE_BASE_DIR})


@app.route('/api/ai/chat', methods=['POST'])
def api_ai_chat():
    import urllib.request
    import urllib.error
    data = request.get_json()
    model = data.get('model', 'deepseek-r1:8b')
    message = data.get('message', '')
    history = data.get('history', [])

    # 构建系统提示 + 知识库
    kb = load_knowledge_base()
    system_prompt = '你是 Codexa AI 助手，帮助用户编写和调试代码。请用中文回答。'
    if kb:
        system_prompt += f'\n\n以下是知识库内容，供参考：\n{kb[:12000]}'

    ollama_messages = [{'role': 'system', 'content': system_prompt}]
    for h in history:
        ollama_messages.append(h)
    ollama_messages.append({'role': 'user', 'content': message})

    body = json.dumps({
        'model': model,
        'messages': ollama_messages,
        'stream': False,
        'options': {'temperature': 0.7, 'num_ctx': 8192}
    }).encode()

    try:
        req = urllib.request.Request(OLLAMA_URL, data=body, headers={'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode())
        reply = result.get('message', {}).get('content', '')
        return jsonify({'reply': reply})
    except urllib.error.URLError:
        return jsonify({'error': 'Ollama 未运行，请先启动 Ollama 服务'}), 500
    except Exception as e:
        return jsonify({'error': f'请求失败: {str(e)}'}), 500



def run_server(port=0):
    if port == 0:
        # 找一个可用端口
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('127.0.0.1', 0))
            port = s.getsockname()[1]
    app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5050
    app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False)
