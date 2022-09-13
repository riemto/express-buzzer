const express = require('express');
const app = express();
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const { v4: uuidv4 } = require('uuid');

if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
} else {
    console.log("production code");
}

const SERVER_PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const corsOptions = {
    origin: CLIENT_URL,
    methods: ["GET", "POST"]
}
console.log("cors origin:", corsOptions.origin)
app.use(cors(corsOptions))
const server = http.createServer(app)

console.log("client url: ", CLIENT_URL)
const io = new Server(server, {
    cors: corsOptions
})

io.on("connection", socket => {
    console.log(`User connected: ${socket.id}`)

    socket.on("buzzer_clicked", ({ name, gameId }) => {
        console.log("buzzer_clicked in ", name, gameId)
        io.to(gameId).emit("notify_client_buzzer_clicked", { name })
    })

    socket.on("join_room", ({ gameId, name }) => {
        console.log(`${socket.id} aka ${name} joins room: ${gameId}`)
        socket.join(gameId);
    })

    socket.on("disconnecting", () => {
        console.log(socket.rooms); // the Set contains at least the socket ID
    });

    socket.on("disconnect", () => {
        // automatically leaves all rooms
        console.log(`User disconnected: ${socket.id}`)
    })
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