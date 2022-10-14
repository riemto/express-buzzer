class Players {
    constructor() {
        this.players = new Map();
    }

    get(socketId) {
        console.log('PLAYERS: get ', socketId);
        const player = this.players.get(socketId);
        if (!player) {
            console.error(`player not found with socket id ${socketId}`)
            console.log('Available players: ', this.players)
        }
        return player;
    }
    toArray() {
        return Array.from(this.players.values());
    }
    updatePlayer(socketId, statesToUpdate) {
        const prev = this.get(socketId);
        console.log('old', prev)
        const upd = { ...prev, ...statesToUpdate }
        console.log('upd', upd)
        this.players.set(socketId, upd)
    }
    remove(socketId) {
        return this.players.delete(socketId);
    }
}

module.exports.Players = Players;