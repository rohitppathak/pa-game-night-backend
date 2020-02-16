class AssignedUserGameRepository {
  constructor(dao) {
    this.dao = dao;
  }

  async createTable() {
    const sql = `
       CREATE TABLE IF NOT EXISTS assigned_user_game
    (
        userId  INTEGER NOT NULL UNIQUE,
        gameId  INTEGER NOT NULL,
        ranking INTEGER NOT NULL,
        FOREIGN KEY (gameId) REFERENCES games_list(id),
        FOREIGN KEY (userId) REFERENCES user_list(id),
        PRIMARY KEY (userId, gameId)
    )`

    await this.dao.run(sql);
  }

  async getAll() {
    const sql = `
      SELECT * FROM assigned_user_game`;
    return await this.dao.all(sql);
  }

  async insertAll(games) {
    if (games === []) return;
    const userGameList = [];
    for (const game of games) {
      for (const user of game.assignedPlayers) {
        userGameList.push({userId: user.id, gameId: game.id, ranking: user.ranking});
      }
    }

    const sql = `
      INSERT INTO assigned_user_game (gameId, userId, ranking) VALUES ` +
        userGameList.map(userGame => `(${userGame.gameId},${userGame.userId},${userGame.ranking})`).join(', ');

    await this.dao.run(sql);
  }

  async clearAll() {
    const sql = `DELETE FROM assigned_user_game`;

    await this.dao.run(sql);
  }
}

module.exports = AssignedUserGameRepository;
