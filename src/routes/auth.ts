import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sql } from "../db/config";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  getTokenExpiration,
} from "../utils/auth";
import { registerSchema, loginSchema } from "../utils/validation";
import { RegisterRequest, LoginRequest, AuthResponse } from "../types";

const authRoutes = new Hono();

// Register endpoint
authRoutes.post("/register", async (c) => {
  const body = await c.req.json<RegisterRequest>();

  // Validate input
  const validated = registerSchema.parse(body);

  // Check if user already exists
  const [existingUser] = await sql`
    SELECT id FROM users WHERE email = ${validated.email}
  `;

  if (existingUser) {
    throw new HTTPException(409, { message: "User already exists" });
  }

  // Hash password and create user
  const passwordHash = await hashPassword(validated.password);
  const [user] = await sql`
    INSERT INTO users (email, password_hash)
    VALUES (${validated.email}, ${passwordHash})
    RETURNING id, email, created_at
  `;

  // Generate token
  const token = generateToken({
    userId: user.id,
    email: user.email,
  });

  const expiresAt = getTokenExpiration();

  // Store token in database
  await sql`
    INSERT INTO auth_tokens (user_id, token, expires_at)
    VALUES (${user.id}, ${token}, ${expiresAt})
  `;

  const response: AuthResponse = {
    token,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
    },
  };

  return c.json(response, 201);
});

// Login endpoint
authRoutes.post("/login", async (c) => {
  const body = await c.req.json<LoginRequest>();

  // Validate input
  const validated = loginSchema.parse(body);

  // Find user
  const [user] = await sql`
    SELECT id, email, password_hash
    FROM users
    WHERE email = ${validated.email}
  `;

  if (!user) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }

  // Verify password
  const isValid = await verifyPassword(validated.password, user.password_hash);
  if (!isValid) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }

  // Generate token
  const token = generateToken({
    userId: user.id,
    email: user.email,
  });

  const expiresAt = getTokenExpiration();

  // Clean up old tokens for this user
  await sql`
    DELETE FROM auth_tokens
    WHERE user_id = ${user.id}
    AND expires_at < NOW()
  `;

  // Store new token
  await sql`
    INSERT INTO auth_tokens (user_id, token, expires_at)
    VALUES (${user.id}, ${token}, ${expiresAt})
  `;

  const response: AuthResponse = {
    token,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
    },
  };

  return c.json(response);
});

// Logout endpoint (optional)
authRoutes.post("/logout", async (c) => {
  const authHeader = c.req.header("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);

    // Delete token from database
    await sql`
      DELETE FROM auth_tokens
      WHERE token = ${token}
    `;
  }

  return c.json({ message: "Logged out successfully" });
});

export default authRoutes;
