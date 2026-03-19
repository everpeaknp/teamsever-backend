"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const feedbackSchema = new mongoose_1.default.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    category: {
        type: String,
        required: true,
        enum: ['Bug Report', 'Feature Request', 'Support Question', 'General Feedback', 'Performance Issue']
    },
    workspace: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true
    },
    workspaceName: {
        type: String,
        required: true
    },
    submittedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    submittedByName: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'resolved'],
        default: 'pending'
    },
    resolvedAt: {
        type: Date
    }
}, {
    timestamps: true
});
// Indexes for performance
feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ status: 1 });
feedbackSchema.index({ workspace: 1 });
const FeedbackModel = mongoose_1.default.model("Feedback", feedbackSchema);
// Export for both CommonJS and ES6
module.exports = FeedbackModel;
exports.default = FeedbackModel;
