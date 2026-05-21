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
        // zod returns `error.issues`; some tests/mocks may provide `error.errors`.
        const zodError = result.error as any;
        const rawIssues = zodError.issues || zodError.errors || [];
        const errors = rawIssues.map((err: any) => {
          const path = Array.isArray(err.path) ? err.path.join('.') : (err.path || '');
          return `${path}: ${err.message}`;
        });
        console.error('[Validation] Validation errors:', errors);
        console.error('[Validation] Request body:', JSON.stringify(req.body, null, 2));

        const errorMessage = errors.join(", ");

        return next(new AppError(
          `Validation failed: ${errorMessage}`,
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
