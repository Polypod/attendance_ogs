// src/types/express.d.ts - Extend Express Request interface with user property
import { User } from './interfaces';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
