import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { verifyToken } from "../utils/auth";
import { sql } from "../db/config";

export interface AuthContext {
  userId: number;
  email: string;
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HTTPException(401, {
      message: "Missing or invalid authorization header",
    });
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT token
    const payload = verifyToken(token);

    // Check if token exists in database and is not expired
    const [authToken] = await sql`
      SELECT * FROM auth_tokens 
      WHERE token = ${token} 
        AND expires_at > NOW()
        AND user_id = ${payload.userId}
    `;

    if (!authToken) {
      throw new HTTPException(401, { message: "Invalid or expired token" });
    }

    // Add user info to context
    c.set("auth", {
      userId: payload.userId,
      email: payload.email,
    });

    await next();
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(401, { message: "Invalid token" });
  }
}
