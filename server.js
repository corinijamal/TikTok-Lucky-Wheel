const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { TikTokLiveConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);

// تفعيل CORS لضمان اتصال الواجهة الأمامية بالخادم بسلاسة
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
// مثال: لو رابط حسابك هو tiktok.com/@ahmed_live فالقيمة الصحيحة هي "ahmed_live"
const tiktokUsername = "a_7_m_d2";

// إنشاء اتصال البث
const tiktokLiveConnection = new TikTokLiveConnection(tiktokUsername, {
    processInitialData: false,
    enableExtendedGiftInfo: true,
    // مفتاح Eulerstream المجاني - سجّل حساب مجاني في eulerstream.com واحصل عليه
    // ثم ضعه كمتغير بيئة EULER_API_KEY في إعدادات Render (Environment)
    signApiKey: process.env.EULER_API_KEY
});

// دالة الاتصال مع إعادة محاولة تلقائية في حال الفشل
function connectToTikTok() {
    tiktokLiveConnection.connect().then(state => {
        console.info(`✅ متصل بالبث - Room ID: ${state.roomId}`);
    }).catch(err => {
        console.error('❌ فشل الاتصال بالبث. تأكد أن الحساب يبث الآن وأن اليوزرنيم صحيح:', err.message || err);
        console.log('سيتم إعادة المحاولة خلال 30 ثانية...');
        setTimeout(connectToTikTok, 30000);
    });
}

connectToTikTok();

// الاستماع للتعليقات اللحظية
tiktokLiveConnection.on('chat', data => {
    if (isJoinOpen && data.comment.trim() === 'انضم') {
        const username = data.uniqueId;

        // منع تكرار نفس المستخدم في المصفوفة
        if (!players.includes(username)) {
            players.push(username);
            io.emit('newPlayer', username);
            console.log(`👤 انضم لاعب جديد: ${username}`);
        }
    }
});

// في حال انقطع الاتصال، أعد المحاولة تلقائياً
tiktokLiveConnection.on('disconnected', () => {
    console.warn('⚠️ انقطع الاتصال بالبث. جارٍ إعادة المحاولة...');
    setTimeout(connectToTikTok, 10000);
});

// إدارة الاتصال مع واجهة العجلة (Frontend)
io.on('connection', (socket) => {
    console.log('🖥️ تم اتصال لوحة التحكم');

    // إرسال قائمة اللاعبين الحاليين فور اتصال أي واجهة جديدة
    // (يحل مشكلة عدم تزامن العجلة عند فتح صفحة جديدة)
    socket.emit('syncPlayers', players);

    socket.on('toggleJoin', (status) => {
        isJoinOpen = status;
        console.log(`🔓 حالة الانضمام: ${isJoinOpen ? 'مفتوح' : 'مغلق'}`);
    });

    socket.on('clearPlayers', () => {
        players = [];
        io.emit('playersCleared'); // إبلاغ كل الواجهات المتصلة، وليس فقط من ضغط الزر
        console.log('🧹 تم مسح قائمة اللاعبين');
    });

    // اختيار فائز عشوائي عند الطلب من لوحة التحكم
    socket.on('spinWheel', () => {
        if (players.length === 0) {
            socket.emit('spinError', 'لا يوجد مشاركين حالياً!');
            return;
        }
        const winnerIndex = Math.floor(Math.random() * players.length);
        const winner = players[winnerIndex];
        // إرسال نتيجة الفوز مع فهرس اللاعب لحساب زاوية الدوران في الواجهة
        io.emit('spinResult', { winner, winnerIndex, totalPlayers: players.length });
        console.log(`🏆 الفائز: ${winner}`);
    });
});

// تشغيل الخادم
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
});
