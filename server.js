import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import TikTokLiveConnector from 'tiktok-live-connector';

const { WebcastPushConnection } = TikTokLiveConnector;

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

const tiktokLiveConnection = new WebcastPushConnection(tiktokUsername, {
    processInitialData: false,
    enableExtendedGiftInfo: false,
    requestOptions: {
        timeout: 10000
    }
});

tiktokLiveConnection.connect().then(state => {
    console.info(`Connected successfully to Room ID: ${state.roomId}`);
}).catch(err => {
    console.error('Failed to connect to TikTok Live. Retrying...', err.message);
});

setInterval(() => {
    if (!tiktokLiveConnection.isConnected) {
        tiktokLiveConnection.connect().then(state => {
            console.info(`Reconnected successfully to Room ID: ${state.roomId}`);
        }).catch(() => {
            // صامت في الخلفية
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
