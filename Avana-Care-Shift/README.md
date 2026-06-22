# Avana Care Shift

A lightweight Caregiver Shift Management System for small to medium home care agencies.

Built with **Node.js**, **Express**, **SQLite**, **Vanilla JavaScript**, and **CSS3**.

## Features

- **Role-based Authentication** — Admin, Staff (Caregivers), and Clients
- **Shift Management** — Create, assign, approve, pick, start/end with GPS check-in
- **Client Portal** — Request shifts, view bookings, invoices
- **Staff Portal** — View shifts, set availability, clock in/out, view earnings
- **Billing System** — Auto-generate invoices from completed shifts, PDF download
- **GPS Tracking** — Record location at shift start/end (only during active shifts)
- **Attendance** — Track clock in/out, hours worked, late arrivals
- **Reports** — Daily, weekly, monthly with CSV export
- **Calendar** — Color-coded monthly view
- **Notifications** — Real-time alerts for shifts, approvals, invoices
- **Dark Mode** — Toggle between light and dark themes
- **Backup & Restore** — Auto-backup SQLite database

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JS (SPA) |
| Backend | Node.js, Express.js |
| Database | SQLite (via better-sqlite3) |
| Auth | JWT (JSON Web Tokens) |
| PDF | PDFKit |

## Quick Start

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Navigate to project directory
cd Avana-Care-Shift

# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at **http://localhost:3000**

The database and sample data are created automatically on first run.

## Demo Accounts

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Staff | `sarah.chen` | `staff123` |
| Staff | `mike.johnson` | `staff123` |
| Staff | `emma.davis` | `staff123` |
| Client | `robert.wilson` | `client123` |
| Client | `mary.thompson` | `client123` |

## Project Structure

```
Avana-Care-Shift/
├── server.js              # Express app entry point
├── package.json
├── database/
│   ├── avana.db           # SQLite database (auto-created)
│   ├── schema.sql         # Table definitions
│   ├── seed.sql           # Sample data
│   └── backups/           # Auto-backups
├── routes/                # Express route definitions
├── controllers/           # Route handler logic
├── middleware/            # Auth, upload, validation
├── models/                # DB connection, helpers
├── uploads/
│   ├── profiles/          # Staff profile pictures
│   └── logos/             # Company logos
├── public/
│   ├── css/               # Stylesheets
│   ├── js/                # Frontend JavaScript
│   │   ├── app.js         # App bootstrap & router
│   │   ├── api.js         # API client
│   │   ├── auth.js        # Auth state management
│   │   ├── router.js      # SPA hash router
│   │   ├── utils.js       # UI helpers
│   │   └── pages/         # Page components
│   ├── images/
│   └── icons/
└── views/
    └── index.html         # SPA shell
```

## API Endpoints

### Authentication
- `POST /api/auth/login` — Login
- `POST /api/auth/register` — Client registration
- `GET /api/auth/me` — Current user
- `PUT /api/auth/password` — Change password

### Shifts
- `GET /api/shifts` — List shifts (with filters)
- `POST /api/shifts` — Create shift
- `PUT /api/shifts/:id` — Update shift
- `DELETE /api/shifts/:id` — Delete shift
- `PUT /api/shifts/:id/assign` — Assign staff
- `POST /api/shifts/:id/pick` — Staff picks shift
- `PUT /api/shifts/:id/start` — GPS check-in
- `PUT /api/shifts/:id/end` — GPS check-out

### Staff, Clients, Invoices, Reports, Settings
Full RESTful CRUD for all resources. See route files for details.

## Security

- Passwords hashed with bcryptjs
- JWT-based authentication with 24h expiry
- Role-based access control middleware
- Input validation on all endpoints
- SQL injection protection via parameterized queries
- XSS protection via escapeHtml utility

## Developer

Developed by **Endy Edeson**

## License

MIT
