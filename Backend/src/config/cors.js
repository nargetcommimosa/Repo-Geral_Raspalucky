const corsOptions = {
  origin: [
    'https://raspa-da-sorte-theta.vercel.app',
    'https://dashboard-weld-xi.vercel.app'    
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Admin-Secret-Key'],
  credentials: true,
  optionsSuccessStatus: 200,
};

module.exports = corsOptions;