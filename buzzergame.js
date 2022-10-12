let buzzes;
let unlockedGames;
let io;
let socket;
let playersMap;

exports.initGame = () => {
    console.log("init game")
    buzzes = new Map(); // gameId -> first player who buzzed
    playersMap = new Map(); // gameId -> players
    unlockedGames = new Set();
}

/**
 * This function is called by index.js to initialize a new game instance.
 * 
 * @param sio The Socket.IO library
 * @param gameSocket The socket object for the connected client.
 */
exports.connectSocket = (sio, gameSocket) => {
    console.log("connect socket", gameSocket.id)
    // Set global variables based on input so that rest of the file can access them.
    io = sio;
    socket = gameSocket;

    // HOST
    socket.on("hostConnect", hostConnect);
    socket.on("hostStartGame", hostStartGame);
    socket.on("hostUnlock", hostUnlock);

    // PLAYER
    socket.on("playerConnect", playerConnect);
    socket.on("playerHitBuzzer", playerHitBuzzer)
    socket.on("playerSendData", playerSendData);

    // DEBUG
    socket.on("debugPing", debugPing);

    // GENERAL SOCKET CONNECTION
    socket.on("disconnecting", disconnecting);
    socket.on("disconnect", disconnect);
}

/* *******************************
   *                             *
   *       HOST FUNCTIONS        *
   *                             *
   ******************************* */

/**
 * Create game was clicked and 'hostConnect' event occured.
 * 
 * @param gameId id of game from URL
 * @param name hostname
 */
function hostConnect({ gameId }) {
    console.log(`HOST: ${socket.id} joins show page for: ${gameId}`)
    socket.join(gameId);
}

/**
 * Host clicked the START button and 'hostStartGame' event occured.
 */
function hostStartGame({ gameId }) {
    unlockedGames.add(gameId);
    console.log("started", gameId)
    console.log("unlocked games:", unlockedGames)
    io.to(gameId).emit("unlock");
}


/**
 * Host unlocks all buzzers so that players are ready to hit buzzer
 */
function hostUnlock({ gameId }) {
    // reset the buzzers
    buzzes.delete(gameId);
    io.to(gameId).emit("unlock")
}

/* *****************************
   *                           *
   *     PLAYER FUNCTIONS      *
   *                           *
   ***************************** */
/**
 * Player connects to the game.
 * @param setGameStatus callback to provide game status to client.
 */
function playerConnect({ gameId, name, color, socketId }, setGameStatus) {
    console.log(`${socket.id} aka ${name} joins room: ${gameId}`)
    socket.join(gameId);
    let players = playersMap.get(gameId) || new Map();
    const newPlayer = { name, socketId, color };
    players.set(socketId, newPlayer);
    playersMap.set(gameId, players)
    console.log("players in game", Array.from(players.values()))
    // if buzzer already pressed at moment where socket joins
    // notify him so he sees same results as others.
    if (buzzes.has(gameId)) {
        const firstPlayer = buzzes.get(gameId);
        io.to(socket.id).emit("showBuzzerData", {
            name: firstPlayer.name,
            color: firstPlayer.color,
            buzzerDataComplete: true
        })
        // emit a note as well so he is aware of what he is seeing
        io.to(socket.id).emit("notifyLatecomer")
    }

    if (unlockedGames.has(gameId)) {
        io.to(socket.id).emit("unlock")
    }
    if (setGameStatus) {
        setGameStatus({ unlocked: unlockedGames.has(gameId) })
    }
    // Inform rest that the player connected
    io.to(gameId).emit("playerConnected", { gameId, name, socketId: socket.id, color, players: Array.from(players.values()) })
}

function playerHitBuzzer({ gameId, name, color },
    correctServerTimeAndEmitDataToServer) {
    const timeBuzzReceivedOnServer = Date.now();
    // send server time back to client so it can compute the latency
    // and inform us back about that with a new emit.
    correctServerTimeAndEmitDataToServer(timeBuzzReceivedOnServer);

    if (!buzzes.has(gameId)) {
        // broadcast to others as well. Own socket is already
        // displaying info to have faster response experience.
        socket.to(gameId).emit("showBuzzerData", {
            name,
            color,
            buzzerDataComplete: false,
        })
    }
}

function playerSendData({ name, gameId, color, timestamp }) {
    if (buzzes.has(gameId)) {
        const firstPlayer = buzzes.get(gameId);
        if (name !== firstPlayer) {
            const delta = timestamp - firstPlayer.timestamp;
            if (delta > 0) {
                console.log("too late. Buzzes", buzzes)
                io.to(socket.id).emit("notifyPlayerIsTooLate", { firstPlayer, delta })
            } else {
                // the connection was just too late. Inform everybody.
                buzzes.set(gameId, { name, color, timestamp })
                const deltaSeconds = delta / 1000;
                const deltaSecondsRounded = Math.round(deltaSeconds * 10) / 10;
                const alertMessage = `
                Sorry, actually, ${name} was ${-deltaSecondsRounded}s faster.
                Apparently the connection was slow. Sorry for the slowroll...`;
                io.to(gameId).emit("showBuzzerData", {
                    name,
                    color,
                    alertMessage,
                    buzzerDataComplete: true
                })
            }
        }
    } else {
        // first buzzer!
        buzzes.set(gameId, { name, color, timestamp })
        io.to(gameId).emit("showBuzzerData", {
            name,
            color,
            buzzerDataComplete: true
        })
    }
}

/* *****************************
   *                           *
   *   CONNECTION FUNCTIONS    *
   *                           *
   ***************************** */

/**
 * This function is called right before disconnecting
 */
function disconnecting() {
    console.log("disconnecting", socket.id);
    // Remove socket from players and update game
    playersMap.forEach((players, gameId) => {
        success = players.delete(socket.id);
        if (success) {
            io.to(gameId).emit("playerUpdated", { players: Array.from(players.values()) })
        }
    })
}

function disconnect() {
    // automatically leaves all rooms
    console.log(`User disconnected: ${socket.id}`)
}

/* *****************************
   *                           *
   *   DEBUGGING FUNCTIONS     *
   *                           *
   ***************************** */
function debugPing(callback) {
    // used for debugging
    callback();
}