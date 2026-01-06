// README.md - Project documentation
# Karate School Attendance Management System

A comprehensive TypeScript-based attendance management system for karate schools with MongoDB backend and React frontend.

## Features

### Core Functionality
-  Student management with multiple categories (kids, youth, adult, advanced)
-  Class scheduling and management  
-  Real-time attendance tracking
-  Teacher-friendly interface optimized for tablets
-  Automatic detection of next upcoming class
-  Historical attendance editing
-  Comprehensive reporting

### Technical Features
-  TypeScript for type safety
-  MongoDB with Mongoose ODM
-  Express.js REST API
-  Responsive web interface
-  Data validation with Joi
-  Calendar integration with FullCalendar
-  Time-based logic for class management

## Quick Start

### Prerequisites
- Node.js 16+
- MongoDB 4.4+ (or Docker for containerized MongoDB)
- pnpm (recommended) or npm/yarn
- Docker & Docker Compose (optional, for MongoDB)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd attendance_ogs
```

2. Install dependencies
```bash
# Install root dependencies
pnpm install

# Install frontend dependencies
cd frontend && pnpm install && cd ..
```

3. Set up environment variables

**Backend (.env in project root):**
```bash
cp .env.example .env
# Edit .env with your MongoDB credentials and desired ports
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

4. Start MongoDB (choose one)

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

5. Create admin user (first time only)
```bash
pnpm run seed:admin
```
This creates an admin account:
- Email: `admin@karateattendance.com`
- Password: `ChangeMe123!`

6. Run the development servers

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

### Database Schema

The system uses 4 main collections:

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

### Database Configuration Notes

- **MongoDB Port Mapping**: When using Docker, MongoDB container port 27017 is mapped to host port 27019 to avoid conflicts with locally running MongoDB instances
- **Default MongoDB Connection**: `mongodb://root:ogsadmin@localhost:27019/attendance?authSource=admin`
- **Credentials**: Set MONGO_USERNAME and MONGO_PASSWORD in docker-compose.yml as needed

## Usage

### For Teachers

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
src/
 controllers/     # Request handlers
 models/         # Mongoose models
 routes/         # Express routes
 services/       # Business logic
 middleware/     # Custom middleware
 utils/          # Utility functions
 types/          # TypeScript interfaces
 index.ts        # App entry point
```

### Scripts
- `pnpm run dev` - Start development server
- `pnpm run build` - Build for production  
- `pnpm start` - Start production server
- `pnpm test` - Run tests

### Key Design Decisions

1. **Multiple Categories per Student/Class**: Students and classes can belong to multiple categories (e.g., a 16-year-old might be in both "youth" and "adult" classes)

2. **Time-based Class Selection**: The system automatically highlights the next upcoming class to streamline the teacher workflow

3. **Separate Schedule Instances**: Classes and their schedules are separate entities, allowing for flexible scheduling and easy editing of specific instances

4. **Category-specific Attendance**: Attendance is tracked per category, enabling mixed-level classes

5. **Teacher-centric UI**: Interface optimized for tablet use with large touch targets and minimal navigation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details