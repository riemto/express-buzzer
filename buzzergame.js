exports.initGame = (io, socket) => {

    const buzzes = new Map();
    const unlockedGames = new Set();
    console.log(`User connected: ${socket.id}`)

    socket.on("start", ({ gameId }) => {
        unlockedGames.add(gameId);
        console.log("started", gameId)
        console.log("unlocked games:", unlockedGames)
        io.to(gameId).emit("unlock");
    })

    socket.on("buzzer_clicked", (
        { gameId, name, color },
        correctServerTimeAndEmitDataToServer
    ) => {
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
    })

    socket.on("buzzer_data", ({ name, gameId, color, timestamp }) => {
        if (buzzes.has(gameId)) {
            const firstPlayer = buzzes.get(gameId);
            const delta = timestamp - firstPlayer.timestamp;
            if (delta > 0) {
                // you were too late
                console.log("you were too late!")
                if (name !== firstPlayer) {
                    console.log("too late. Buzzes", buzzes)
                    io.to(socket.id).emit("notifyPlayerIsTooLate", { firstPlayer, delta })
                }
            } else {
                if (name !== firstPlayer) {
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
            buzzes.set(gameId, { name, color, timestamp })
            io.to(gameId).emit("showBuzzerData", {
                name,
                color,
                buzzerDataComplete: true
            })
        }
    })

    socket.on("join_room", ({ gameId, name }, setGameStatus) => {
        console.log(`${socket.id} aka ${name} joins room: ${gameId}`)
        socket.join(gameId);
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
    })


    socket.on("join_showpage", ({ gameId, name }) => {
        console.log(`${socket.id} aka ${name} joins show page for: ${gameId}`)
        socket.join(gameId);
    })

    socket.on("request_unlock", ({ gameId }) => {
        console.log("-".repeat(50))
        console.log("request unlock:");
        console.log("Buzzes before unlock: ", buzzes)
        buzzes.delete(gameId);
        io.to(gameId).emit("unlock")
        console.log("Buzzes after unlock: ", buzzes)
        console.log("-".repeat(80))
    })

    socket.on("ping", (callback) => {
        // used for debugging
        callback();
    });

    socket.on("disconnecting", () => {
        console.log("disconnecting", socket.id);
    });

    socket.on("disconnect", () => {
        // automatically leaves all rooms
        console.log(`User disconnected: ${socket.id}`)
    })
}