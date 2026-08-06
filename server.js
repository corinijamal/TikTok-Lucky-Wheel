const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let isJoinOpen = false; 
let players = []; 

const tiktokUsername = "a_7_m_d2"; 

// إعدادات اتصال تتجاوز أخطاء الفحص الأمني وتستقر مباشرة
const tiktokLiveConnection = new WebcastPushConnection(tiktokUsername, {
    enableExtendedGiftInfo: false,
    processInitialData: false,
    requestOptions: {
        timeout: 10000
    }
});

// محاولة الاتصال مع معالجة الاستجابة بأمان تام
tiktokLiveConnection.connect().then(state => {
    console.info(`Connected to Room ID: ${state.roomId}`);
}).catch(err => {
    console.error('Failed to connect to TikTok Live. Retrying in background...', err.message);
});

// إعادة محاولة الاتصال تلقائياً إذا فشل الاتصال الأول والبث مفتوح
setInterval(() => {
    if (!tiktokLiveConnection.isConnected) {
        tiktokLiveConnection.connect().then(state => {
            console.info(`Reconnected successfully to Room ID: ${state.roomId}`);
        }).catch(() => {
            // صامت لتجنب إزعاج السجلات
        });
    }
}, 15000);

tiktokLiveConnection.on('chat', data => {
    if (isJoinOpen && data.comment.trim() === 'انضم') {
        const username = data.uniqueId;
        
        if (!players.includes(username)) {
            players.push(username);
            io.emit('newPlayer', username);
            console.log(`New Player Added: ${username}`);
        }
    }
});

io.on('connection', (socket) => {
    console.log('Frontend Dashboard Connected');
    
    socket.on('toggleJoin', (status) => {
        isJoinOpen = status;
        console.log(`Join Status Changed To: ${isJoinOpen}`);
    });

    socket.on('clearPlayers', () => {
        players = [];
        console.log('Players list cleared');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
