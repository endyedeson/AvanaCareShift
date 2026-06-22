-- Avana Care Shift Sample Data
-- Passwords are hashed with bcrypt: all sample passwords = "password123"

-- Admin user (password: admin123)
INSERT OR IGNORE INTO users (id, username, email, password_hash, role) VALUES
(1, 'admin', 'admin@avanacare.com', '$2a$10$8KzQMGx5C5Kc5Q5Y5Q5Zu.5Y5Q5KzQ5Y5Q5Zu5Y5Q5KzQ5Y5Q5a', 'admin');

-- Staff users (password: staff123)
INSERT OR IGNORE INTO users (id, username, email, password_hash, role) VALUES
(2, 'sarah.chen', 'sarah@avanacare.com', '$2a$10$8KzQMGx5C5Kc5Q5Y5Q5Zu.5Y5Q5KzQ5Y5Q5Zu5Y5Q5KzQ5Y5Q5a', 'staff'),
(3, 'mike.johnson', 'mike@avanacare.com', '$2a$10$8KzQMGx5C5Kc5Q5Y5Q5Zu.5Y5Q5KzQ5Y5Q5Zu5Y5Q5KzQ5Y5Q5a', 'staff'),
(4, 'emma.davis', 'emma@avanacare.com', '$2a$10$8KzQMGx5C5Kc5Q5Y5Q5Zu.5Y5Q5KzQ5Y5Q5Zu5Y5Q5KzQ5Y5Q5a', 'staff');

-- Client users (password: client123)
INSERT OR IGNORE INTO users (id, username, email, password_hash, role) VALUES
(5, 'robert.wilson', 'robert@email.com', '$2a$10$8KzQMGx5C5Kc5Q5Y5Q5Zu.5Y5Q5KzQ5Y5Q5Zu5Y5Q5KzQ5Y5Q5a', 'client'),
(6, 'mary.thompson', 'mary@email.com', '$2a$10$8KzQMGx5C5Kc5Q5Y5Q5Zu.5Y5Q5KzQ5Y5Q5Zu5Y5Q5KzQ5Y5Q5a', 'client');

-- Staff profiles
INSERT OR IGNORE INTO staff_profiles (user_id, phone, address, skills, qualifications, rating, completed_shifts, bio) VALUES
(2, '+1 (555) 123-4567', '123 Caregiver Ln, Portland, OR', 'Personal Care, Companionship, Medication Reminder', 'Certified Nursing Assistant, First Aid Certified', 4.8, 45, 'Compassionate caregiver with 5+ years of experience in home care.'),
(3, '+1 (555) 234-5678', '456 Health Ave, Portland, OR', 'Personal Care, Transportation, Meal Preparation', 'Home Health Aide, CPR Certified', 4.6, 32, 'Dedicated to providing quality care and companionship to seniors.'),
(4, '+1 (555) 345-6789', '789 Wellness Blvd, Portland, OR', 'Companionship, Live-In Care, Shopping Assistance', 'Certified Home Care Aide, Dementia Care Certified', 4.9, 58, 'Experienced in dementia care and live-in support services.');

-- Clients
INSERT OR IGNORE INTO clients (user_id, name, phone, address, emergency_contact, emergency_phone, medical_notes, preferred_caregiver_id) VALUES
(5, 'Robert Wilson', '+1 (555) 456-7890', '101 Oak Street, Portland, OR 97201', 'Sarah Wilson (Daughter)', '+1 (555) 567-8901', 'Type 2 Diabetes, mild arthritis. Needs medication reminders.', 2),
(6, 'Mary Thompson', '+1 (555) 678-9012', '202 Pine Road, Portland, OR 97202', 'James Thompson (Son)', '+1 (555) 789-0123', 'Early stage dementia, requires companionship and supervision.', 4);

-- Shifts
INSERT OR IGNORE INTO shifts (id, client_id, staff_id, date, start_time, end_time, location, service_type, hours, hourly_rate, notes, status, created_by) VALUES
(1, 1, NULL, DATE('now', '+1 day'), '09:00', '12:00', '101 Oak Street, Portland, OR', 'Personal Care', 3, 35.00, 'Morning personal care assistance', 'open', 1),
(2, 2, NULL, DATE('now', '+1 day'), '14:00', '17:00', '202 Pine Road, Portland, OR', 'Companionship', 3, 30.00, 'Afternoon companionship and activities', 'open', 1),
(3, 1, 2, DATE('now'), '10:00', '13:00', '101 Oak Street, Portland, OR', 'Medication Reminder', 3, 32.00, 'Medication management and check-in', 'assigned', 1),
(4, 2, 4, DATE('now'), '09:00', '16:00', '202 Pine Road, Portland, OR', 'Live-In Care', 7, 40.00, 'Full day live-in care supervision', 'assigned', 1),
(5, 1, 2, DATE('now', '-1 day'), '09:00', '12:00', '101 Oak Street, Portland, OR', 'Personal Care', 3, 35.00, 'Completed morning shift', 'completed', 1),
(6, 2, 4, DATE('now', '-1 day'), '14:00', '17:00', '202 Pine Road, Portland, OR', 'Companionship', 3, 30.00, 'Completed afternoon shift', 'completed', 1),
(7, 1, NULL, DATE('now', '+3 days'), '08:00', '12:00', '101 Oak Street, Portland, OR', 'Personal Care', 4, 35.00, 'Extended morning care', 'open', 1),
(8, 2, NULL, DATE('now', '+5 days'), '10:00', '14:00', '202 Pine Road, Portland, OR', 'Hospital Escort', 4, 38.00, 'Hospital appointment accompaniment', 'open', 1),
(9, 1, 3, DATE('now', '+2 days'), '13:00', '17:00', '101 Oak Street, Portland, OR', 'Transportation', 4, 32.00, 'Transport to shopping and errands', 'assigned', 1),
(10, 2, NULL, DATE('now', '-2 days'), '09:00', '12:00', '202 Pine Road, Portland, OR', 'Meal Preparation', 3, 28.00, NULL, 'cancelled', 1);

