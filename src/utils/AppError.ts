import { Response } from "express";
import { getDuplicateMessage } from "../constants/error.constants";
import type { ErrorModule } from "../constants/error.constants";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace?.(this, this.constructor);
  }

  static duplicate(module: ErrorModule): AppError {
    return new AppError(getDuplicateMessage(module), 409);
  }

  static notFound(entity: string): AppError {
    return new AppError(`${entity} not found`, 404);
  }

  static validation(message: string): AppError {
    return new AppError(message, 400);
  }

  static unauthorized(message = "Unauthorized access"): AppError {
    return new AppError(message, 401);
  }

  static forbidden(message = "Access denied"): AppError {
    return new AppError(message, 403);
  }

  static conflict(message: string): AppError {
    return new AppError(message, 409);
  }
}

export const handleError = (res: Response, error: unknown): Response => {
  // Handle MySQL duplicate entry errors.
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ER_DUP_ENTRY"
  ) {
    return res.status(409).json({
      success: false,
      message: "Extension already exists under this user context",
    });
  }

  // Handle custom application errors.
  if (error instanceof Error) {
    const message = error.message;

    if (message === "Extension already exists under this user context") {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    if (message === "Extension not found") {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    // Validation errors.
    const validationErrors = [
      "Extension UUID is required",
      "Valid payload is required",
      "Extension is required",
      "User context is required",
      "Account code is required",
    ];

    if (
      validationErrors.includes(message) ||
      message.startsWith("Invalid fields:")
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    // Return other application errors.
    return res.status(500).json({
      success: false,
      message,
    });
  }

  // Handle unexpected errors.
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
