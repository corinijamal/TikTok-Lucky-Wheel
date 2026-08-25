const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// متغيرات اللعبة
let isJoinOpen = false;
let players = [];

// ⚠️ عدّل هذا السطر فقط: ضع اسم مستخدم حسابك في تيك توك بدون علامة @
const tiktokUsername = "a_7_m_d2";

// إنشاء اتصال البث
const tiktokLiveConnection = new WebcastPushConnection(tiktokUsername, {
    processInitialData: false,
    enableExtendedGiftInfo: true,
    // لو عندك مشكلة حظر استخدم مفتاح eulerstream
    // signApiKey: process.env.EULER_API_KEY
});

function connectToTikTok() {
    tiktokLiveConnection.connect().then(state => {
        console.info(`✅ متصل بالبث - Room ID: ${state.roomId}`);
    }).catch(err => {
        console.error('❌ فشل الاتصال بالبث:', err.message || err);
        console.log('سيتم إعادة المحاولة خلال 30 ثانية...');
        setTimeout(connectToTikTok, 30000);
    });
}

connectToTikTok();

// الاستماع للتعليقات
tiktokLiveConnection.on('chat', data => {
    if (isJoinOpen && data.comment.trim().toLowerCase() === 'انضم') {
        const username = data.uniqueId;
        if (!players.includes(username)) {
            players.push(username);
            io.emit('newPlayer', username);
            console.log(`👤 انضم لاعب جديد: ${username}`);
        }
    }
});

tiktokLiveConnection.on('disconnected', () => {
    console.warn('⚠️ انقطع الاتصال بالبث. جارٍ إعادة المحاولة...');
    setTimeout(connectToTikTok, 10000);
});

// إدارة الاتصال مع واجهة العجلة
io.on('connection', (socket) => {
    console.log('🖥️ تم اتصال لوحة التحكم');
    socket.emit('syncPlayers', players);

    socket.on('toggleJoin', (status) => {
        isJoinOpen = status;
        console.log(`🔓 حالة الانضمام: ${isJoinOpen? 'مفتوح' : 'مغلق'}`);
    });

    socket.on('clearPlayers', () => {
        players = [];
        io.emit('playersCleared');
        console.log('🧹 تم مسح قائمة اللاعبين');
    });

    socket.on('spinWheel', () => {
        if (players.length === 0) {
            socket.emit('spinError', 'لا يوجد مشاركين حالياً!');
            return;
        }
        const winnerIndex = Math.floor(Math.random() * players.length);
        const winner = players[winnerIndex];
        io.emit('spinResult', { winner, winnerIndex, totalPlayers: players.length });
        console.log(`🏆 الفائز: ${winner}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
});
