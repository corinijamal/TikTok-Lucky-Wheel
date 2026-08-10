const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ================================
// إعدادات الحساب
// ================================

// ضع اسم حساب TikTok هنا بدون @
const TIKTOK_USERNAME = "a_7_m_d2";

// كلمة الانضمام
const JOIN_WORD = "انضم";

// ================================
// متغيرات النظام
// ================================

let tiktokLiveConnection = null;

let isConnected = false;
let currentRoomId = null;

let isJoinOpen = false;
let players = [];

// ================================
// دالة الاتصال بـ TikTok LIVE
// ================================

async function connectToTikTok() {

    // إذا كان هناك اتصال قديم، ننهيه أولاً
    if (tiktokLiveConnection) {
        try {
            await tiktokLiveConnection.disconnect();
        } catch (error) {
            console.log("Old TikTok connection closed.");
        }

        tiktokLiveConnection = null;
    }

    console.log(`Connecting to TikTok LIVE: @${TIKTOK_USERNAME}`);

    tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME, {
        processInitialData: false,
        enableExtendedGiftInfo: true
    });

    // ================================
    // الاتصال بنجاح
    // ================================

    tiktokLiveConnection.connect()
        .then(state => {

            isConnected = true;
            currentRoomId = state.roomId;

            console.log("================================");
            console.log("TikTok LIVE Connected");
            console.log(`Username: @${TIKTOK_USERNAME}`);
            console.log(`Room ID: ${currentRoomId}`);
            console.log("================================");

            // إرسال حالة الاتصال للموقع
            io.emit("tiktokStatus", {
                connected: true,
                username: TIKTOK_USERNAME,
                roomId: currentRoomId
            });

        })
        .catch(error => {

            isConnected = false;
            currentRoomId = null;

            console.error("TikTok connection failed:");
            console.error(error);

            io.emit("tiktokStatus", {
                connected: false,
                username: TIKTOK_USERNAME,
                roomId: null
            });

            // إعادة المحاولة بعد 10 ثواني
            setTimeout(() => {
                connectToTikTok();
            }, 10000);
        });

    // ================================
    // استقبال التعليقات
    // ================================

    tiktokLiveConnection.on("chat", data => {

        const comment = (data.comment || "").trim();
        const username = data.uniqueId;

        console.log(`CHAT: @${username}: ${comment}`);

        // التأكد أن الانضمام مفتوح
        if (!isJoinOpen) {
            return;
        }

        // التأكد أن الرسالة هي "انضم"
        if (comment !== JOIN_WORD) {
            return;
        }

        // منع تكرار المستخدم
        if (players.includes(username)) {
            return;
        }

        // إضافة اللاعب
        players.push(username);

        console.log(`NEW PLAYER: @${username}`);

        // إرسال اللاعب إلى الموقع
        io.emit("newPlayer", username);
    });

    // ================================
    // انقطاع الاتصال
    // ================================

    tiktokLiveConnection.on("disconnected", () => {

        console.warn("TikTok LIVE disconnected.");

        isConnected = false;
        currentRoomId = null;

        io.emit("tiktokStatus", {
            connected: false,
            username: TIKTOK_USERNAME,
            roomId: null
        });

        // محاولة إعادة الاتصال بعد 10 ثواني
        setTimeout(() => {

            console.log("Trying to reconnect to TikTok LIVE...");

            connectToTikTok();

        }, 10000);
    });
}

// ================================
// Socket.IO
// ================================

io.on("connection", socket => {

    console.log("Frontend connected.");

    // إرسال الحالة الحالية مباشرة للواجهة
    socket.emit("tiktokStatus", {
        connected: isConnected,
        username: TIKTOK_USERNAME,
        roomId: currentRoomId
    });

    // ================================
    // فتح / إغلاق الانضمام
    // ================================

    socket.on("toggleJoin", status => {

        isJoinOpen = Boolean(status);

        console.log(
            `Join status: ${isJoinOpen ? "OPEN" : "CLOSED"}`
        );
    });

    // ================================
    // مسح اللاعبين
    // ================================

    socket.on("clearPlayers", () => {

        players = [];

        console.log("Players list cleared.");

        io.emit("playersCleared");
    });

    // ================================
    // إرسال قائمة اللاعبين للواجهة
    // ================================

    socket.emit("playersList", players);
});

// ================================
// الصفحة الرئيسية
// ================================

app.get("/", (req, res) => {

    res.send(`
        <h1>TikTok Wheel Backend</h1>
        <p>Account: @${TIKTOK_USERNAME}</p>
        <p>Status: ${isConnected ? "Connected" : "Disconnected"}</p>
        <p>Room ID: ${currentRoomId || "Not available"}</p>
    `);

});

// ================================
// تشغيل السيرفر
// ================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {

    console.log("================================");
    console.log(`Server running on port ${PORT}`);
    console.log(`TikTok account: @${TIKTOK_USERNAME}`);
    console.log("================================");

    // بدء الاتصال بـ TikTok
    connectToTikTok();
});
