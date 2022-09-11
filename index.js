const express = require('express');
const app = express();
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
} else {
    console.log("production code");
}

const SERVER_PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
app.use(cors())
const server = http.createServer(app)

console.log("client url: ", CLIENT_URL)
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

io.on("connection", socket => {
    console.log(`User connected: ${socket.id}`)

    socket.on("buzzer_clicked", data => {
        console.log("buzzer_clicked", data)
        io.emit("notify_client_buzzer_clicked", data)
    })
})

server.listen(SERVER_PORT, () => {
    console.log(`server is running on port ${SERVER_PORT}`)
})

app.get('/', (req, res) => {
    res.send("buzzerver is running ...")
})