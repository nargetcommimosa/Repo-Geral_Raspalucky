const { authenticateToken } = require('./auth'); // <- Desestruture a função aqui
const authenticateAdmin = require('./adminAuth');

module.exports = {
    authenticateToken,
    authenticateAdmin
};