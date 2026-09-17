// Centralized Express error handling for consistent SupportAI API responses.
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { AppError } from "../errors/app-error";
import "../types";

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  const context = req.context;
  const requestId = context?.requestId ?? "req_unknown";
  if (error instanceof multer.MulterError || (error instanceof SyntaxError && "body" in error)) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", requestId,
      message: error instanceof multer.MulterError ? (error.code === "LIMIT_FILE_SIZE" ? "Documents must be 10 MB or smaller." : "Choose one PDF or TXT file.") : "Request body must be valid JSON." } });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: error.issues.map((issue) => issue.message).join("; "),
        requestId
      }
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        requestId
      }
    });
    return;
  }

  console.error(JSON.stringify({ level: "error", requestId, message: "Unhandled API error", error }));
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId
    }
  });
}
