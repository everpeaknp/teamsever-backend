import { Request, Response, NextFunction } from "express";

const AppError = require("../utils/AppError");

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  let error = { ...err };
  error.message = err.message;

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    error = new AppError("Resource not found", 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    error = new AppError(`A record with this ${field} already exists`, 400);
  }

  // Mongoose validation error
  if (err.name === "ValidationError" && err.errors) {
    const message = Object.values(err.errors)
      .map((val: any) => val.message)
      .join(", ");
    error = new AppError(message, 400);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    error = new AppError("Invalid token. Please log in again", 401);
  }
  if (err.name === "TokenExpiredError") {
    error = new AppError("Your token has expired. Please log in again", 401);
  }

  const statusCode = error.statusCode || 500;
  const isDev = process.env.NODE_ENV === "development";

  // Always log to server — never send internals to client
  if (statusCode >= 500) {
    console.error(`[Error] ${req.method} ${req.path} → ${statusCode}:`, err.message);
    if (isDev) console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message: error.message || "Internal Server Error",
    errorCode: error.errorCode || null,
    // Only expose stack in development
    ...(isDev && { stack: err.stack }),
  });
};

module.exports = errorHandler;
export {};
