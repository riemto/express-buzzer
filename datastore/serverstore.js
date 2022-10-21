const { Players } = require('./players')

class ServerStore {
    constructor() {
        console.log("create a new server store")
        this.playersMap = new Map(); // gameId -> players
        this.hosts = new Set();
    }

    addHost(hostUserId) {
        console.log("SERVERSTORE ADD HOST", hostUserId)
        this.hosts.add(hostUserId);
    }

    isHost(userId) {
        return this.hosts.has(userId);
    }

    removeHost(userId) {
        return this.hosts.delete(userId);
    }

    setPlayers(gameId, players) {
        if (!gameId) {
            console.log("SERVERSTORE wants to set players but game id not defined!")
            return;
        }
        this.playersMap.set(gameId, players);
    }

    getPlayers(gameId) {
        let players = this.playersMap.get(gameId);
        if (!players) {
            console.log("SERVERSTORE: NO PLAYERS YET")
            players = new Players();
            this.setPlayers(gameId, players);
        }
        return players;
    }

    remove(socketId, onSuccess) {
        this.playersMap.forEach((players, gameId) => {
            console.log("remove player with socket id", socketId)
            console.log("players", players)
            const success = players.removeSocketId(socketId);
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
                    console.log(p.name, p.userId, p.score)
                }
            } else {
                console.log("no players")
            }
        })
    }
}

module.exports.ServerStore = ServerStore;