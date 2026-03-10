import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors.js";
import { z } from "zod";

/**
 * Global error-handling middleware.
 * Maps AppError subtypes and ZodErrors to structured JSON responses.
 * Unknown errors get a generic 500 (stack hidden in production).
 */
export function errorHandler(
  err: Error & { status?: number; type?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof SyntaxError && err.status === 400 && err.type === "entity.parse.failed") {
    res.status(400).json({ error: "Malformed JSON request body." });
    return;
  }

  // Zod validation errors → 400
  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: "Validation failed.",
      details: err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  // Custom application errors → their statusCode
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Everything else → 500
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error.",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}
