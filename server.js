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

const tiktokLiveConnection = new WebcastPushConnection(tiktokUsername, {
    // إضافات اختيارية لتثبيت الاتصال وتجاوز قيود التوقيع المؤقتة
    processInitialData: false,
    enableExtendedGiftInfo: true
});

// استبدل 'username' باسم حساب التيك توك الذي ستقوم بالبث منه
const tiktokUsername = "a_7_m_d2"; 
const tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

tiktokLiveConnection.connect().then(state => {
    console.info(`Connected to Room ID: ${state.roomId}`);
}).catch(err => {
    console.error('Failed to connect to TikTok Live', err);
});

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

const listener = server.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${listener.address().port}`);
});
