const express = require('express');
const app = express();
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const { v4: uuidv4 } = require('uuid');
const buzzergame = require('./buzzergame');
const { instrument } = require("@socket.io/admin-ui");

if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
} else {
    console.log("production code");
}

const SERVER_PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
console.log("client url: ", CLIENT_URL)

const corsOptions = {
    origin: [CLIENT_URL, "https://admin.socket.io"],
    methods: ["GET", "POST"],
    credentials: true
}
app.use(cors(corsOptions))
const server = http.createServer(app)

buzzergame.initGame();
const io = new Server(server, {
    cors: corsOptions
})

io.on("connection", socket => {
    buzzergame.connectSocket(io, socket);
})

server.listen(SERVER_PORT, () => {
    console.log(`server is running on port ${SERVER_PORT}`)
})

app.get('/', (req, res) => {
    res.send("buzzerver is running ...")
})

app.get('/new', (req, res) => {
    const newId = uuidv4();
    res.send({ gameId: newId });
})

instrument(io, {
    auth: false
});