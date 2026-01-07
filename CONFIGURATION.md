# Configuration Guide - Attendance Management System

## Overview

This project is a full-stack application with a Node.js/Express backend and Next.js frontend. Both services require proper environment configuration to communicate correctly and function as intended.

## Critical Configuration Requirements

### 1. Port Synchronization (🔴 MUST MATCH)

The backend and frontend must be configured to run on specific, non-conflicting ports:

- **Backend**: `PORT=4000` (defined in root `.env`)
- **Frontend**: `PORT=4001` (defined in `frontend/.env.local`)

These ports enable CORS communication between services and must be reflected in all API URLs.

### 2. API Endpoint Configuration (🔴 MUST MATCH)

⚠️ **CRITICAL: Remote SSH Development Configuration**

The `NEXT_PUBLIC_API_URL` setting depends on your development environment:

#### For Remote SSH Development (VS Code Remote, SSH tunneling):
**In `frontend/.env.local`:**
```
NEXT_PUBLIC_API_URL=
BACKEND_URL=http://localhost:4000
```

When `NEXT_PUBLIC_API_URL` is **empty**, the frontend uses relative URLs that are proxied through Next.js API routes (`/frontend/src/app/api/[...path]/route.ts`). This is **REQUIRED** when:
- Your browser runs on a different machine than the backend (e.g., Windows browser, Linux server)
- You're using VS Code Remote SSH
- `localhost` in the browser points to a different machine than where the backend runs

#### For Local Development (everything on same machine):
**In `frontend/.env.local`:**
```
NEXT_PUBLIC_API_URL=http://localhost:4000
BACKEND_URL=http://localhost:4000
```

When `NEXT_PUBLIC_API_URL` has a value, the browser connects directly to the backend URL.

**🔴 IMPORTANT:** If you see "Loading..." forever on dashboard pages:
1. Check which environment you're in (remote SSH vs local)
2. Set `NEXT_PUBLIC_API_URL` correctly (empty for remote, URL for local)
3. Restart frontend: `pnpm run dev:frontend`

This variable is used by:
- Client-side API calls in dashboard pages
- NextAuth authentication callbacks
- API wrapper functions in `frontend/src/lib/api.ts`

If the backend port changes, this must be updated and both servers restarted.

### 3. NextAuth Configuration (🔴 CRITICAL)

NextAuth requires both `NEXTAUTH_SECRET` and `NEXTAUTH_URL` to function:

**In `frontend/.env.local`:**
```
NEXTAUTH_SECRET=dev_secret_change_me_in_production
NEXTAUTH_URL=http://localhost:4001
```

**In root `.env`:**
```
FRONTEND_URL=http://localhost:4001
```

- `NEXTAUTH_URL` must match the frontend URL where users access the application
- `NEXTAUTH_SECRET` must be a secure random string (change for production)
- The backend uses `FRONTEND_URL` to configure CORS to allow requests from the frontend

### 4. MongoDB Connection (🔴 MUST BE CONFIGURED)

**In root `.env`:**
```
MONGODB_URI=mongodb://root:ogsadmin@localhost:27019/attendance?authSource=admin
```

The connection string includes:
- **Host & Port**: `localhost:27019` (Docker port mapping) or `localhost:27017` (local MongoDB)
- **Credentials**: `root:ogsadmin` (must match docker-compose.yml)
- **Database**: `attendance`
- **Auth Source**: `admin` (required for authentication)

### 5. JWT & Security (🟡 IMPORTANT FOR PRODUCTION)

**In root `.env`:**
```
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-characters-long-change-this-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=10
```

**Production Requirements:**
- Generate unique, strong JWT_SECRET (minimum 32 characters)
- Use a different JWT_REFRESH_SECRET
- Consider reducing BCRYPT_ROUNDS for performance, or increasing for security
- Store secrets securely (never commit to repository)

## File Structure & Configuration Files

```
attendance_ogs/
├── .env                          # Backend environment (DO NOT COMMIT)
├── .env.example                  # Backend template (COMMIT THIS)
├── docker-compose.yml            # MongoDB configuration
├── package.json                  # Backend scripts
│
└── frontend/
    ├── .env.local                # Frontend environment (DO NOT COMMIT)
    ├── .env.example              # Frontend template (COMMIT THIS)
    ├── package.json              # Frontend scripts
    └── src/
        └── app/
            └── dashboard/        # Protected routes requiring authentication
```

## Setup Step-by-Step

### Phase 1: Repository & Dependencies

```bash
# 1. Clone and navigate
git clone <repository-url>
cd attendance_ogs

# 2. Install all dependencies
pnpm install
cd frontend && pnpm install && cd ..
```

### Phase 2: Environment Configuration

```bash
# 3a. Create backend configuration
cp .env.example .env
# Edit .env with your values (see .env.example for all required variables)

# 3b. Create frontend configuration
cd frontend
cp .env.example .env.local
# Edit .env.local if needed (defaults should work for local development)
cd ..
```

### Phase 3: Database Setup

```bash
# 4. Start MongoDB using Docker
docker-compose up -d

# Verify MongoDB is running:
# - Check port 27019 is open: lsof -i :27019
# - Should see: mongod (or mongo) listening on 27019
```

