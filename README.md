// README.md - Project documentation
# Karate School Attendance Management System

A comprehensive TypeScript-based attendance management system for karate schools with MongoDB backend and React frontend.

## Features

### Core Functionality
-  **Authentication & Authorization**: Secure JWT-based authentication with role-based access control (RBAC)
-  **Student management** with configurable categories and belt level tracking
-  **Class scheduling and management** with multi-category support
-  **Real-time attendance tracking** with category-specific recording
-  **Session-specific instructors and notes**: Override class default instructor and add notes for individual sessions
-  **Enhanced calendar view**: 
   - Display weekday names instead of numeric values
   - Show attendance count for each session
   - Display session-specific instructor (falls back to class default instructor)
-  **Dashboard**: View today's schedules with session-specific instructor display
-  **User management**: Admin-only user creation with 4 role types (admin, instructor, staff, student)
-  **Configuration management**: YAML-based category and belt level configuration
-  **Teacher-friendly interface** optimized for tablets
-  **Automatic detection** of next upcoming class
-  **Historical attendance editing** with session notes
-  **Comprehensive reporting**

### Technical Features
-  **TypeScript** for type safety across frontend and backend
-  **MongoDB** with Mongoose ODM
-  **Express.js** REST API with JWT authentication
-  **Next.js 16** with App Router for frontend
-  **NextAuth.js** for session management
-  **Responsive web interface** with shadcn/ui components
-  **Data validation** with Joi and dynamic config validation
-  **YAML configuration** for semi-static data management
-  **Calendar integration** with FullCalendar
-  **Time-based logic** for class management
-  **Rate limiting** to prevent brute force attacks
-  **bcrypt** password hashing

## Quick Start

### Prerequisites
- Node.js 16+
- MongoDB 4.4+ (or Docker for containerized MongoDB)
- pnpm (recommended) or npm/yarn
- Docker & Docker Compose (optional, for MongoDB)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd attendance_ogs
```

2. **Install backend dependencies**
```bash
# Install root dependencies
pnpm install

# Install frontend dependencies
cd frontend && pnpm install && cd ..
```

3. **Set up environment variables**

**Backend (.env in project root):**
```bash
cp .env.example .env
# Edit .env with your MongoDB credentials and desired ports
# Generate secure random strings for JWT_SECRET, JWT_REFRESH_SECRET
```

**Frontend (.env.local in frontend directory):**
```bash
cd frontend
cat > .env.local << EOF
# Next.js Server Configuration
PORT=4001

# NextAuth Configuration
NEXTAUTH_SECRET=dev_secret_change_me
NEXTAUTH_URL=http://localhost:4001

# Backend API URL (must match PORT in root .env)
NEXT_PUBLIC_API_URL=http://localhost:4000
EOF
cd ..
```

4. **Start MongoDB** (choose one)

**Option A: Using Docker (recommended for development)**
```bash
docker-compose up -d
```
This will start MongoDB on port 27019 (mapped from container port 27017).

**Option B: Using local MongoDB**
```bash
mongod
```
Ensure MongoDB is running on port 27017 (default), and update MONGODB_URI in .env accordingly.

5. **Create initial admin user** (first time only)
```bash
pnpm run seed:admin
```

This creates an admin account:
- 📧 Email: `admin@karateattendance.com`
- 🔑 Password: `ChangeMe123!`
- ⚠️ **Change this password immediately after first login!**

6. **Run the development servers**

```bash
# Start both backend and frontend together
pnpm run dev:all
```

Or run separately:
```bash
# Terminal 1 - Backend on http://localhost:4000
pnpm run dev

# Terminal 2 - Frontend on http://localhost:4001
cd frontend && pnpm run dev
```

### Accessing the Application

- **Frontend**: http://localhost:4001
- **Backend API**: http://localhost:4000
- **API Health Check**: http://localhost:4000/api/health
- **Login Page**: http://localhost:4001/login

Default credentials:
- 📧 Email: `admin@karateattendance.com`
- 🔑 Password: `ChangeMe123!`

⚠️ **IMPORTANT**: Change these credentials in production!

### Environment Variable Sync

These two files must be kept in sync:

| Variable | Root .env | frontend/.env.local | Purpose |
|----------|-----------|---------------------|----------|
| PORT | 4000 | - | Backend server port |
| FRONTEND_URL | 4001 | - | Backend CORS origin |
| NEXTAUTH_URL | - | 4001 | NextAuth callback URL |
| NEXT_PUBLIC_API_URL | - | 4000 | Frontend API endpoint |

Example: If you change backend PORT to 5000:
1. Update `PORT=5000` in root `.env`
2. Update `NEXT_PUBLIC_API_URL=http://localhost:5000` in `frontend/.env.local`
3. Restart both servers

