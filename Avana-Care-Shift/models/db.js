const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'database', 'avana.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'database', 'schema.sql');
const SEED_PATH = path.join(__dirname, '..', 'database', 'seed.sql');

let db = null;

function getDb() {
  if (db) return db;

  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  runSchema();
  runSeedIfEmpty();

  return db;
}

function runSchema() {
  if (fs.existsSync(SCHEMA_PATH)) {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);
  }
}

function runSeedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (row.count === 0 && fs.existsSync(SEED_PATH)) {
    const seed = fs.readFileSync(SEED_PATH, 'utf8');
    db.exec(seed);
    // Re-hash passwords with proper bcrypt
    const bcrypt = require('bcryptjs');
    const users = [
      { id: 1, username: 'admin', password: 'admin123' },
      { id: 2, username: 'sarah.chen', password: 'staff123' },
      { id: 3, username: 'mike.johnson', password: 'staff123' },
      { id: 4, username: 'emma.davis', password: 'staff123' },
      { id: 5, username: 'robert.wilson', password: 'client123' },
      { id: 6, username: 'mary.thompson', password: 'client123' }
    ];
    const updateStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    const updateAll = () => {
      for (const u of users) {
        const hash = bcrypt.hashSync(u.password, 10);
        updateStmt.run(hash, u.id);
      }
    };
    updateAll();
  }
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function backupDb() {
  const backupDir = path.join(__dirname, '..', 'database', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `avana-${timestamp}.db`);

  if (db) {
    db.close();
    fs.copyFileSync(DB_PATH, backupPath);
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
}

function restoreDb(backupPath) {
  if (!fs.existsSync(backupPath)) throw new Error('Backup file not found');
  closeDb();
  fs.copyFileSync(backupPath, DB_PATH);
  return getDb();
}

module.exports = { getDb, closeDb, backupDb, restoreDb };
