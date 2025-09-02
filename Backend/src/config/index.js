// Ponto único de exportação para todas as configurações
const database = require('./database');
const corsOptions = require('./cors');
const constants = require('./constants');
const setupMiddleware = require('./middleware');

module.exports = {
  db: database,
  corsOptions,
  constants,
  setupMiddleware,
};