---

## Production ports & build notes 🔧

- The `pnpm build` step only **compiles** the application; it does **not** set runtime ports.
- **Runtime ports are determined when you start the app**: the process reads `process.env.PORT` or falls back to **3000** (both backend and Next.js default to 3000 when PORT is unset).
- To ensure the same ports in production, **set the `PORT` environment variable** before starting the server (systemd/unit, Docker, or host environment):
  - Backend (Express): `PORT=4000 node dist/index.js` or export `PORT=4000` in the service environment
  - Frontend (Next.js): `PORT=4001 pnpm --prefix frontend start` or set `PORT=4001` in the frontend service
- Alternatively, use a reverse proxy (Nginx) to expose ports 80/443 and proxy to internal app ports.

Set env vars in your host/CI/CD to control production ports and secrets securely.
### Starting locally in "production" mode (ports 4010/4011) 🔧

A convenience script is included to build and start both backend and frontend on the local host using the ports below:

- Backend: 4010
- Frontend: 4011

Usage:
```bash
# From repository root
./scripts/start-prod.sh
```

What the script does:
- Kills processes listening on ports 4010 and 4011 (if any)
- Builds backend (`pnpm build`) and frontend (`cd frontend && pnpm build`)
- Starts backend on port 4010 and frontend on port 4011 in the background
- Writes logs to `logs/backend-prod.log` and `logs/frontend-prod.log`
- Saves process IDs to `.prod_backend.pid` and `.prod_frontend.pid`

To stop the servers:
```bash
kill "$(cat .prod_backend.pid)" || true
kill "$(cat .prod_frontend.pid)" || true
```

Script verification
- The script now verifies that the backend and frontend actually bind to ports **4010** and **4011** after startup (it waits and retries briefly). If a service fails to bind the script prints the last 200 lines from the corresponding log file (`logs/backend-prod.log` or `logs/frontend-prod.log`) and exits with a non-zero status so failures are visible when testing locally.

Repository hygiene
- The PID files and logs created by the script are ignored by git:
  - `.prod_backend.pid`, `.prod_frontend.pid`, and the `logs/` directory are listed in `.gitignore` to avoid leaking runtime artifacts.

Note: This script is intended for local testing of production builds. In real production deploys, prefer systemd units, Docker, or a process manager (PM2) that integrates with your host environment and secret management.
### Database Schema

The system uses 5 main collections:

#### Students
- Personal information and contact details
- Multiple category assignments
- Belt level tracking
- Emergency contact information

#### Classes  
- Class definitions with categories
- Instructor assignments
- Capacity and duration settings

#### Class Schedules
- Specific class instances with dates/times
- Recurring class support
- Status tracking (scheduled/cancelled/completed)

#### Attendance
- Individual attendance records
- Category-specific tracking
- Notes and timestamps
- Teacher who recorded attendance

#### Users
- Email and hashed password (bcrypt)
- Role (admin, instructor, staff, student)
- Status (active, inactive, suspended)
- Last login tracking
- Password change tracking

### Database Configuration Notes

- **MongoDB Port Mapping**: When using Docker, MongoDB container port 27017 is mapped to host port 27019 to avoid conflicts with locally running MongoDB instances
- **Default MongoDB Connection**: `mongodb://root:ogsadmin@localhost:27019/attendance?authSource=admin`
- **Credentials**: Set MONGO_USERNAME and MONGO_PASSWORD in docker-compose.yml as needed

## Configuration Management

The system uses a YAML configuration file to manage categories and belt levels, allowing administrators to customize these values without code changes.

### Configuration File

**Location:** `config/system.yaml`

This file defines:
- **Categories**: Student and class skill/age levels (e.g., kids, youth, adult, advanced)
- **Belt Levels**: Karate belt progression with ranks and colors (e.g., white, yellow, orange... black)

