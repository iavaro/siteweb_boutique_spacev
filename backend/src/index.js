/**
 * SpaceV SaaS - Main Express Server
 * =================================
 * This is the main entry point for the SpaceV backend.
 * It sets up Express, middleware, routes, and connects to the database.
 * 
 * @author SpaceV
 * @version 1.0.0
 */

// ==============================================
// Imports & Configuration
// ==============================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const invoiceRoutes = require('./routes/invoices');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhooks');
const analyticsRoutes = require('./routes/analytics');
// FiveM RP Routes
const fivemRoutes = require('./routes/fivem');
const leaderboardRoutes = require('./routes/leaderboards');
const playerRoutes = require('./routes/players');
const adminRpRoutes = require('./routes/admin-rp');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { authenticateToken } = require('./middlewares/auth');

// Import services
const { initDiscordBot } = require('./services/discordBot');
const { initTebexWebhook } = require('./services/tebex');

// ==============================================
// Initialize Express App
// ==============================================
const app = express();
const PORT = process.env.PORT || 3000;

// ==============================================
// Security & Core Middleware
// ==============================================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      connectSrc: ["'self'", "https://api.tebex.io"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.SITE_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // More permissive for development
  message: { error: 'API rate limit exceeded.' },
});

app.use('/api/', apiLimiter);
app.use(limiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../../frontend')));
app.use('/public', express.static(path.join(__dirname, '../../public')));

// ==============================================
// API Routes
// ==============================================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Auth routes (login, register, Discord OAuth)
app.use('/api/auth', authRoutes);

// Product routes (catalog, categories)
app.use('/api/products', productRoutes);

// Order routes (cart, checkout)
app.use('/api/orders', orderRoutes);

// User routes (dashboard, profile)
app.use('/api/users', userRoutes);

// Invoice routes
app.use('/api/invoices', invoiceRoutes);

// Admin routes (protected)
app.use('/api/admin', authenticateToken, adminRoutes);

// Webhook routes (Tebex, Discord)
app.use('/api/webhooks', webhookRoutes);

// Analytics routes
app.use('/api/analytics', analyticsRoutes);

// FiveM RP Routes (public)
app.use('/api/leaderboards', leaderboardRoutes);
app.use('/api/players', playerRoutes);

// FiveM RP Routes (server-to-server, API key protected)
app.use('/api/fivem', fivemRoutes);

// Admin RP Routes (protected)
app.use('/api/admin-rp', authenticateToken, adminRpRoutes);

// ==============================================
// Frontend Pages Routes
// ==============================================

// Map HTML pages to routes
const frontendPages = [
  { route: '/', file: 'home.html', name: 'Home' },
  { route: '/store', file: 'store.html', name: 'Store' },
  { route: '/cart', file: 'cart.html', name: 'Cart' },
  { route: '/login', file: 'login.html', name: 'Login' },
  { route: '/register', file: 'register.html', name: 'Register' },
  { route: '/dashboard', file: 'dashboard.html', name: 'Dashboard' },
  { route: '/admin', file: 'admin.html', name: 'Admin Dashboard' },
  { route: '/profile', file: 'profile.html', name: 'Profile' },
  { route: '/support', file: 'support.html', name: 'Support' },
  { route: '/checkout', file: 'checkout.html', name: 'Checkout' },
  { route: '/invoices', file: 'invoices.html', name: 'Invoices' },
  { route: '/terms', file: 'terms.html', name: 'Terms of Service' },
  { route: '/privacy', file: 'privacy.html', name: 'Privacy Policy' },
  // FiveM RP Pages
  { route: '/leaderboards', file: 'leaderboards.html', name: 'Leaderboards' },
  { route: '/players/:id', file: 'player.html', name: 'Player Profile' },
];

// Serve frontend pages
frontendPages.forEach(({ route, file }) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend', file));
  });
});

// Redirect unknown routes to home
app.get('*', (req, res) => {
  // For API routes, return 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  // For frontend routes, redirect to home
  res.redirect('/');
});

// ==============================================
// Error Handling Middleware
// ==============================================
app.use(notFoundHandler);
app.use(errorHandler);

// ==============================================
// Start Server
// ==============================================
const startServer = async () => {
  try {
    // Test database connection
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Initialize Discord bot (non-blocking)
    initDiscordBot().catch(err => {
      console.warn('⚠️ Discord bot initialization failed:', err.message);
    });

    // Initialize Tebex webhook endpoint (non-blocking)
    initTebexWebhook(app).catch(err => {
      console.warn('⚠️ Tebex webhook setup failed:', err.message);
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    🚀 SpaceV Server                         ║
║═══════════════════════════════════════════════════════════║
║  🌐 Server URL:    http://localhost:${PORT}                   ║
║  📦 API Endpoint:  http://localhost:${PORT}/api                ║
║  🎨 Frontend:      http://localhost:${PORT}                     ║
║  📊 Admin Panel:   http://localhost:${PORT}/admin               ║
║═══════════════════════════════════════════════════════════║
║  Environment: ${process.env.NODE_ENV || 'development'}                              ║
║  Database:    MySQL (connected)                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

startServer();

module.exports = app;

