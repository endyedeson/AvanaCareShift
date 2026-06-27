-- Avana Care Shift Database Schema
-- MySQL 8+

CREATE DATABASE IF NOT EXISTS avana_care_shift
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE avana_care_shift;

-- Users table (all login accounts)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','staff','client') NOT NULL,
  avatar VARCHAR(500) DEFAULT NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_status (status)
) ENGINE=InnoDB;

-- Staff profiles (extends users with role='staff')
CREATE TABLE IF NOT EXISTS staff_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  phone VARCHAR(50) DEFAULT '',
  address VARCHAR(500) DEFAULT '',
  skills TEXT DEFAULT '',
  qualifications TEXT DEFAULT '',
  rating DECIMAL(3,2) DEFAULT 0.00,
  completed_shifts INT DEFAULT 0,
  bio TEXT DEFAULT '',
  emergency_contact VARCHAR(255) DEFAULT '',
  emergency_phone VARCHAR(50) DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Clients (extends users with role='client')
CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT '',
  address VARCHAR(500) DEFAULT '',
  emergency_contact VARCHAR(255) DEFAULT '',
  emergency_phone VARCHAR(50) DEFAULT '',
  medical_notes TEXT DEFAULT '',
  preferred_caregiver_id INT DEFAULT NULL,
  notes TEXT DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (preferred_caregiver_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_clients_name (name)
) ENGINE=InnoDB;

-- Shifts
CREATE TABLE IF NOT EXISTS shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  staff_id INT DEFAULT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location VARCHAR(500) DEFAULT '',
  service_type VARCHAR(100) NOT NULL,
  hours DECIMAL(6,2) DEFAULT 0.00,
  hourly_rate DECIMAL(8,2) DEFAULT 0.00,
  notes TEXT DEFAULT '',
  status ENUM('open','assigned','in_progress','completed','cancelled') DEFAULT 'open',
  created_by INT NOT NULL,
  approved_by INT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  INDEX idx_shifts_date (date),
  INDEX idx_shifts_status (status),
  INDEX idx_shifts_staff (staff_id),
  INDEX idx_shifts_client (client_id)
) ENGINE=InnoDB;

-- Shift requests (from clients)
CREATE TABLE IF NOT EXISTS shift_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT DEFAULT NULL,
  preferred_staff_id INT DEFAULT NULL,
  client_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT '',
  address VARCHAR(500) DEFAULT '',
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration DECIMAL(6,2) DEFAULT 0.00,
  care_type VARCHAR(100) DEFAULT '',
  notes TEXT DEFAULT '',
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (preferred_staff_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_shift_requests_status (status),
  INDEX idx_shift_requests_date (date)
) ENGINE=InnoDB;

-- Attendance records
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shift_id INT NOT NULL,
  staff_id INT NOT NULL,
  clock_in DATETIME DEFAULT NULL,
  clock_out DATETIME DEFAULT NULL,
  hours_worked DECIMAL(6,2) DEFAULT 0.00,
  late_minutes INT DEFAULT 0,
  overtime DECIMAL(6,2) DEFAULT 0.00,
  date DATE NOT NULL,
  status ENUM('present','late','absent') DEFAULT 'present',
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_attendance_date (date),
  INDEX idx_attendance_staff (staff_id),
  INDEX idx_attendance_shift (shift_id)
) ENGINE=InnoDB;

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  client_id INT NOT NULL,
  shift_id INT DEFAULT NULL,
  staff_id INT DEFAULT NULL,
  hours_worked DECIMAL(6,2) DEFAULT 0.00,
  hourly_rate DECIMAL(8,2) DEFAULT 0.00,
  subtotal DECIMAL(10,2) DEFAULT 0.00,
  tax DECIMAL(10,2) DEFAULT 0.00,
  tax_rate DECIMAL(5,2) DEFAULT 0.00,
  total DECIMAL(10,2) DEFAULT 0.00,
  status ENUM('pending','paid','overdue','cancelled') DEFAULT 'pending',
  due_date DATE NOT NULL,
  paid_at DATETIME DEFAULT NULL,
  notes TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
  FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_invoices_status (status),
  INDEX idx_invoices_client (client_id),
  INDEX idx_invoices_number (invoice_number)
) ENGINE=InnoDB;

-- Invoice line items
CREATE TABLE IF NOT EXISTS invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(8,2) DEFAULT 1.00,
  rate DECIMAL(10,2) DEFAULT 0.00,
  amount DECIMAL(10,2) DEFAULT 0.00,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  INDEX idx_invoice_items_invoice (invoice_id)
) ENGINE=InnoDB;

-- GPS tracking logs
CREATE TABLE IF NOT EXISTS gps_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shift_id INT NOT NULL,
  staff_id INT NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  action ENUM('start','end','track') NOT NULL,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_gps_shift (shift_id),
  INDEX idx_gps_staff (staff_id)
) ENGINE=InnoDB;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info','success','warning','danger') DEFAULT 'info',
  is_read TINYINT(1) DEFAULT 0,
  link VARCHAR(500) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user (user_id),
  INDEX idx_notifications_read (is_read)
) ENGINE=InnoDB;

-- Staff availability (weekly schedule)
CREATE TABLE IF NOT EXISTS staff_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  day_of_week TINYINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time_slot ENUM('morning','afternoon','night') NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_staff_availability (staff_id, day_of_week, time_slot),
  INDEX idx_availability_staff (staff_id)
) ENGINE=InnoDB;

-- Company settings
CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL
) ENGINE=InnoDB;

-- Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_activity_user (user_id),
  INDEX idx_activity_created (created_at)
) ENGINE=InnoDB;