### Default Configuration

**Categories (4 default):**
- Kids - Children's classes (ages 5-10)
- Youth - Youth classes (ages 11-17)
- Adult - Adult classes (ages 18+)
- Advanced - Advanced training for all ages

**Belt Levels (10 default):**
- White Belt (rank 1), etc
- ... (yellow, orange, green, blue(youth), brown, black)

### Modifying Configuration

1. **Edit the YAML file:**
   ```bash
   # Open config/system.yaml in your editor
   nano config/system.yaml
   ```

2. **Add/modify categories:**
   ```yaml
   categories:
     - value: "beginner"        # Database value
       label: "Beginner"        # Display name
       description: "New students"
       order: 1                 # Display order
   ```

3. **Add/modify belt levels:**
   ```yaml
   belt_levels:
     - value: "white"           # Database value
       label: "White Belt"      # Display name
       rank: 1                  # Progression rank
       color: "#FFFFFF"         # Hex color code
   ```

4. **Restart the backend server:**
   ```bash
   pnpm run dev
   ```

### Important Notes

- Changes to the configuration file require a server restart to take effect
- The `value` field is stored in the database - avoid changing existing values
- The `order` field controls the display order in dropdowns
- The `rank` field determines belt progression order
- Before removing a category or belt level, ensure no existing data uses it

### Configuration API

The configuration is exposed via a public API endpoint:

```
GET /api/config
```

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "value": "kids",
        "label": "Kids",
        "description": "Children's classes (ages 5-10)",
        "order": 1
      }
    ],
    "beltLevels": [
      {
        "value": "white",
        "label": "White Belt",
        "rank": 1,
        "color": "#FFFFFF"
      }
    ]
  }
}
```

This endpoint is used by the frontend to populate category and belt level dropdowns dynamically.

## User Roles & Permissions

The system implements role-based access control with 4 user types:

### ADMIN
- **Full system access**
- Manage users (create, edit, delete)
- Manage students, classes, and schedules
- Mark attendance and view all reports
- Access to all features

### INSTRUCTOR
- **Limited administrative access**
- View all students and classes
- Create and manage their own class schedules
- Mark attendance for any class
- View attendance reports
- Cannot manage users or delete data

### STAFF
- **Check-in desk role**
- View students and class schedules
- Mark attendance (check-in functionality)
- Cannot create, edit, or delete data
- Cannot view reports

### STUDENT
- **View-only access**
- View their own attendance history
- View class schedules
- Cannot modify any data

## Usage

### For Administrators

1. **User Management**
   - Navigate to "Users" in the sidebar (admin only)
   - Click "Create User" to add new users
   - Assign appropriate roles (admin, instructor, staff, student)
   - Set initial passwords (users should change on first login)
   - Activate/deactivate user accounts as needed

2. **System Configuration**
   - Manage all students, classes, and schedules
   - View comprehensive reports
   - Monitor system usage

### For Instructors/Teachers

1. **Daily Workflow**
   - Open app to see today's classes
   - Next class is automatically highlighted
   - Click "Take Attendance" for any class
   - Select category if class has multiple
   - Mark students present/absent/late
   - Add notes if needed
   - Save attendance

2. **Past Class Editing**
   - Use "Past Classes" tab
   - Search by date, instructor, or category
   - Edit attendance for any previous class

3. **Reporting**
   - View attendance statistics
   - Generate reports by date range
   - Track student attendance patterns

### API Endpoints

**Note**: All endpoints except authentication require a valid JWT token in the Authorization header.

#### Configuration (Public)
- `GET /api/config` - Get system configuration (categories and belt levels)

#### Authentication
- `POST /api/auth/login` - User login (public)
- `POST /api/auth/refresh-token` - Refresh access token (public)
- `GET /api/auth/me` - Get current user profile (protected)
- `PUT /api/auth/me` - Update current user profile (protected)
- `PUT /api/auth/change-password` - Change password (protected)

#### Users (Admin only)
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `PUT /api/users/:id/status` - Change user status
- `PUT /api/users/:id/reset-password` - Admin password reset

#### Attendance
- `GET /api/attendance/today` - Get today's classes
- `GET /api/attendance/next-class` - Get next upcoming class
- `POST /api/attendance/mark` - Mark attendance
- `GET /api/attendance/class/:id` - Get class attendance
- `GET /api/attendance/search` - Search past classes

#### Students
- `GET /api/students` - Get all students
- `GET /api/students/category/:category` - Get students by category
- `POST /api/students` - Create new student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

#### Classes
- `GET /api/classes` - Get all classes
- `POST /api/classes` - Create new class
- `PUT /api/classes/:id` - Update class
- `DELETE /api/classes/:id` - Delete class

#### Schedules  
- `GET /api/schedules/date/:date` - Get schedule for date
- `POST /api/schedules` - Create schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule

## Development

### Project Structure
```
config/
 system.yaml      # Configuration for categories and belt levels
