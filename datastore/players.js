class Players {
    constructor() {
        this.players = new Map(); // userId -> player
        this.sid2userId = new Map(); // socketID -> userId
    }

    get(userId) {
        console.log('PLAYERS: get ', userId);
        const player = this.players.get(userId);
        if (!player) {
            console.error(`player not found with user id ${userId}`)
            console.log('Available players: ', this.players)
        }
        return player;
    }
    toArray() {
        return Array.from(this.players.values());
    }
    updatePlayer(userId, socketId, statesToUpdate) {
        const prev = this.get(userId);
        console.log('old', prev)
        const upd = { ...prev, ...statesToUpdate }
        console.log('upd', upd)
        this.players.set(userId, upd)
        this.sid2userId.set(socketId, userId);
    }
    remove(socketId) {
        const userId = this.sid2userId.get(socketId);
        return this.players.delete(userId);
    }
}

module.exports.Players = Players;