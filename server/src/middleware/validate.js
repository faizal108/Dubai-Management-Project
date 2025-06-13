import { ZodError } from "zod";

/**
 * Wraps a Zod schema into Express middleware.
 * @param {ZodSchema} schema  — Zod schema for req.body/req.query/req.params
 * @param {'body'|'query'|'params'} source
 */
export function validate(schema, source = "body") {
  return (req, res, next) => {
    console.log("[validate] incoming payload:", req[source]);
    try {
      const parsed = schema.parse(req[source]);
      console.log("[validate] parsed successfully");
      req[source] = parsed;
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        console.log("[validate] ZOD ERROR:", err.issues);
        const [{ path, message }] = err.issues;
        return res.status(400).json({
          error: `Invalid ${source} parameter at "${path.join(
            "."
          )}": ${message}`,
        });
      }
      return next(err);
    }
  };
}
