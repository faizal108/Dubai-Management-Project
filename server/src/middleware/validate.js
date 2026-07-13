import { ApiError } from "../lib/apiError.js";

// Validates a request against optional zod schemas for body / params / query.
// Replaces req.* with the parsed values so downstream code gets typed/coerced data.
export function validate({ body, params, query } = {}) {
  return (req, _res, next) => {
    try {
      if (params) {
        const parsed = params.safeParse(req.params);
        if (!parsed.success) {
          return next(
            ApiError.badRequest("Invalid path parameters", parsed.error.flatten())
          );
        }
        req.params = parsed.data;
      }
      if (query) {
        const parsed = query.safeParse(req.query);
        if (!parsed.success) {
          return next(
            ApiError.badRequest("Invalid query parameters", parsed.error.flatten())
          );
        }
        // Express 5 exposes req.query as a getter-only property, so we
        // redefine it instead of assigning.
        Object.defineProperty(req, "query", {
          value: parsed.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (body) {
        const parsed = body.safeParse(req.body);
        if (!parsed.success) {
          return next(
            ApiError.unprocessable("Invalid request body", parsed.error.flatten())
          );
        }
        req.body = parsed.data;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
