import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { getDuplicateMessage } from "../constants/error.constants";
import type { ErrorModule } from "../constants/error.constants";

interface DatabaseError extends Error {
  code?: string;
  errno?: number;
  sqlMessage?: string;
}

interface ErrorLocals {
  errorModule?: ErrorModule;
}

const isDatabaseError = (error: unknown): error is DatabaseError => {
  return (
    error instanceof Error && "code" in error && typeof error.code === "string"
  );
};

export const errorMiddleware = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (res.headersSent) {
    next(error);
    return;
  }

  let statusCode = 500;
  let message = "Internal server error";

  const locals = res.locals as ErrorLocals;

  if (error instanceof AppError) {
    statusCode = error.isOperational ? error.statusCode : 500;

    message = error.isOperational ? error.message : "Internal server error";
  } else if (isDatabaseError(error)) {
    switch (error.code) {
      case "ER_DUP_ENTRY": {
        statusCode = 409;

        const module = res.locals.errorModule as ErrorModule | undefined;

        message = module
          ? getDuplicateMessage(module)
          : "A record with this value already exists";

        break;
      }

      case "ER_NO_REFERENCED_ROW_2":
      case "ER_ROW_IS_REFERENCED_2":
        statusCode = 400;
        message = "Invalid reference or related record";
        break;

      case "ER_CHECK_CONSTRAINT_VIOLATED":
        statusCode = 400;
        message = "Data violates database constraints";
        break;

      case "ER_BAD_NULL_ERROR":
        statusCode = 400;
        message = "Required database field cannot be null";
        break;

      case "ER_DATA_TOO_LONG":
        statusCode = 400;
        message = "One or more fields exceed the allowed length";
        break;

      case "ER_WARN_DATA_OUT_OF_RANGE":
        statusCode = 400;
        message = "One or more numeric fields are out of range";
        break;

      default:
        statusCode = 500;
        message = "Database operation failed";
        break;
    }
  }

  // Log internal details; never expose SQL messages or stack traces.
  console.error({
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    path: req.originalUrl,
    method: req.method,
    module: locals.errorModule,
    statusCode,
  });

  res.status(statusCode).json({
    success: false,
    message,
  });
};
