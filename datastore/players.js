class Players {
    constructor() {
        this.players = new Map();
    }

    get(userId) {
        console.log('PLAYERS: get ', userId);
        const player = this.players.get(userId);
        if (!player) {
            console.error(`player not found with socket id ${userId}`)
            console.log('Available players: ', this.players)
        }
        return player;
    }
    toArray() {
        return Array.from(this.players.values());
    }
    updatePlayer(userId, statesToUpdate) {
        const prev = this.get(userId);
        console.log('old', prev)
        const upd = { ...prev, ...statesToUpdate }
        console.log('upd', upd)
        this.players.set(userId, upd)
    }
    remove(userId) {
        return this.players.delete(userId);
    }
}

module.exports.Players = Players;