const { ServerStore } = require('./datastore/serverstore')
let buzzes;
let unlockedGames;
let io;
let socket;
let serverStore;

exports.initGame = () => {
    console.log("init game")
    buzzes = new Map(); // gameId -> first player who buzzed
    serverStore = new ServerStore();
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
    socket.on("hostPlayerScore", hostPlayerScore);
    socket.on("hostReset", hostReset);

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
function hostConnect({ gameId }, setPlayers) {
    console.log(`HOST: ${socket.id} joins show page for: ${gameId}`)
    socket.join(gameId);
    const players = serverStore.getPlayers(gameId);
    setPlayers(players.toArray())
    console.log("PLAYERS WHEN HOST CONNECTS", players.toArray())
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

function hostPlayerScore({ gameId, socketId, name, delta }) {
    const players = serverStore.getPlayers(gameId);
    const player = players.get(socketId);
    if (!player) {
        console.error("HOSTPLAYERSCORE", "Player not found with socket id", socketId)
        return;
    }
    if (player.name == name) {
        player.score = (player.score || 0) + delta;
    }
    // note: Since players is referenced to player,
    // players is already up to date.
    // The serverStore is up to date as well because players is
    // a reference. So no need to inject the updated player
    // back into players and players back into serverStore.

    io.to(gameId).emit("playerUpdated", {
        players: players.toArray()
    })
}

function hostReset({ gameId }) {
    // reset buzzes
    buzzes.delete(gameId);
    unlockedGames.delete(gameId);

    // reset players and update host
    serverStore.reset(gameId);
    const players = serverStore.getPlayers(gameId);

    io.to(gameId).emit("playerUpdated", {
        players: players.toArray()
    })
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
function playerConnect({ gameId, player }, setGameStatus) {
    const { name, socketId, color } = player;
    console.log(name, socketId, color)
    console.log(`PLAYERCONNECT: ${name} - ${socketId}`)
    socket.join(gameId);
    let players = serverStore.getPlayers(gameId);
    players.updatePlayer(socketId, player);
    // const oldVersionOfPlayer = players.get(socketId);
    // const updatedPlayer = { ...oldVersionOfPlayer, ...player };
    // players.set(socketId, updatedPlayer);

    // TODO: is this neeeded:
    serverStore.setPlayers(gameId, players);

    console.log("PLAYERCONNECT: players in game", players.toArray())
    // if buzzer already pressed at moment where socket joins
    // notify him so he sees same results as others.
    if (buzzes.has(gameId)) {
        const firstBuzzData = buzzes.get(gameId);
        io.to(socket.id).emit("showBuzzerData", { ...firstBuzzData, buzzerDataComplete: true })
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
    io.to(gameId).emit("playerUpdated", {
        players: players.toArray()
    })
}

function playerHitBuzzer({ gameId, name, color, socketId },
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
            socketId
        })
    }
}

function playerSendData({ gameId, name, color, timestamp, socketId }) {
    if (buzzes.has(gameId)) {
        const firstBuzzData = buzzes.get(gameId);
        if (name !== firstBuzzData.name) {
            const delta = timestamp - firstBuzzData.timestamp;
            if (delta > 0) {
                console.log("too late. Buzzes", buzzes)
                io.to(socket.id).emit("notifyPlayerIsTooLate", { firstBuzzData, delta })
            } else {
                // the connection was just too late. Inform everybody.
                buzzes.set(gameId, { name, color, timestamp, socketId, buzzerDataComplete: true })
                const deltaSeconds = delta / 1000;
                const deltaSecondsRounded = Math.round(deltaSeconds * 10) / 10;
                const alertMessage = `
                Sorry, actually, ${name} was ${-deltaSecondsRounded}s faster.
                Apparently the connection was slow. Sorry for the slowroll...`;
                io.to(gameId).emit("showBuzzerData", {
                    name,
                    color,
                    alertMessage,
                    buzzerDataComplete: true,
                    socketId
                })
            }
        } else {
            // that player was actually the first person to buzz. Just show info again.
            io.to(socket.id).emit("showBuzzerData", firstBuzzData)
        }
    } else {
        // first buzzer!
        buzzes.set(gameId, { name, color, timestamp, socketId, buzzerDataComplete: true })
        io.to(gameId).emit("showBuzzerData", {
            name,
            color,
            buzzerDataComplete: true,
            socketId
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
    serverStore.remove(socket.id, (players, gameId) => {
        io.to(gameId).emit("playerUpdated", players)
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