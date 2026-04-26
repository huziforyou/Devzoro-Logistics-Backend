const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

const errorHandler = require('./middleware/error');
const connectDB = require('./config/db');

// Connect to Database (Required for serverless as server.js is not the entry point)
connectDB().catch(err => console.error('Database connection failed', err));

const app = express();

// 1. CORS Configuration (MUST BE FIRST)
const allowedOrigins = [
  'https://devzoro-logistics.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      const error = new Error('Not allowed by CORS');
      error.statusCode = 403;
      callback(error);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request Logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Security Middleware (Disabled for now)
// app.use(helmet(...));

// Body Parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));

// Rate Limiting (DISABLED for testing)
// const limiter = rateLimit({ ... });

// Serve static files from uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/auth');
const dispatchRoutes = require('./routes/dispatch');
const userRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');
const vehicleRoutes = require('./routes/vehicles');
const driverRoutes = require('./routes/drivers');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/admin', adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Smart Vehicle Dispatch Portal API' });
});

// Error Handling Middleware
app.use(errorHandler);

module.exports = app;
