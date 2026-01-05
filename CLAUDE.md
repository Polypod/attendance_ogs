# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript Express.js backend for a karate school attendance management system. It uses MongoDB with Mongoose ODM and provides a REST API for managing students, classes, schedules, and attendance tracking.

## Development Commands

### Core Development
- `pnpm run dev` - Start development server with hot reload using ts-node-dev
- `pnpm run build` - Compile TypeScript to JavaScript in dist/ directory  
- `pnpm start` - Start production server from compiled dist/index.js
- `pnpm test` - Run Jest test suite with coverage reporting

### Database
- `docker-compose up -d` - Start MongoDB container on port 27018
- MongoDB connection: localhost:27018 with credentials in docker-compose.yml

## Architecture

### Core Structure
- **Models** (`src/models/`): Mongoose schemas with validation and indexing
- **Services** (`src/services/`): Business logic layer (e.g., AttendanceService for complex attendance operations)  
- **Controllers** (`src/controllers/`): HTTP request handlers that use services
- **Routes** (`src/routes/`): Express route definitions
- **Types** (`src/types/interfaces.ts`): TypeScript interfaces and enums for type safety

### Key Design Patterns
- **Multiple Categories**: Students and classes support multiple categories (kids, youth, adult, advanced)
- **Category-specific Attendance**: Attendance tracked per category for mixed-level classes
- **Separated Schedules**: Classes and ClassSchedules are separate entities for flexible scheduling
- **Time-based Logic**: Automatic next class detection using moment.js
- **Service Layer**: Complex business logic isolated in service classes

### Database Schema
- **Students**: Personal info, multiple categories, belt levels, emergency contacts
- **Classes**: Class definitions with categories, instructor, capacity
- **ClassSchedules**: Specific class instances with dates/times, recurring support  
- **Attendance**: Individual records linking students to specific class schedules

### Type System
- Comprehensive TypeScript interfaces in `src/types/interfaces.ts`
- Enums for categories, statuses, days of week
- DTOs for API requests/responses
- Extended interfaces for populated MongoDB documents

## Testing

- Jest configuration in `jest.config.js` with 80% coverage threshold
- Test files in `src/__tests__/` directory
- Setup file at `src/test/setup.ts`
- In-memory MongoDB for testing using mongodb-memory-server

## Path Aliases

- `@/*` maps to `src/*` (configured in tsconfig.json)

## Key Dependencies

- **express**: Web framework
- **mongoose**: MongoDB ODM with validation
- **joi**: Additional request validation
- **moment**: Date/time manipulation for class scheduling
- **helmet**: Security middleware
- **cors**: Cross-origin resource sharing