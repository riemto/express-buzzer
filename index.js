const express = require('express');
const app = express();
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const { v4: uuidv4 } = require('uuid');

const { instrument } = require("@socket.io/admin-ui")

if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
} else {
    console.log("production code");
}

const SERVER_PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const corsOptions = {
    origin: [CLIENT_URL, "https://admin.socket.io"],
    methods: ["GET", "POST"],
    credentials: true
}
console.log("cors origin:", corsOptions.origin)
app.use(cors(corsOptions))
const server = http.createServer(app)

console.log("client url: ", CLIENT_URL)
const io = new Server(server, {
    cors: corsOptions
})

const buzzes = new Map();

const onBuzzerClicked = ({ name, gameId, timestamp }) => {
    console.log("buzzer_clicked", name, gameId, timestamp)
    if (buzzes.has(gameId)) {
        const firstPlayer = buzzes.get(gameId);
        const delta = timestamp - firstPlayer.timestamp;
        if (name !== firstPlayer) {
            console.log("too late. Buzzes", buzzes)
            io.to(socket.id).emit("too_late", { firstPlayer, delta })
        }
    } else {
        buzzes.set(gameId, { name, timestamp })
        io.to(gameId).emit("notify_client_buzzer_clicked", { name })
    }
}

io.on("connection", socket => {
    console.log(`User connected: ${socket.id}`)

    socket.on("buzzer_clicked", onBuzzerClicked)

    socket.on("join_room", ({ gameId, name }) => {
        console.log(`${socket.id} aka ${name} joins room: ${gameId}`)
        socket.join(gameId);
        // if buzzer already pressed at moment where socket joins
        // notify him so he sees same results as others.
        if (buzzes.has(gameId)) {
            const firstPlayer = buzzes.get(gameId);
            io.to(socket.id).emit("notify_client_buzzer_clicked", { name: firstPlayer.name })
            // emit a note as well so he is aware of what he is seeing
            io.to(socket.id).emit("notify_latecomer")
        }
    })

    socket.on("request_unlock", ({ gameId }) => {
        console.log("request unlock. Buzzes: ", buzzes)
        buzzes.delete(gameId);
        io.to(gameId).emit("unlocked")
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

instrument(io, {
    auth: false
});