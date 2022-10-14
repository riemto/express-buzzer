const { Players } = require('./players')

class ServerStore {
    constructor() {
        console.log("create a new server store")
        this.playersMap = new Map();
    }

    setPlayers(gameId, players) {
        if (!gameId) {
            console.log("SERVERSTORE wants to set players but game id not defined!")
            return;
        }
        console.log("SERVERSTORE: SET PLAYERS", players)
        this.playersMap.set(gameId, players);
    }

    getPlayers(gameId) {
        let players = this.playersMap.get(gameId);
        if (!players) {
            players = new Players();
            this.setPlayers(gameId, players);
        }
        return players;
    }

    remove(socketId, onSuccess) {
        this.playersMap.forEach((players, gameId) => {
            const success = players.remove(socketId);
            if (success) {
                console.log('successfully removed ', socketId)
                onSuccess(players.toArray(), gameId)
            }
        })
    }

    reset(gameId) {
        this.setPlayers(gameId, new Players())
    }

    print() {
        this.playersMap.forEach((players, gameId) => {
            console.log("SERVERSTORE GAME ID: ", gameId);
            if (players) {
                console.log("players: ");
                for (let p of players.toArray()) {
                    console.log(p.name, p.socketId, p.score)
                }
            } else {
                console.log("no players")
            }
        })
    }
}

module.exports.ServerStore = ServerStore;