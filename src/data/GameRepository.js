class GameRepository {
    constructor(dao) {
        this.dao = dao
    }

    async createTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS games_list
            (
                id                  INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                name                text NOT NULL,
                year                text NOT NULL,
                boxArtFile          text NOT NULL,
                estimatedTime       text NOT NULL,
                numPlayers          text NOT NULL,
                rulesComplexity     text NOT NULL,
                type                text NOT NULL,
                bggRank             text NOT NULL,
                description         text NOT NULL,
                minPlayers          INTEGER NOT NULL,
                maxPlayers          INTEGER
            )`;
        await this.dao.run(sql)
    }

    async create(game) {
        const { name, year, boxArtFile, estimatedTime, numPlayers, rulesComplexity, type, bggRank, description, minPlayers, maxPlayers } = game;
        await this.dao.run(
            'INSERT INTO games_list (name, year, boxArtFile, estimatedTime, numPlayers, rulesComplexity, type,' +
            ' bggRank, description, minPlayers, maxPlayers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [ name, year, boxArtFile, estimatedTime, numPlayers, rulesComplexity, type, bggRank, description, minPlayers, maxPlayers ])
    }

    async update(game) {
        const { id, name, year, boxArtFile, estimatedTime, numPlayers, rulesComplexity, type, bggRank, description, minPlayers, maxPlayers } = game;
        await this.dao.run(
            `UPDATE games_list SET name = ?, year = ?, boxArtFile = ?, estimatedTime = ?, numPlayers = ?, 
rulesComplexity = ?, type = ?, minPlayers = ?, maxPlayers = ? WHERE id = ?`,
            [name, year, boxArtFile, estimatedTime, numPlayers, rulesComplexity, type, bggRank, description, id]
        )
    }

    async delete(id) {
        await this.dao.run(
            `DELETE FROM games_list WHERE id = ?`,
            [id]
        )
    }

    async getById(id) {
        return await this.dao.get(
            `SELECT * FROM games_list WHERE id = ?`,
            [id])
    }

    async getAll() {
        return await this.dao.all(`SELECT * FROM games_list`)
    }

    async getInterestedPlayersByRanking(game, availableUsers, ranking) {
        return await this.dao.all(
            'SELECT ul.id, ul.username FROM user_list ul, ranking_list rl WHERE rl.gameId = ? AND rl.ranking = ? AND' +
            ' rl.userId = ul.id AND rl.userId IN ( ' + availableUsers.map(function(){ return '?' }).join(',') + ' )',
            [game.id, ranking, ...(availableUsers.map(user => user.id))]
        )
    }
}

module.exports = GameRepository;