src/
 controllers/     # Request handlers
 models/         # Mongoose models
 routes/         # Express routes
 services/       # Business logic (ConfigService, AttendanceService)
 middleware/     # Custom middleware
 utils/          # Utility functions
 types/          # TypeScript interfaces
 index.ts        # App entry point
frontend/
 src/
  app/           # Next.js pages
  components/    # React components
  hooks/         # Custom hooks (useConfig, useAuth)
  lib/           # Utilities (API wrapper)
```

### Scripts

**Backend:**
- `pnpm run dev` - Start development server with hot reload
- `pnpm run build` - Build for production
- `pnpm start` - Start production server
- `pnpm test` - Run tests
- `pnpm run seed:admin` - Create initial admin user

**Frontend:**
- `cd frontend && pnpm run dev` - Start Next.js development server
- `cd frontend && pnpm run build` - Build frontend for production
- `cd frontend && pnpm start` - Start frontend production server

### Key Design Decisions

1. **JWT-based Authentication**: Secure token-based authentication with refresh tokens for session management. Access tokens expire in 24 hours, refresh tokens in 7 days.

2. **Role-based Authorization**: Granular permission system with 4 user roles, allowing fine-grained access control to different features.

3. **YAML Configuration**: Categories and belt levels are managed via a YAML file rather than hardcoded or database-stored, providing a balance between flexibility and simplicity. Changes require a server restart.

4. **Multiple Categories per Student/Class**: Students and classes can belong to multiple categories (e.g., a 16-year-old might be in both "youth" and "adult" classes)

5. **Dynamic Validation**: All category and belt level validation uses the ConfigService, ensuring consistency between configuration and validation rules.

6. **Time-based Class Selection**: The system automatically highlights the next upcoming class to streamline the teacher workflow

7. **Separate Schedule Instances**: Classes and their schedules are separate entities, allowing for flexible scheduling and easy editing of specific instances

8. **Category-specific Attendance**: Attendance is tracked per category, enabling mixed-level classes

9. **Teacher-centric UI**: Interface optimized for tablet use with large touch targets and minimal navigation

10. **Admin-only User Creation**: No self-registration to maintain security and control over who accesses the system

## Security

### Authentication & Authorization
- **Password Hashing**: bcrypt with 10 rounds
- **JWT Tokens**: Signed with HS256 algorithm
- **Token Expiry**: 24h for access tokens, 7d for refresh tokens
- **Rate Limiting**: 5 login attempts per 15 minutes per IP
- **CORS**: Restricted to frontend URL only
- **Password Requirements**: Minimum 8 characters

### Best Practices
- Change default admin password immediately after first login
- Use strong, unique passwords for all users
- Generate secure random strings for JWT_SECRET, JWT_REFRESH_SECRET, and NEXTAUTH_SECRET
- Keep environment variables secure and never commit to version control
- Regularly review user access and deactivate unused accounts
- Enable HTTPS in production

## Troubleshooting

### Cannot login
- Ensure MongoDB is running (`docker-compose up -d`)
- Verify backend is running on port 3000
- Check that admin user exists (`pnpm run seed:admin`)
- Verify JWT_SECRET is set in `.env`

### 401 Unauthorized errors
- Check that you're logged in
- Token may have expired - log out and log back in
- Verify NEXTAUTH_SECRET matches between requests

### CORS errors
- Verify FRONTEND_URL in backend `.env` matches your frontend URL
- Check that frontend is running on the correct port (3001)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details