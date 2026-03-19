"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jwt = require("jsonwebtoken");
const generateToken = (id, email, name) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not defined in environment variables");
    }
    const payload = { id, email, name };
    return jwt.sign(payload, secret, {
        expiresIn: "7d"
    });
};
module.exports = generateToken;
