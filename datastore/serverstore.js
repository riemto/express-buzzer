const { Players } = require('./players')

class ServerStore {
    constructor() {
        console.log("create a new server store")
        this.playersMap = new Map();
    }
    setPlayers(gameId, players) {
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
        console.log("MAP", this.playersMap)
        this.playersMap.forEach((players, gameId) => {
            console.log("SERVERSTORE GAME ID: ", gameId);
            if (players) {
                console.log("players: ", players.toArray())
            } else {
                console.log("no players")
            }
        })
    }
}

module.exports.ServerStore = ServerStore;