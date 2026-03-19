"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { z } = require("zod");
const registerDeviceSchema = z.object({
    body: z.object({
        token: z.string().min(1, "Device token is required"),
        platform: z.enum(["web", "android", "ios"], {
            errorMap: () => ({ message: "Platform must be web, android, or ios" }),
        }),
    }),
    params: z.object({}).optional(),
    query: z.object({}).optional()
});
const unregisterDeviceSchema = z.object({
    body: z.object({
        token: z.string().min(1, "Device token is required"),
    }),
    params: z.object({}).optional(),
    query: z.object({}).optional()
});
module.exports = {
    registerDeviceSchema,
    unregisterDeviceSchema,
};
