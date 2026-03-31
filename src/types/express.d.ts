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
      subscription?: {
        isPaid: boolean;
        status: string;
        plan: any;
        subscriptionExpired: boolean;
        daysRemaining: number;
      };
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
  subscription?: {
    isPaid: boolean;
    status: string;
    plan: any;
    subscriptionExpired: boolean;
    daysRemaining: number;
  };
}
