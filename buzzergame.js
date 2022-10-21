const { ServerStore } = require('./datastore/serverstore')
let buzzes;
let unlockedGames;
let io;
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
    console.log("connect gameSocket", gameSocket.id)
    // Set global variables based on input so that rest of the file can access them.
    io = sio;

    // HOST
    gameSocket.on("hostConnect", hostConnect);
    gameSocket.on("hostStartGame", hostStartGame);
    gameSocket.on("hostStopGame", hostStopGame);
    gameSocket.on("hostUnlock", hostUnlock);
    gameSocket.on("hostPlayerScore", hostPlayerScore);
    gameSocket.on("hostReset", hostReset);

    // PLAYER
    gameSocket.on("playerConnect", playerConnect);
    gameSocket.on("playerHitBuzzer", playerHitBuzzer)
    gameSocket.on("playerSendData", playerSendData);
    gameSocket.on("playerPing", playerPing);

    // DEBUG
    gameSocket.on("debugPing", debugPing);

    // GENERAL SOCKET CONNECTION
    gameSocket.on("disconnecting", disconnecting);
    gameSocket.on("disconnect", disconnect);


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
    async function hostConnect({ gameId, userId }, setPlayers) {
        console.log(`HOST: ${gameSocket.id}  VS ${userId} joins show page for: ${gameId}`)
        gameSocket.join(gameId);
        serverStore.addHost(userId);
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
     * Host clicked the STOP button and 'hostStopGame' event occured.
     */
    function hostStopGame({ gameId }) {
        unlockedGames.delete(gameId);
        console.log("stopped", gameId)
        console.log("unlocked games:", unlockedGames)
        io.to(gameId).emit("lock");
    }

    /**
     * Host unlocks all buzzers so that players are ready to hit buzzer
     */
    function hostUnlock({ gameId }) {
        // reset the buzzers
        buzzes.delete(gameId);
        io.to(gameId).emit("unlock")
    }

    function hostPlayerScore({ gameId, userId, name, delta }) {
        const players = serverStore.getPlayers(gameId);
        const player = players.get(userId);
        if (!player) {
            console.error("HOSTPLAYERSCORE", "Player not found with user id", userId)
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
        const { name, userId, color } = player;
        if (!userId) {
            console.log("PLAYERCONNECT: userId not defined")
            return;
        }
        console.log(name, userId, color)
        console.log(`PLAYERCONNECT: ${name} - ${userId}`)
        gameSocket.join(gameId);
        if (!name || name == "") {
            console.log("PLAYERCONNECT: but player does not have a name yet")
            return;
        }

        let players = serverStore.getPlayers(gameId);
        players.updatePlayer(userId, gameSocket.id, player);
        // const oldVersionOfPlayer = players.get(userId);
        // const updatedPlayer = { ...oldVersionOfPlayer, ...player };
        // players.set(userId, updatedPlayer);

        // TODO: is this neeeded:
        serverStore.setPlayers(gameId, players);

        // do this before triggering showData
        // because unlock will reset buzzerData on client side.
        if (unlockedGames.has(gameId)) {
            io.to(gameSocket.id).emit("unlock")
        }

        console.log("PLAYERCONNECT: players in game", players.toArray())
        // if buzzer already pressed at moment where gameSocket joins
        // notify him so he sees same results as others.
        if (buzzes.has(gameId)) {
            const firstBuzzData = buzzes.get(gameId);
            io.to(gameSocket.id).emit("showBuzzerData", { ...firstBuzzData, buzzerDataComplete: true })
            if (name !== firstBuzzData.name) {
                // emit a note as well so he is aware of what he is seeing
                io.to(gameSocket.id).emit("notifyLatecomer")
            }
        }

        if (setGameStatus) {
            setGameStatus({
                unlocked: unlockedGames.has(gameId)
            })
        }

        // Inform rest that the player connected
        io.to(gameId).emit("playerUpdated", {
            players: players.toArray()
        })
    }

    function playerHitBuzzer({ gameId, name, color, userId },
        correctServerTimeAndEmitDataToServer) {
        const timeBuzzReceivedOnServer = Date.now();
        // send server time back to client so it can compute the latency
        // and inform us back about that with a new emit.
        correctServerTimeAndEmitDataToServer(timeBuzzReceivedOnServer);

        if (!buzzes.has(gameId)) {
            // broadcast to others as well. Own socket is already
            // displaying info to have faster response experience.
            gameSocket.to(gameId).emit("showBuzzerData", {
                name,
                color,
                buzzerDataComplete: false,
                userId
            })
        }
    }

    function playerSendData({ gameId, name, color, timestamp, userId }) {
        if (buzzes.has(gameId)) {
            const firstBuzzData = buzzes.get(gameId);
            if (name !== firstBuzzData.name) {
                const delta = timestamp - firstBuzzData.timestamp;
                if (delta > 0) {
                    console.log("too late. Buzzes", buzzes)
                    io.to(gameSocket.id).emit("notifyPlayerIsTooLate", { firstBuzzData, delta })
                } else {
                    // the connection was just too late. Inform everybody.
                    buzzes.set(gameId, { name, color, timestamp, userId, buzzerDataComplete: true })
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
                        userId
                    })
                }
            } else {
                // that player was actually the first person to buzz. Just show info again.
                io.to(gameSocket.id).emit("showBuzzerData", firstBuzzData)
            }
        } else {
            // first buzzer!
            buzzes.set(gameId, { name, color, timestamp, userId, buzzerDataComplete: true })
            io.to(gameId).emit("showBuzzerData", {
                name,
                color,
                buzzerDataComplete: true,
                userId
            })
        }
    }

    function playerPing({ gameId, name, color, userId }) {
        io.to(gameId).emit("hostShowPlayerPing", { name, color, userId })
    }

    /* *****************************
       *                           *
       *   CONNECTION FUNCTIONS    *
       *                           *
       ***************************** */

    /**
     * This function is called right before disconnecting
     */
    function disconnecting(reason) {
        console.log("disconnecting", gameSocket.id);
        console.log("REASON", reason)
        console.log("SOCKET ROOMS: ", gameSocket.rooms);
        if (serverStore.isHost(gameSocket.id)) {
            console.log("------- DISCONNECT HOST! --------")
            serverStore.removeHost(gameSocket.id)
        } else {
            // Remove gameSocket from players and update game
            serverStore.removeSocketId(gameSocket.id, (players, gameId) => {
                console.log("REMOVE PLAYER -> INFORM EVERYBODY IN GAME", gameId, players)
                io.to(gameId).emit("playerUpdated", { players })
            })
        }
    }

    function disconnect() {
        // automatically leaves all rooms
        console.log(`User disconnected: ${gameSocket.id}`)
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

}