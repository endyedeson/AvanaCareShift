const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

let pool = null;

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'avana_care_shift',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

async function getPool() {
  if (pool) return pool;
  pool = mysql.createPool(DB_CONFIG);
  return pool;
}

async function getDb() {
  return getPool();
}

async function initDb() {
  const p = await getPool();
  await p.execute('SELECT 1');
  console.log('MySQL connected successfully.');
  return p;
}

async function query(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function getSettingsFromRows(rows) {
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

async function run(sql, params = []) {
  const p = await getPool();
  const [result] = await p.execute(sql, params);
  return result;
}

module.exports = { getDb, initDb, query, queryOne, run, getSettingsFromRows, closeDb };
