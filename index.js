const express = require('express');
const app = express();
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
require('dotenv').config()

const SERVER_PORT = process.env.PORT || 3001;

app.use(cors())
const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
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
