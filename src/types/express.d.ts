import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        name?: string;
        isSuperUser?: boolean;
      };
      workspace?: any;
    }
  }
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    name?: string;
    isSuperUser?: boolean;
  };
  workspace?: any;
}
