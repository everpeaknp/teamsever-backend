"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { z } = require("zod");
const createCustomFieldSchema = z.object({
    name: z.string().min(1, "Custom field name is required").max(100, "Name cannot exceed 100 characters"),
    type: z.enum(["text", "number", "date", "dropdown", "checkbox", "user"]),
    options: z.array(z.string()).optional(),
    workspace: z.string().min(1, "Workspace ID is required"),
    project: z.string().optional()
}).refine((data) => {
    if (data.type === "dropdown") {
        return data.options && data.options.length > 0;
    }
    return true;
}, {
    message: "Dropdown fields must have at least one option",
    path: ["options"]
});
const updateCustomFieldSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    options: z.array(z.string()).optional()
});
const setCustomFieldValueSchema = z.object({
    customFieldId: z.string().min(1, "Custom field ID is required"),
    value: z.any()
});
const setMultipleCustomFieldValuesSchema = z.object({
    customFieldValues: z.array(z.object({
        field: z.string().min(1, "Custom field ID is required"),
        value: z.any()
    })).optional()
});
module.exports = {
    createCustomFieldSchema,
    updateCustomFieldSchema,
    setCustomFieldValueSchema,
    setMultipleCustomFieldValuesSchema
};