-- Shift requests
INSERT OR IGNORE INTO shift_requests (client_id, preferred_staff_id, client_name, phone, address, date, time, duration, care_type, notes, status) VALUES
(1, NULL, 'Robert Wilson', '+1 (555) 456-7890', '101 Oak Street, Portland, OR', DATE('now', '+7 days'), '09:00', 4, 'Personal Care', 'Need assistance with bathing and dressing', 'pending'),
(2, 4, 'Mary Thompson', '+1 (555) 678-9012', '202 Pine Road, Portland, OR', DATE('now', '+10 days'), '10:00', 6, 'Companionship', 'Would like Emma if available', 'pending');

-- Invoices
INSERT OR IGNORE INTO invoices (id, invoice_number, client_id, shift_id, staff_id, hours_worked, hourly_rate, subtotal, tax, tax_rate, total, status, due_date) VALUES
(1, 'INV-2024-0001', 1, 5, 2, 3.0, 35.00, 105.00, 10.50, 10, 115.50, 'paid', DATE('now', '+30 days')),
(2, 'INV-2024-0002', 2, 6, 4, 3.0, 30.00, 90.00, 9.00, 10, 99.00, 'pending', DATE('now', '+30 days')),
(3, 'INV-2024-0003', 1, 3, 2, 3.0, 32.00, 96.00, 9.60, 10, 105.60, 'pending', DATE('now', '+30 days'));

-- Invoice items
INSERT OR IGNORE INTO invoice_items (invoice_id, description, quantity, rate, amount) VALUES
(1, 'Personal Care - 3 hours', 3, 35.00, 105.00),
(2, 'Companionship - 3 hours', 3, 30.00, 90.00),
(3, 'Medication Reminder - 3 hours', 3, 32.00, 96.00);

-- Staff availability
INSERT OR IGNORE INTO staff_availability (staff_id, day_of_week, time_slot, is_active) VALUES
(2, 1, 'morning', 1), (2, 1, 'afternoon', 1), (2, 2, 'morning', 1), (2, 2, 'afternoon', 1),
(2, 3, 'morning', 1), (2, 4, 'morning', 1), (2, 4, 'afternoon', 1), (2, 5, 'morning', 1),
(3, 1, 'afternoon', 1), (3, 1, 'night', 1), (3, 2, 'afternoon', 1), (3, 3, 'afternoon', 1),
(3, 4, 'afternoon', 1), (3, 4, 'night', 1), (3, 5, 'afternoon', 1),
(4, 1, 'morning', 1), (4, 1, 'afternoon', 1), (4, 2, 'morning', 1), (4, 2, 'afternoon', 1),
(4, 3, 'morning', 1), (4, 3, 'afternoon', 1), (4, 4, 'morning', 1), (4, 5, 'morning', 1), (4, 5, 'afternoon', 1);

-- Notifications
INSERT OR IGNORE INTO notifications (user_id, title, message, type, is_read) VALUES
(2, 'New Shift Available', 'A new Personal Care shift has been posted for tomorrow morning.', 'info', 0),
(4, 'Shift Approved', 'Your Live-In Care shift for today has been approved.', 'success', 0),
(1, 'Client Request Received', 'Robert Wilson has submitted a new shift request.', 'warning', 0),
(3, 'Shift Assigned', 'You have been assigned a Transportation shift.', 'info', 0),
(2, 'Invoice Generated', 'Invoice INV-2024-0001 has been generated.', 'info', 1);

-- Settings
INSERT OR IGNORE INTO settings (key, value) VALUES
('company_name', 'Avana Care Shift'),
('company_logo', ''),
('company_address', '123 Healthcare Plaza, Portland, OR 97201'),
('company_phone', '+1 (555) 000-0000'),
('company_email', 'info@avanacare.com'),
('tax_rate', '10'),
('invoice_prefix', 'INV-2024-'),
('business_hours', 'Mon-Fri 8:00 AM - 6:00 PM'),
('currency_symbol', '$'),
('date_format', 'YYYY-MM-DD'),
('time_format', 'HH:mm'),
('backup_enabled', 'true'),
('backup_interval', '86400'),
('dark_mode', 'false');

-- Activity logs
INSERT OR IGNORE INTO activity_logs (user_id, action, description) VALUES
(1, 'system_init', 'Avana Care Shift system initialized with sample data');
