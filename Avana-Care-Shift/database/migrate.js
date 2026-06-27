/**
 * Avana Care Shift - SQLite to MySQL Migration Script
 *
 * Run: node database/migrate.js
 * 
 * Prerequisites:
 *   1. Install mysql2: npm install mysql2
 *   2. Create a MySQL database and user
 *   3. Run schema.mysql.sql to create tables
 *   4. Set environment variables or edit config below
 *   5. The SQLite database must exist at database/avana.db
 */

const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

// MySQL configuration - EDIT THESE
const MYSQL_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'avana_care_shift',
  connectionLimit: 10,
  multipleStatements: true
};

// SQLite database path
const SQLITE_PATH = path.join(__dirname, 'avana.db');

// Tables to migrate in order (respects foreign keys)
const TABLES = [
  'users',
  'staff_profiles',
  'clients',
  'shifts',
  'shift_requests',
  'attendance',
  'invoices',
  'invoice_items',
  'gps_logs',
  'notifications',
  'staff_availability',
  'settings',
  'activity_logs'
];

async function migrate() {
  console.log('=== Avana Care Shift Migration: SQLite -> MySQL ===\n');

  // 1. Check SQLite database exists
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`SQLite database not found at: ${SQLITE_PATH}`);
    console.error('Make sure the application has been run at least once to create it.');
    process.exit(1);
  }

  // 2. Load SQLite
  let sqliteDb;
  try {
    const { DatabaseSync } = require('node:sqlite');
    sqliteDb = new DatabaseSync(SQLITE_PATH);
    console.log('SQLite database loaded successfully.');
  } catch (err) {
    console.error('Failed to load SQLite database:', err.message);
    console.error('Make sure you are using Node.js 22+ with built-in SQLite support.');
    process.exit(1);
  }

  // 3. Connect to MySQL
  let mysqlConn;
  try {
    mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
    console.log(`Connected to MySQL at ${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}/${MYSQL_CONFIG.database}`);
  } catch (err) {
    console.error('Failed to connect to MySQL:', err.message);
    console.error('Please check your MySQL configuration.');
    process.exit(1);
  }

  // 4. Run MySQL schema
  console.log('\nRunning MySQL schema...');
  try {
    const schemaPath = path.join(__dirname, 'schema.mysql.sql');
    let schemaSql = fs.readFileSync(schemaPath, 'utf8');
    // Remove USE database and CREATE DATABASE lines since we're already connected
    schemaSql = schemaSql.replace(/CREATE DATABASE.*?;\s*/i, '');
    schemaSql = schemaSql.replace(/USE .*?;\s*/i, '');
    // Split by semicolons and execute each statement
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0);
    for (const stmt of statements) {
      try {
        await mysqlConn.execute(stmt.trim());
      } catch (stmtErr) {
        // Ignore "already exists" errors
        if (stmtErr.errno !== 1050) {
          console.warn(`  Warning executing: ${stmt.trim().substring(0, 60)}...`);
          console.warn(`  ${stmtErr.message}`);
        }
      }
    }
    console.log('MySQL schema applied.');
  } catch (err) {
    console.error('Failed to apply MySQL schema:', err.message);
    await mysqlConn.end();
    process.exit(1);
  }

  // 5. Migrate data
  console.log('\nMigrating data...');
  let totalRows = 0;

  for (const table of TABLES) {
    try {
      // Read from SQLite
      const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
      if (rows.length === 0) {
        console.log(`  ${table}: 0 rows (empty)`);
        continue;
      }

      // Build INSERT query
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const colNames = columns.map(c => '`' + c.replace(/`/g, '``') + '`').join(', ');
      const insertSql = `INSERT IGNORE INTO ${table} (${colNames}) VALUES (${placeholders})`;

      // Insert in batches of 50
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const stmt = await mysqlConn.prepare(insertSql);
        for (const row of batch) {
          const values = columns.map(col => {
            const val = row[col];
            return val !== null && val !== undefined ? val : null;
          });
          try {
            await stmt.execute(values);
            inserted++;
          } catch (insertErr) {
            // Log and continue
            console.warn(`    Error inserting row in ${table}: ${insertErr.message.substring(0, 100)}`);
          }
        }
        await stmt.close();
      }

      totalRows += inserted;
      console.log(`  ${table}: ${inserted}/${rows.length} rows migrated`);
    } catch (err) {
      console.error(`  ${table}: ERROR - ${err.message}`);
    }
  }

  // 6. Close connections
  sqliteDb.close();
  await mysqlConn.end();

  // 7. Summary
  console.log(`\n=== Migration complete ===`);
  console.log(`Total rows migrated: ${totalRows}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Copy .env.example to .env and configure MySQL credentials`);
  console.log(`  2. Run: npm install`);
  console.log(`  3. Run: npm start`);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
