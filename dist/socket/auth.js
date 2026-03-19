"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
/**
 * Socket.io authentication middleware
 * Verifies JWT token from handshake.auth.token
 */
const socketAuthMiddleware = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error("Authentication error: No token provided"));
        }
        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Attach user info to socket
        socket.user = {
            id: decoded.id,
            email: decoded.email,
            name: decoded.name
        };
        next();
    }
    catch (error) {
        if (error instanceof Error) {
            return next(new Error(`Authentication error: ${error.message}`));
        }
        return next(new Error("Authentication error: Invalid token"));
    }
};
module.exports = socketAuthMiddleware;
