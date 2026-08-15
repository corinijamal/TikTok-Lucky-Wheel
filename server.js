const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);

// تفعيل CORS لضمان اتصال الواجهة بالخادم
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let isJoinOpen = false; 
let players = []; 

// معرف الغرفة (Room ID) الخاص بك للاتصال المباشر
const roomId = "7674385695816829704"; 

const tiktokLiveConnection = new WebcastPushConnection(roomId, {
    enableExtendedGiftInfo: false,
    processInitialData: false,
    requestOptions: {
        timeout: 10000
    }
});

tiktokLiveConnection.connect().then(state => {
    console.info(`Connected to Room ID: ${state.roomId}`);
}).catch(err => {
    console.error('Failed to connect to TikTok Live. Retrying in background...', err.message);
});

// إعادة الاتصال التلقائي
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
