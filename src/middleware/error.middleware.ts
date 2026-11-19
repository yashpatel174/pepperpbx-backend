import { Request, Response, NextFunction } from "express";

import { AppError } from "../utils/AppError";

interface DatabaseError extends Error {
  code?: string;
  errno?: number;
  sqlMessage?: string;
}

const isDatabaseError = (error: unknown): error is DatabaseError => {
  return error instanceof Error && "code" in error;
};

export const errorMiddleware = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = 500;
  let message = "Internal server error";

  if (error instanceof AppError) {
    statusCode = error.statusCode;

    message = error.isOperational ? error.message : "Internal server error";
  } else if (isDatabaseError(error)) {
    switch (error.code) {
      case "ER_DUP_ENTRY":
        statusCode = 409;
        message = "A record with the provided unique value already exists";
        break;

      case "ER_NO_REFERENCED_ROW_2":
      case "ER_ROW_IS_REFERENCED_2":
        statusCode = 400;
        message = "Invalid reference or related record";
        break;

      case "ER_CHECK_CONSTRAINT_VIOLATED":
        statusCode = 400;
        message = "Gateway data violates database constraints";
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

  console.error({
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    path: req.originalUrl,
    method: req.method,
  });

  res.status(statusCode).json({
    success: false,
    message,
  });
};
