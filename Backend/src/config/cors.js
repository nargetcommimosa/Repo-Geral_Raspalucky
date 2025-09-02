// Configuração de CORS para diferentes ambientes
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Admin-Secret-Key'],
  credentials: true,
  optionsSuccessStatus: 200,
};

module.exports = corsOptions;