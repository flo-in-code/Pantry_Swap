//preps the database before the tests
const { resetDb } = require("./db")

module.exports = async () => { //exports a function that calls resetDb
    await resetDb();
}
