const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);

// تفعيل CORS لضمان اتصال واجهة Netlify بالخادم بسلاسة
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// متغيرات اللعبة
let isJoinOpen = false; 
let players = []; 

// استبدل 'username' باسم حساب التيك توك الخاص بك (الذي تفتح منه البث حالياً)
const tiktokUsername = "a_7_m_d2"; 

// إنشاء اتصال البث مع خيارات تجاوز وتصحيح التوقيع
const tiktokLiveConnection = new WebcastPushConnection(tiktokUsername, {
    processInitialData: false,
    enableExtendedGiftInfo: true
});

// محاولة الاتصال بالبث المباشر النشط
tiktokLiveConnection.connect().then(state => {
    console.info(`Connected to Room ID: ${state.roomId}`);
}).catch(err => {
    console.error('Failed to connect to TikTok Live. Make sure the LIVE is currently active.', err);
});

// الاستماع للتعليقات اللحظية
tiktokLiveConnection.on('chat', data => {
    // التحقق من أن الانضمام مفتوح وأن التعليق هو كلمة "انضم"
    if (isJoinOpen && data.comment.trim() === 'انضم') {
        const username = data.uniqueId;
        
        // منع تكرار نفس المستخدم في المصفوفة
        if (!players.includes(username)) {
            players.push(username);
            // إرسال الاسم فوراً إلى واجهة عجلة الحظ عبر WebSockets
            io.emit('newPlayer', username);
            console.log(`New Player Added: ${username}`);
        }
    }
});

// في حال انقطع الاتصال أو انتهى البث
tiktokLiveConnection.on('disconnected', () => {
    console.warn('Disconnected from TikTok Live stream.');
});

// إدارة الاتصال مع واجهة العجلة (Frontend)
io.on('connection', (socket) => {
    console.log('Frontend Dashboard Connected');
    
    // استقبال أمر فتح أو إغلاق الانضمام من صاحب البث
    socket.on('toggleJoin', (status) => {
        isJoinOpen = status;
        console.log(`Join Status Changed To: ${isJoinOpen}`);
    });

    // تصفير وعمل مسح لقائمة المشاركين
    socket.on('clearPlayers', () => {
        players = [];
        console.log('Players list cleared');
    });
});

// تشغيل الخادم على المنفذ المخصص من منصة Render أو منفذ محلي
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
