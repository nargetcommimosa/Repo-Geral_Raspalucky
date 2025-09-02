const express = require('express');
const cors = require('cors');
const corsOptions = require('./cors');

// Configuração centralizada de middlewares
function setupMiddleware(app) {
  // CORS
  app.use(cors(corsOptions));

  // Parse JSON bodies
  app.use(express.json({ limit: '10mb' }));

  // Parse URL-encoded bodies
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging de requests (apenas em desenvolvimento)
  if (process.env.NODE_ENV !== 'production') {
    const morgan = require('morgan');
    app.use(morgan('combined'));
  }

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });
}

module.exports = setupMiddleware;