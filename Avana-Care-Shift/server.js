const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { getDb, backupDb } = require('./models/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve the main HTML for all non-API routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/shifts', require('./routes/shifts'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/shift-requests', require('./routes/shiftRequests'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/gps', require('./routes/gps'));
app.use('/api/upload', require('./routes/upload'));

// Fallback for SPA
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found.' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// Initialize database and start server
try {
  getDb();
  console.log('Database initialized successfully.');

  app.listen(PORT, () => {
    console.log(`\n  Avana Care Shift Server`);
    console.log(`  ─────────────────────`);
    console.log(`  Running on: http://localhost:${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
} catch (err) {
  console.error('Failed to initialize database:', err);
  process.exit(1);
}

// Auto-backup every 24 hours
setInterval(() => {
  try {
    backupDb();
  } catch (err) {
    console.error('Auto-backup failed:', err);
  }
}, 24 * 60 * 60 * 1000);

module.exports = app;
