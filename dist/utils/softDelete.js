"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AppError = require("./AppError");
const softDelete = async (model, id) => {
    const document = await model.findById(id);
    if (!document) {
        throw new AppError(`${model.modelName} not found`, 404);
    }
    if (document.isDeleted) {
        throw new AppError(`${model.modelName} is already deleted`, 400);
    }
    document.isDeleted = true;
    document.deletedAt = new Date();
    await document.save();
    return document;
};
module.exports = softDelete;
