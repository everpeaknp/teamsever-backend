"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AppError = require("../utils/AppError");
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    // Mongoose bad ObjectId
    if (err.name === "CastError") {
        const message = "Resource not found";
        error = new AppError(message, 404);
    }
    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = "Duplicate field value entered";
        error = new AppError(message, 400);
    }
    // Mongoose validation error
    if (err.name === "ValidationError" && err.errors) {
        const message = Object.values(err.errors)
            .map((val) => val.message)
            .join(", ");
        error = new AppError(message, 400);
    }
    const statusCode = error.statusCode || 500;
    const response = {
        message: error.message || "Server Error"
    };
    // Always include stack trace for debugging
    response.stack = err.stack;
    response.error = err;
    // Log the full error to console
    console.error("[Error Handler] Full error:", err);
    console.error("[Error Handler] Stack:", err.stack);
    res.status(statusCode).json(response);
};
module.exports = errorHandler;
