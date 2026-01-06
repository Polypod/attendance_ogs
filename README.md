// README.md - Project documentation
# Karate School Attendance Management System

A comprehensive TypeScript-based attendance management system for karate schools with MongoDB backend and React frontend.

## Features

### Core Functionality
-  **Authentication & Authorization**: Secure JWT-based authentication with role-based access control (RBAC)
-  **Student management** with configurable categories and belt level tracking
-  **Class scheduling and management** with multi-category support
-  **Real-time attendance tracking** with category-specific recording
-  **User management**: Admin-only user creation with 4 role types (admin, instructor, staff, student)
-  **Configuration management**: YAML-based category and belt level configuration
-  **Teacher-friendly interface** optimized for tablets
-  **Automatic detection** of next upcoming class
-  **Historical attendance editing**
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
- MongoDB 4.4+
- pnpm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd <repository-name>
```

2. **Install backend dependencies**
```bash
pnpm install
```

3. **Install frontend dependencies**
```bash
cd frontend
pnpm install
cd ..
```

4. **Set up environment variables**

Backend:
```bash
cp .env.example .env
# Edit .env with your configuration
# Generate secure random strings for JWT_SECRET, JWT_REFRESH_SECRET
```

Frontend:
```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with your configuration
# Generate a secure random string for NEXTAUTH_SECRET
cd ..
```

5. **Start MongoDB**
```bash
# With Docker (recommended):
docker-compose up -d

# Or locally:
mongod
```

6. **Create initial admin user**
```bash
pnpm run seed:admin
```

This creates an admin account with:
- 📧 Email: `admin@karateattendance.com`
- 🔑 Password: `ChangeMe123!`
- ⚠️ **Change this password immediately after first login!**

7. **Start the backend server**
```bash
pnpm run dev
```

The API will be available at http://localhost:3000

8. **Start the frontend** (in a new terminal)
```bash
cd frontend
pnpm run dev
```

The frontend will be available at http://localhost:3001

9. **Login to the system**
- Navigate to http://localhost:3001/login
- Use the admin credentials above
- Change the password in your first session

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

**Note**: MongoDB on Docker is mapped to port 27018 to avoid conflicts with local MongoDB instances (default port 27017)

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