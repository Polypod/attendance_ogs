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
- MongoDB 4.4+
- pnpm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd <repository-name>
```

2. Install dependencies
```bash
pnpm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start MongoDB (if running locally. For Docker use your docker-compose.yml configuration)
```bash
mongod
# Or with Docker:
docker-compose up
```

5. Run the development server
```bash
pnpm run dev
```

The API will be available at http://localhost:3000

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

-- Note: mongoDB on docker mapped to port 27018 to not interfere with already running mongoDB instance (default is 2017)

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