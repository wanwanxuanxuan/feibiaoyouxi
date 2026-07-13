const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: ['http://localhost:9001', 'http://127.0.0.1:9001', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8000', 'http://127.0.0.1:8000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

const verifyCodes = {};

let transporter = null;
let fromEmail = '';
let etherealInfo = null;

// ==================== 微信支付配置 ====================
const WECHAT_PAY_CONFIG = {
    appid: process.env.WECHAT_APPID || '',
    mchid: process.env.WECHAT_MCHID || '',
    privateKeyPath: process.env.WECHAT_PRIVATE_KEY_PATH || '',
    merchantSerialNo: process.env.WECHAT_MCH_SERIAL_NO || '',
    apiV3Key: process.env.WECHAT_API_V3_KEY || '',
    notifyUrl: process.env.WECHAT_NOTIFY_URL || '',
    enabled: false
};

let merchantPrivateKey = null;
let platformCertificates = {};

function initWechatPay() {
    if (!WECHAT_PAY_CONFIG.appid || !WECHAT_PAY_CONFIG.mchid || !WECHAT_PAY_CONFIG.privateKeyPath || !WECHAT_PAY_CONFIG.merchantSerialNo || !WECHAT_PAY_CONFIG.apiV3Key) {
        console.log('⚠️  微信支付未配置，使用模拟模式');
        WECHAT_PAY_CONFIG.enabled = false;
        return;
    }

    try {
        if (fs.existsSync(WECHAT_PAY_CONFIG.privateKeyPath)) {
            merchantPrivateKey = fs.readFileSync(WECHAT_PAY_CONFIG.privateKeyPath, 'utf8');
            WECHAT_PAY_CONFIG.enabled = true;
            console.log('✅ 微信支付初始化成功');
            console.log('   商户号:', WECHAT_PAY_CONFIG.mchid);
            console.log('   AppID:', WECHAT_PAY_CONFIG.appid);
        } else {
            console.log('⚠️  商户私钥文件不存在，使用模拟模式:', WECHAT_PAY_CONFIG.privateKeyPath);
            WECHAT_PAY_CONFIG.enabled = false;
        }
    } catch (e) {
        console.error('微信支付初始化失败:', e.message);
        WECHAT_PAY_CONFIG.enabled = false;
    }
}

function rsaSign(message) {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(message);
    return sign.sign(merchantPrivateKey, 'base64');
}

function buildAuthorization(method, urlPath, body) {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonceStr = crypto.randomBytes(16).toString('hex');
    const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`;
    const signature = rsaSign(message);
    return `WECHATPAY2-SHA256-RSA2048 mchid="${WECHAT_PAY_CONFIG.mchid}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${WECHAT_PAY_CONFIG.merchantSerialNo}"`;
}

function wechatPayRequest(method, urlPath, body = '') {
    return new Promise((resolve, reject) => {
        const url = new URL('https://api.mch.weixin.qq.com' + urlPath);
        const authHeader = buildAuthorization(method, urlPath, body);

        const options = {
            hostname: url.hostname,
            port: 443,
            path: urlPath,
            method: method,
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve({ status: res.statusCode, data: result, headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data, headers: res.headers });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

function aesGcmDecrypt(nonce, ciphertext, associatedData) {
    const key = Buffer.from(WECHAT_PAY_CONFIG.apiV3Key, 'utf8');
    const iv = Buffer.from(nonce, 'utf8');
    const authTag = Buffer.from(ciphertext.slice(-24), 'base64');
 const encrypted = Buffer.from(ciphertext.slice(0, -24), 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(associatedData, 'utf8'));

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
}

// ==================== 卡密系统 ====================
const CARDS_FILE = path.join(__dirname, 'cards.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'xuan20140114';

let cards = {};

function loadCards() {
    try {
        if (fs.existsSync(CARDS_FILE)) {
            cards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('加载卡密失败:', e.message);
        cards = {};
    }
}

function saveCards() {
    try {
        fs.writeFileSync(CARDS_FILE, JSON.stringify(cards, null, 2), 'utf8');
    } catch (e) {
        console.error('保存卡密失败:', e.message);
    }
}

function generateCardCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    function genSegment(len) {
        let s = '';
        for (let i = 0; i < len; i++) {
            s += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return s;
    }
    return `${genSegment(5)}-${genSegment(5)}-${genSegment(5)}-${genSegment(5)}-${genSegment(5)}`;
}

loadCards();

app.post('/api/card/redeem', (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.json({ success: false, message: '请输入卡密' });
    }

    const normalizedCode = code.toUpperCase().trim();
    const card = cards[normalizedCode];

    if (!card) {
        return res.json({ success: false, message: '卡密无效' });
    }

    if (card.used) {
        return res.json({ success: false, message: '该卡密已被使用' });
    }

    card.used = true;
    card.usedAt = Date.now();
    card.usedBy = req.body.playerId || 'guest';
    saveCards();

    res.json({
        success: true,
        message: '兑换成功！',
        rewards: {
            money: 100000,
            skin: 'appreciator'
        }
    });
});

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;

    if (password === ADMIN_PASSWORD) {
        res.json({ success: true, message: '登录成功' });
    } else {
        res.json({ success: false, message: '密码错误' });
    }
});

app.post('/api/admin/cards/generate', (req, res) => {
    const { password, count = 1 } = req.body;

    if (password !== ADMIN_PASSWORD) {
        return res.json({ success: false, message: '密码错误' });
    }

    const num = parseInt(count) || 1;
    if (num < 1 || num > 100) {
        return res.json({ success: false, message: '生成数量应在1-100之间' });
    }

    const newCards = [];
    for (let i = 0; i < num; i++) {
        let code;
        do {
            code = generateCardCode();
        } while (cards[code]);

        cards[code] = {
            code,
            used: false,
            createdAt: Date.now()
        };
        newCards.push(code);
    }

    saveCards();

    res.json({
        success: true,
        message: `成功生成 ${num} 张卡密`,
        cards: newCards
    });
});

app.post('/api/admin/cards/list', (req, res) => {
    const { password } = req.body;

    if (password !== ADMIN_PASSWORD) {
        return res.json({ success: false, message: '密码错误' });
    }

    const allCards = Object.values(cards);
    const total = allCards.length;
    const used = allCards.filter(c => c.used).length;
    const unused = total - used;

    res.json({
        success: true,
        total,
        used,
        unused,
        cards: allCards.sort((a, b) => b.createdAt - a.createdAt)
    });
});

// ==================== 邮件验证码 ====================
async function initMailer() {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpUser && smtpPass && smtpUser !== 'your_email@qq.com' && smtpPass !== 'your_email_password') {
        console.log('使用配置的SMTP邮箱:', smtpUser);
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.qq.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });
        fromEmail = smtpUser;
        console.log('SMTP初始化完成');
    } else {
        console.log('未配置SMTP，使用Ethereal测试邮箱...');
        try {
            const testAccount = await nodemailer.createTestAccount();
            etherealInfo = testAccount;
            transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
            fromEmail = 'dart-tycoon@ethereal.email';
            console.log('========================================');
            console.log('Ethereal测试邮箱创建成功！');
            console.log('邮箱账号:', testAccount.user);
            console.log('邮箱密码:', testAccount.pass);
            console.log('登录查看邮件: https://ethereal.email/messages');
            console.log('========================================');
        } catch (e) {
            console.error('创建Ethereal测试邮箱失败:', e.message);
            console.log('将使用本地模拟模式');
        }
    }
}

async function sendEmail(to, code) {
    if (!transporter) {
        return { success: false, error: '邮件服务未初始化' };
    }

    const mailOptions = {
        from: `"飞镖大亨" <${fromEmail}>`,
        to: to,
        subject: '飞镖大亨 - 验证码',
        html: `
            <div style="max-width: 400px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #1a1a2e, #16213e); border-radius: 10px;">
                <h2 style="color: #00d4ff; text-align: center; margin-bottom: 20px;">🎮 飞镖大亨</h2>
                <p style="color: #fff; font-size: 14px; line-height: 1.6;">您好！</p>
                <p style="color: #fff; font-size: 14px; line-height: 1.6;">您的验证码是：</p>
                <div style="text-align: center; margin: 20px 0;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #ffd700;">${code}</span>
                </div>
                <p style="color: #888; font-size: 12px; line-height: 1.6;">验证码有效期5分钟，请尽快使用。</p>
                <p style="color: #888; font-size: 12px; line-height: 1.6;">如果不是您本人操作，请忽略此邮件。</p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log(`邮件已发送至 ${to}, 验证码: ${code}`);
        if (previewUrl) {
            console.log(`预览链接: ${previewUrl}`);
            return { success: true, previewUrl: previewUrl };
        }
        return { success: true };
    } catch (error) {
        console.error('邮件发送失败:', error.message);
        return { success: false, error: error.message };
    }
}

