import { Model, Document } from "mongoose";

const AppError = require("./AppError");

interface SoftDeletableDocument extends Document {
  isDeleted: boolean;
  deletedAt?: Date;
}

const softDelete = async (model: Model<SoftDeletableDocument>, id: string): Promise<SoftDeletableDocument> => {
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
export {};
