class AppError extends Error {
  statusCode: number;
  errorCode: string | null;
  isOperational: boolean;

  constructor(message: string, statusCode: number, errorCode: string | null = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;

export {};
