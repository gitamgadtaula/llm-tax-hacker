import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

export async function errorHandler(err: Error, c: Context) {
  console.error("Error:", err);

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
        status: err.status,
      },
      err.status,
    );
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: "Validation error",
        details: err.errors,
        status: 400,
      },
      400,
    );
  }

  // PostgreSQL unique constraint error
  if (
    err.message.includes("unique constraint") ||
    err.message.includes("duplicate key")
  ) {
    return c.json(
      {
        error: "Resource already exists",
        status: 409,
      },
      409,
    );
  }

  // Default error response
  return c.json(
    {
      error: "Internal server error",
      status: 500,
    },
    500,
  );
}
