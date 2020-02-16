class UserRepository {
    constructor(dao) {
        this.dao = dao;
    }

    async createTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS user_list
            (
                id       INTEGER     NOT NULL PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL
            )`
        await this.dao.run(sql)
    }

    async create(username) {
        await this.dao.run(
            'INSERT INTO user_list (username) VALUES (?)',
            [username])
    }

    async getById(userId) {
        return await this.dao.get(
                `SELECT *
                 FROM user_list
                 WHERE id = ?`,
            [userId]
        );
    }

    async getByUsername(username) {
        return await this.dao.get(
                `SELECT *
                 FROM user_list
                 WHERE username = ?`,
            [username]
        );
    }

    async getAll() {
        return await this.dao.all(`SELECT *
                             FROM user_list`);
    };

    async deleteByUsername(username) {
        await this.dao.run(
                `DELETE
                 from user_list
                 WHERE username = ?`,
            [username])
    };

    async deleteById(userId) {
        await this.dao.run(
            `DELETE from user_list WHERE id = ?`,
            [userId]
        );
    }
}

module.exports = UserRepository;