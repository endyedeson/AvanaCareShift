require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { initDb } = require('./models/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found.' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

async function start() {
  try {
    await initDb();
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
}

start();

module.exports = app;
