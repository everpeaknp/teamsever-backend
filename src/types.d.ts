declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    MONGODB_URI: string;
    JWT_SECRET: string;
    RESEND_API_KEY: string;
    FRONTEND_URL: string;
    NODE_ENV?: string;
  }
}

export {};
