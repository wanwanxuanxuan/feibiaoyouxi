import os
import sys
import threading
import time
import webview
from server import app, WORKSPACE


def get_free_port():
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def start_flask(port):
    app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False)


class Api:
    def __init__(self):
        self.window = None

    def set_window(self, window):
        self.window = window

    def minimize(self):
        if self.window:
            self.window.minimize()

    def toggle_fullscreen(self):
        if self.window:
            if self.window.fullscreen:
                self.window.fullscreen = False
            else:
                self.window.fullscreen = True

    def close(self):
        if self.window:
            self.window.destroy()

    def get_workspace(self):
        return WORKSPACE


def main():
    port = get_free_port()

    # 在后台线程启动 Flask
    flask_thread = threading.Thread(target=start_flask, args=(port,), daemon=True)
    flask_thread.start()

    # 等待服务器启动
    time.sleep(1.5)

    api = Api()

    # 创建窗口（使用 Windows 原生标题栏）
    window = webview.create_window(
        'Codexa',
        f'http://127.0.0.1:{port}/',
        width=1280,
        height=800,
        min_size=(900, 600),
        js_api=api,
    )
    api.set_window(window)

    webview.start(debug=False)


if __name__ == '__main__':
    main()
