const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');// مهم الاقواس {}
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["https://harmonious-biscotti-8c37b8.netlify.app", "*"],
    methods: ["GET", "POST"]
  }
});

let isJoinOpen = false;
let players = [];
const tiktokUsername = "a_7_m_d2"; // غيره

const tiktokLiveConnection = new WebcastPushConnection(tiktokUsername, {
    processInitialData: false,
    enableExtendedGiftInfo: true,
    signApiKey: process.env.EULER_API_KEY
});

function connectToTikTok() {
    tiktokLiveConnection.connect().then(state => {
        console.info(`✅ متصل بالبث - Room ID: ${state.roomId}`);
    }).catch(err => {
        console.error('❌ فشل الاتصال بالبث:', err);
        setTimeout(connectToTikTok, 30000);
    });
}

connectToTikTok();

tiktokLiveConnection.on('chat', data => {
    if (isJoinOpen && data.comment.trim().toLowerCase() === 'انضم') {
        const username = data.uniqueId;
        if (!players.includes(username)) {
            players.push(username);
            io.emit('newPlayer', username);
        }
    }
});

tiktokLiveConnection.on('disconnected', () => {
    setTimeout(connectToTikTok, 10000);
});

io.on('connection', (socket) => {
    socket.emit('syncPlayers', players);
    socket.on('toggleJoin', (status) => { isJoinOpen = status; });
    socket.on('clearPlayers', () => { players = []; io.emit('playersCleared'); });
    socket.on('spinWheel', () => {
        if (players.length === 0) return socket.emit('spinError', 'لا يوجد مشاركين حالياً!');
        const winnerIndex = Math.floor(Math.random() * players.length);
        const winner = players[winnerIndex];
        io.emit('spinResult', { winner, winnerIndex, totalPlayers: players.length });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`));
