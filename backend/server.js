const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { pool, testConnection } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const destinationRoutes = require('./routes/destinationRoutes');
const packageRoutes = require('./routes/packageRoutes');
const preferenceRoutes = require('./routes/preferenceRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const itineraryRoutes = require('./routes/itineraryRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function validateEnv() {
  const required = ['JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  
  if (config.jwt.secret === 'travelmind_ai_secret_key_change_in_production' && config.nodeEnv === 'production') {
    console.error('ERROR: Using default JWT secret in production. Set JWT_SECRET in .env');
    process.exit(1);
  }
}

async function checkDatabaseHealth() {
  try {
    const connection = await pool.getConnection();
    await connection.execute('SELECT 1');
    connection.release();
    return true;
  } catch (error) {
    return false;
  }
}

app.get('/api/health', async (req, res) => {
  const dbConnected = await checkDatabaseHealth();
  const statusCode = dbConnected ? 200 : 503;
  
  res.status(statusCode).json({
    success: dbConnected,
    service: 'TravelMind AI API',
    status: dbConnected ? 'healthy' : 'unhealthy',
    environment: config.nodeEnv,
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'TravelMind AI API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me'
      },
      destinations: {
        list: 'GET /api/destinations',
        detail: 'GET /api/destinations/:id',
        packages: 'GET /api/destinations/:id/packages',
        create: 'POST /api/destinations (admin)',
        update: 'PUT /api/destinations/:id (admin)',
        delete: 'DELETE /api/destinations/:id (admin)'
      },
      packages: {
        list: 'GET /api/packages',
        detail: 'GET /api/packages/:id',
        create: 'POST /api/packages (admin)',
        update: 'PUT /api/packages/:id (admin)',
        delete: 'DELETE /api/packages/:id (admin)'
      },
      preferences: {
        get: 'GET /api/preferences',
        save: 'POST /api/preferences',
        update: 'PUT /api/preferences'
      },
      recommendations: {
        generate: 'POST /api/recommendations',
        saved: 'GET /api/recommendations'
      },
      itinerary: {
        generate: 'POST /api/itinerary',
        detail: 'GET /api/itinerary/:id',
        list: 'GET /api/itinerary'
      },
      bookings: {
        create: 'POST /api/bookings',
        list: 'GET /api/bookings',
        detail: 'GET /api/bookings/:id',
        cancel: 'PUT /api/bookings/:id/cancel'
      },
      admin: {
        bookingsList: 'GET /api/admin/bookings',
        bookingStatus: 'PUT /api/admin/bookings/:id/status',
        reviewsList: 'GET /api/admin/reviews',
        reviewDelete: 'DELETE /api/admin/reviews/:id'
      },
      reviews: {
        submit: 'POST /api/reviews',
        list: 'GET /api/reviews/:destinationId',
        summary: 'GET /api/reviews/:destinationId/summary',
        update: 'PUT /api/reviews/:id',
        delete: 'DELETE /api/reviews/:id'
      },
      chatbot: {
        message: 'POST /api/chatbot/message',
        session: 'GET /api/chatbot/session?session_id=<id>',
        clearSession: 'DELETE /api/chatbot/session?session_id=<id>'
      }
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/preferences', preferenceRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/itinerary', itineraryRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/admin', adminRoutes);

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

async function startServer() {
  validateEnv();
  
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.warn('Warning: Starting server without database connection');
  }
  
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;