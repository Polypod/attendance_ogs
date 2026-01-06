# Karate School Attendance Management - Frontend

This is the Next.js 16 frontend for the Karate School Attendance Management System, featuring secure authentication with NextAuth.js and a responsive tablet-optimized interface.

## Features

### Authentication
- **NextAuth.js 5.0 (beta)** for session management
- Secure JWT-based authentication with the backend API
- Role-based UI rendering (Admin, Instructor, Staff, Student)
- Protected routes with automatic redirect to login
- Session persistence with refresh tokens

### User Interface
- **Responsive design** optimized for tablets and desktop
- **shadcn/ui components** for consistent UI/UX
- **Dark/light mode support** with theme switching
- **Role-based navigation** showing only accessible features
- **Real-time attendance tracking** interface
- **Calendar integration** with FullCalendar

### Dashboard Features
- **Today's Classes**: View upcoming classes with automatic next class detection
- **Student Management**: Browse and manage student records (role-based)
- **Class Schedules**: View and manage class schedules
- **Attendance Marking**: Quick attendance entry optimized for touch screens
- **User Management**: Admin-only user creation and management
- **Calendar View**: Visual schedule overview

## Tech Stack

- **Framework**: Next.js 16.1.1 with App Router
- **Authentication**: NextAuth.js 5.0 beta
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS
- **State Management**: React hooks with NextAuth session
- **API Communication**: Custom fetch wrapper with JWT authentication
- **Calendar**: FullCalendar React integration
- **TypeScript**: Full type safety

## Getting Started

### Prerequisites

- Node.js 16 or higher
- pnpm (recommended) or npm
- Backend API running on port 3000

### Installation

1. **Navigate to the frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Set up environment variables**

Create a `.env.local` file in the frontend directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3000

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secure-random-secret-min-32-characters-long
```

**Important**: Generate a secure random string for `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

4. **Start the development server**
```bash
pnpm run dev
```

The frontend will be available at [http://localhost:3001](http://localhost:3001)

5. **Login to the application**
- Navigate to [http://localhost:3001/login](http://localhost:3001/login)
- Use the admin credentials from the backend setup:
  - Email: `admin@karateattendance.com`
  - Password: `ChangeMe123!`
- **Change the password immediately after first login**

### Production Build

```bash
pnpm run build
pnpm start
```

## Project Structure

```
src/
├── app/                          # Next.js 16 App Router
│   ├── api/
│   │   └── auth/[...nextauth]/  # NextAuth configuration
│   ├── dashboard/               # Protected dashboard pages
│   │   ├── page.tsx            # Main dashboard (today's classes)
│   │   ├── students/           # Student management
│   │   ├── classes/            # Class management
│   │   ├── calendar/           # Calendar view
│   │   └── users/              # User management (admin only)
│   ├── login/                   # Login page
│   ├── layout.tsx              # Root layout with SessionProvider
│   └── providers.tsx           # Client-side providers
├── components/
│   ├── layouts/
│   │   └── DashboardLayout.tsx # Main dashboard layout with nav
│   └── ui/                     # shadcn/ui components
├── hooks/
│   └── useAuth.ts              # Custom auth hook
├── lib/
│   ├── api.ts                  # API wrapper with JWT auth
│   └── utils.ts                # Utility functions
└── types/
    └── next-auth.d.ts          # NextAuth type extensions
```

## Authentication Flow

### Login Process
1. User submits credentials on [login page](src/app/login/page.tsx)
2. NextAuth calls the backend `/api/auth/login` endpoint
3. Backend validates credentials and returns JWT tokens
4. Tokens stored in NextAuth session (httpOnly cookies)
5. User redirected to `/dashboard`

### Authenticated Requests
1. All API calls use the `fetchWithAuth` wrapper from [lib/api.ts](src/lib/api.ts)
2. JWT access token automatically added to `Authorization` header
3. Backend validates token and checks permissions
4. If token expired (401), user redirected to login

### Session Management
- Access tokens expire after 24 hours
- Refresh tokens valid for 7 days
- NextAuth automatically handles session refresh
- Logout via `signOut()` clears all session data

## User Roles & Access

The UI adapts based on user role:

### ADMIN
- Full access to all features
- User management section visible
- Can create, edit, delete all resources

### INSTRUCTOR
- View students and classes
- Create and manage own class schedules
- Mark attendance for any class
- View attendance reports
- No access to user management

### STAFF
- View students and class schedules
- Mark attendance (check-in functionality)
- Cannot create, edit, or delete data
- No access to reports or user management

### STUDENT
- View own attendance history
- View class schedules
- Read-only access
- No administrative features

## Key Components

### DashboardLayout
[src/components/layouts/DashboardLayout.tsx](src/components/layouts/DashboardLayout.tsx)
- Sidebar navigation with role-based filtering
- User profile display with avatar
- Logout functionality
- Mobile-responsive with Sheet component

### useAuth Hook
[src/hooks/useAuth.ts](src/hooks/useAuth.ts)
```typescript
const { user, isAuthenticated, isAdmin, isInstructor, isStaff, isStudent } = useAuth();
```
- Wraps NextAuth `useSession()`
- Provides convenient role checks
- Returns current user data

### API Wrapper
[src/lib/api.ts](src/lib/api.ts)
```typescript
import { api } from '@/lib/api';

const students = await api.get('/api/students');
await api.post('/api/attendance/mark', attendanceData);
```
- Automatically adds JWT token to requests
- Handles 401 errors with redirect
- Convenience methods for all HTTP verbs

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes |
| `NEXTAUTH_URL` | Frontend URL for NextAuth | Yes |
| `NEXTAUTH_SECRET` | Secret for NextAuth session encryption | Yes |

## Development

### Running the Development Server

Ensure the backend is running first:
```bash
# In the root directory
pnpm run dev
```

Then start the frontend:
```bash
cd frontend
pnpm run dev
```

### Available Scripts

- `pnpm run dev` - Start development server on port 3001
- `pnpm run build` - Build for production
- `pnpm start` - Start production server
- `pnpm run lint` - Run ESLint

## Troubleshooting

### Cannot login
- Verify backend is running on port 3000
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Ensure admin user exists (run `pnpm run seed:admin` in backend)
- Check browser console for errors

### 401 Unauthorized errors
- Token may have expired - log out and log back in
- Verify `NEXTAUTH_SECRET` is set correctly
- Check browser cookies are enabled

### Session not persisting
- Ensure `NEXTAUTH_URL` matches your frontend URL exactly
- Clear browser cookies and try again
- Check that cookies are not being blocked

### CORS errors
- Verify backend `FRONTEND_URL` in `.env` matches `http://localhost:3001`
- Ensure backend CORS middleware allows credentials

## Security Notes

- Never commit `.env.local` to version control
- Use strong, random values for `NEXTAUTH_SECRET`
- Keep dependencies updated for security patches
- All authentication state managed server-side
- Tokens stored in httpOnly cookies (not accessible to JavaScript)

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)

## License

MIT License - see LICENSE file for details
