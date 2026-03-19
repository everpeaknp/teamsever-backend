"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 2,
        });
        console.log("MongoDB Connected");
    }
    catch (error) {
        console.error("MongoDB Connection Error:", error);
        process.exit(1);
    }
};
module.exports = connectDB;
