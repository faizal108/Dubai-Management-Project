import { Prisma } from "@prisma/client";
import { ApiError } from "../lib/apiError.js";
import { logger } from "../lib/logger.js";
import { isProd } from "../lib/env.js";

function translatePrismaError(err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        return ApiError.conflict("Unique constraint violated", {
          target: err.meta?.target,
        });
      case "P2025":
        return ApiError.notFound("Record not found");
      case "P2003":
        return ApiError.badRequest("Foreign key constraint failed", {
          field: err.meta?.field_name,
        });
      default:
        return ApiError.badRequest(`Database error (${err.code})`);
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return ApiError.badRequest("Invalid database query");
  }
  return null;
}

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let apiErr = err instanceof ApiError ? err : translatePrismaError(err);
  if (!apiErr) {
    apiErr = ApiError.internal(err?.message || "Internal server error");
  }

  const payload = {
    error: {
      code: apiErr.code,
      message: apiErr.message,
      ...(apiErr.details ? { details: apiErr.details } : {}),
    },
  };

  if (apiErr.statusCode >= 500) {
    logger.error({ err, requestId: res.getHeader("x-request-id") }, "request failed");
    if (!isProd && err?.stack) payload.error.stack = err.stack;
  } else {
    logger.warn(
      {
        statusCode: apiErr.statusCode,
        code: apiErr.code,
        path: req.originalUrl,
      },
      "request rejected"
    );
  }

  res.status(apiErr.statusCode).json(payload);
}
