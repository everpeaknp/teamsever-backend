import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";

const AppError = require("./AppError");

const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse the entire request object (body, params, query)
      const result = schema.safeParse({
        body: req.body,
        params: req.params,
        query: req.query
      });

      if (!result.success) {
        // Safety check: ensure errors array exists
        const zodError = result.error as any;
        if (!zodError || !zodError.errors || !Array.isArray(zodError.errors)) {
          console.error('[Validation] Unknown validation error:', zodError);
          return next(new AppError("Validation failed", 400));
        }

        const errors = zodError.errors.map((err: any) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code
        }));

        console.error('[Validation] Validation errors:', errors);
        console.error('[Validation] Request body:', JSON.stringify(req.body, null, 2));

        return next(new AppError(
          `Validation failed: ${errors.map((e: any) => `${e.field}: ${e.message}`).join(", ")}`,
          400
        ));
      }

      // Don't reassign req properties - they're already validated
      // The validated data is the same as the original request data
      
      next();
    } catch (error) {
      console.error('[Validation] Exception during validation:', error);
      next(error);
    }
  };
};

module.exports = validate;
export {};
