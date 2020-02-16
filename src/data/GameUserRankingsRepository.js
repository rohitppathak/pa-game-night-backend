class GameUserRankingsRepository {
  constructor(dao) {
    this.dao = dao;
  }

  async createTable() {
    const sql = `
        CREATE TABLE IF NOT EXISTS ranking_list
        (
            gameId  INTEGER NOT NULL,
            userId  INTEGER NOT NULL,
            ranking INTEGER NOT NULL,
            FOREIGN KEY (gameId) REFERENCES games_list (id),
            FOREIGN KEY (userId) REFERENCES user_list (id),
            PRIMARY KEY (gameId, userId)
        )`
    await this.dao.run(sql)
  }

  async create(gameUserRanking) {
    const {gameId, userId, ranking} = gameUserRanking
    await this.dao.run(
        'INSERT INTO ranking_list (gameId, userId, ranking) VALUES (?, ?, ?)',
        [gameId, userId, ranking])
  }

  async update(user) {
    const {gameId, userId, ranking} = user;
    await this.dao.run(
          `UPDATE ranking_list
           SET gameId  = ?,
               userId  = ?,
               ranking = ?
           WHERE gameId = ?
             and userId = ?`,
        [gameId, userId, ranking]
    )
  }

  async getInterestedPlayersForGame(gameId) {
    return await this.dao.all(
          `SELECT ul.id, ul.username, rl.ranking
           FROM user_list ul,
                ranking_list rl
           WHERE rl.gameId = ?
             AND rl.userId = ul.id`,
        [gameId]
    );
  }

  async removeUserRankings(userId) {
    await this.dao.run(
        'DELETE FROM ranking_list WHERE userId = ?',
        [userId]
    );
  }

  async getAll() {
    return await this.dao.all(`SELECT *
                               FROM ranking_list`)
  }

  async deleteUserFromGame(gameId, userId) {
    await this.dao.run(
          `DELETE
           FROM ranking_list
           WHERE gameId = ?
             and userId = ?`,
        [gameId, userId]
    );
  };

  async getRankingsForUser(userId) {
    return await this.dao.all(
          `SELECT *
           FROM ranking_list
           WHERE userId = ?`,
        [userId]
    );
  };

  async getRankingsForGames(games) {
    return await this.dao.all(
        'SELECT rl.gameId, rl.ranking, rl.userId, ul.username, gl.name, gl.minPlayers, gl.maxPlayers '
        + 'FROM ranking_list rl, user_list ul, games_list gl WHERE rl.gameId = gl.id AND '
        + 'rl.userId = ul.id AND '
        + 'gameId IN ( '
        + games.map(() => {return '?'}).join(',') + ' )',
        [...(games.map(game => game.id))]
    );
  };

  async updateRankingsForUser(userId) {
    const otherGameRankings = await this.getRankingsForUser(userId);

    if (otherGameRankings.length === 1) {
      await this.dao.run(
            `UPDATE ranking_list
             SET ranking = 1
             WHERE userId = ?`,
          [userId]
      );
    } else {
      otherGameRankings
      .map(gameRanking => {
        return gameRanking.ranking
      })
      .sort((a, b) => {
        return a - b
      })
      .forEach(async (ranking, index) => {
        switch (ranking) {
          case 3:
            await this.dao.run(
                  `UPDATE ranking_list
                   SET ranking = 2
                   WHERE userId = ?
                     AND ranking = ?`,
                [userId, ranking]
            );
          case 2:
            if (index === 0) {
              await this.dao.run(
                    `UPDATE ranking_list
                     SET ranking = 1
                     WHERE userId = ?
                       AND ranking = ?`,
                  [userId, ranking]
              );
              break;
            } else {
              break;
            }
          case 1:
            break;
          default:
            console.log("Error: invalid ranking in database: " + ranking)
        }
      });
    }
  }
}

module.exports = GameUserRankingsRepository;
