-- Avana Care Shift Database Schema
-- SQLite 3

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Users table (all login accounts)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','staff','client')),
  avatar TEXT DEFAULT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Staff profiles (extends users with role='staff')
CREATE TABLE IF NOT EXISTS staff_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  skills TEXT DEFAULT '',
  qualifications TEXT DEFAULT '',
  rating REAL DEFAULT 0.0,
  completed_shifts INTEGER DEFAULT 0,
  bio TEXT DEFAULT '',
  emergency_contact TEXT DEFAULT '',
  emergency_phone TEXT DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Clients (extends users with role='client')
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  emergency_contact TEXT DEFAULT '',
  emergency_phone TEXT DEFAULT '',
  medical_notes TEXT DEFAULT '',
  preferred_caregiver_id INTEGER DEFAULT NULL,
  notes TEXT DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (preferred_caregiver_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Shifts
CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  staff_id INTEGER DEFAULT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT DEFAULT '',
  service_type TEXT NOT NULL,
  hours REAL DEFAULT 0,
  hourly_rate REAL DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'open' CHECK(status IN ('open','assigned','in_progress','completed','cancelled')),
  created_by INTEGER NOT NULL,
  approved_by INTEGER DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Shift requests (from clients)
CREATE TABLE IF NOT EXISTS shift_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  preferred_staff_id INTEGER DEFAULT NULL,
  client_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  duration REAL DEFAULT 0,
  care_type TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (preferred_staff_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Attendance records
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL,
  staff_id INTEGER NOT NULL,
  clock_in DATETIME DEFAULT NULL,
  clock_out DATETIME DEFAULT NULL,
  hours_worked REAL DEFAULT 0,
  late_minutes INTEGER DEFAULT 0,
  overtime REAL DEFAULT 0,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'present' CHECK(status IN ('present','late','absent')),
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  client_id INTEGER NOT NULL,
  shift_id INTEGER DEFAULT NULL,
  staff_id INTEGER DEFAULT NULL,
  hours_worked REAL DEFAULT 0,
  hourly_rate REAL DEFAULT 0,
  subtotal REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  total REAL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','overdue','cancelled')),
  due_date TEXT NOT NULL,
  paid_at DATETIME DEFAULT NULL,
  notes TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
  FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Invoice line items
CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity REAL DEFAULT 1,
  rate REAL DEFAULT 0,
  amount REAL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- GPS tracking logs
CREATE TABLE IF NOT EXISTS gps_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL,
  staff_id INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  action TEXT NOT NULL CHECK(action IN ('start','end','track')),
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK(type IN ('info','success','warning','danger')),
  is_read INTEGER DEFAULT 0,
  link TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Staff availability (weekly schedule)
CREATE TABLE IF NOT EXISTS staff_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
  time_slot TEXT NOT NULL CHECK(time_slot IN ('morning','afternoon','night')),
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(staff_id, day_of_week, time_slot)
);

-- Company settings
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL
);

-- Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