### Phase 4: Initial Data

```bash
# 5. Create default admin account
pnpm run seed:admin

# Output: "Admin user created/updated successfully"
# Credentials: admin@karateattendance.com / ChangeMe123!
```

### Phase 5: Run Application

```bash
# 6. Start both servers (from root directory)
pnpm run dev:all

# You should see:
# - Backend: "✅ Connected to MongoDB" & "🚀 Server running on port 4000"
# - Frontend: "✓ Ready in X.Xs" at "Local: http://localhost:4001"
```

### Phase 6: Verify Setup

```bash
# Test API is accessible
curl http://localhost:4000/api/health

# Expected response:
# {"status":"OK","timestamp":"2026-01-06T...","uptime":...}

# Open browser
open http://localhost:4001/login

# Login with: admin@karateattendance.com / ChangeMe123!
```

## Troubleshooting Configuration Issues

### "401 Unauthorized" on Dashboard Pages

**Cause**: Frontend not sending JWT token from NextAuth session
**Solution**: 
1. Ensure `NEXT_PUBLIC_API_URL` in `frontend/.env.local` matches backend PORT
2. Ensure `NEXTAUTH_SECRET` is set in `frontend/.env.local`
3. Restart frontend: `cd frontend && pnpm run dev`

### "CORS Error" or "Failed to fetch"

**Cause**: Backend CORS origin doesn't match frontend URL
**Solution**:
1. Verify `FRONTEND_URL` in root `.env` matches where frontend is running
2. For development: should be `http://localhost:4001`
3. Restart backend to apply CORS changes

### "Connection refused" to MongoDB

**Cause**: MongoDB not running or wrong port/credentials
**Solution**:
1. Verify Docker container is running: `docker-compose ps`
2. Check credentials match between `.env` and `docker-compose.yml`
3. Verify host port mapping: `docker-compose.yml` shows `27019:27017`

### API returns "Invalid email or password"

**Cause**: Admin account not created or database empty
**Solution**:
1. Run seed script: `pnpm run seed:admin`
2. Use credentials from output: admin@karateattendance.com / ChangeMe123!

### Frontend won't start or stuck on "Ready in 2.7s"

**Cause**: PORT 4001 already in use or `.env.local` not loaded
**Solution**:
1. Kill process on 4001: `lsof -ti:4001 | xargs kill -9`
2. Ensure `frontend/.env.local` exists with `PORT=4001`
3. Restart: `cd frontend && pnpm run dev`

## Development Commands

```bash
# Start both servers together (from root)
pnpm run dev:all

# Start only backend (from root)
pnpm run dev

# Start only frontend (from root directory)
pnpm run dev:frontend

# Create admin account
pnpm run seed:admin

# Build for production
pnpm run build
cd frontend && pnpm run build && cd ..

# Run tests
pnpm test
```

## Environment Variable Reference

| Variable | File | Required | Example | Purpose |
|----------|------|----------|---------|---------|
| `MONGODB_URI` | `.env` | ✅ | `mongodb://root:ogsadmin@localhost:27019/attendance?authSource=admin` | Database connection |
| `PORT` | `.env` | ✅ | `4000` | Backend server port |
| `FRONTEND_URL` | `.env` | ✅ | `http://localhost:4001` | Frontend origin for CORS |
| `JWT_SECRET` | `.env` | ✅ | `[32+ character string]` | JWT signing key |
| `JWT_REFRESH_SECRET` | `.env` | ✅ | `[32+ character string]` | Refresh token signing key |
| `PORT` | `frontend/.env.local` | ✅ | `4001` | Frontend Next.js port |
| `NEXTAUTH_URL` | `frontend/.env.local` | ✅ | `http://localhost:4001` | NextAuth callback URL |
| `NEXTAUTH_SECRET` | `frontend/.env.local` | ✅ | `[secure string]` | NextAuth session signing key |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | ✅ | `http://localhost:4000` | Backend API endpoint |

## Production Deployment Checklist

- [ ] Change `NEXTAUTH_SECRET` to a new secure value
- [ ] Change `JWT_SECRET` to a new secure value (min 32 chars)
- [ ] Change `JWT_REFRESH_SECRET` to a new secure value (min 32 chars)
- [ ] Change admin password from `ChangeMe123!`
- [ ] Update `MONGODB_URI` to production database
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Use secure MongoDB credentials (not default `root:ogsadmin`)
- [ ] Configure proper FRONTEND_URL for production domain
- [ ] Enable HTTPS for all endpoints
- [ ] Implement rate limiting for API endpoints
- [ ] Set up proper logging and monitoring
- [ ] Review CORS settings for production domain

## Summary

For the application to work:
1. ✅ Backend and frontend must run on configured ports (4000, 4001)
2. ✅ Environment variables in both `.env` files must be synchronized
3. ✅ MongoDB must be accessible with correct credentials
4. ✅ NextAuth requires both SECRET and URL to be set correctly
5. ✅ API URLs in frontend must point to correct backend port
6. ✅ CORS must be configured to allow frontend origin
7. ✅ JWT tokens must be generated and validated correctly
8. ✅ Admin account must be seeded before first login

If any of these are misconfigured, the application will not function properly.