app.post('/api/send-code', async (req, res) => {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, message: '请输入有效邮箱地址' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expire = Date.now() + 300000;

    verifyCodes[email] = { code, expire };

    const result = await sendEmail(email, code);

    if (!result.success) {
        return res.json({
            success: true,
            message: '验证码已发送（邮件服务暂时不可用，以下是验证码：' + code + '）',
            debugCode: code
        });
    }

    res.json({
        success: true,
        message: etherealInfo
            ? `验证码已发送！请登录 https://ethereal.email/messages 查看（账号: ${etherealInfo.user}）`
            : '验证码已发送至您的邮箱',
        debugCode: code,
        previewUrl: result.previewUrl || null,
        isEthereal: !!etherealInfo,
        etherealUser: etherealInfo ? etherealInfo.user : null
    });
});

app.post('/api/verify-code', (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ success: false, message: '请输入邮箱和验证码' });
    }

    const stored = verifyCodes[email];

    if (!stored) {
        return res.json({ success: false, message: '验证码不存在，请重新发送' });
    }

    if (Date.now() > stored.expire) {
        delete verifyCodes[email];
        return res.json({ success: false, message: '验证码已过期，请重新发送' });
    }

    if (stored.code === code) {
        delete verifyCodes[email];
        return res.json({ success: true, message: '验证成功' });
    }

    return res.json({ success: false, message: '验证码错误' });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        mailerReady: !!transporter,
        isEthereal: !!etherealInfo,
        wechatPayEnabled: WECHAT_PAY_CONFIG.enabled,
        totalCards: Object.keys(cards).length
    });
});

initMailer().then(() => {
    initWechatPay();
    app.listen(PORT, () => {
        console.log(`服务器运行在 http://localhost:${PORT}`);
        console.log('API接口:');
        console.log('  POST /api/card/redeem         - 兑换卡密');
        console.log('  POST /api/admin/login         - 管理员登录');
        console.log('  POST /api/admin/cards/generate - 生成卡密');
        console.log('  POST /api/admin/cards/list    - 卡密列表');
        console.log('  POST /api/send-code           - 发送验证码');
        console.log('  POST /api/verify-code         - 验证验证码');
        console.log('  GET  /api/health              - 健康检查');
        console.log('  游戏首页: http://localhost:' + PORT + '/index.html');
        console.log('  管理后台: http://localhost:' + PORT + '/index.html#admin');
        console.log(`  管理密码: ${ADMIN_PASSWORD}`);
        console.log('  卡密总数:', Object.keys(cards).length);
    });
});
