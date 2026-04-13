import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "./config";
import { User } from "../types";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface TokenPayload {
  userId: number;
  email: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as TokenPayload;
}

export function getTokenExpiration(): Date {
  const expiresIn = config.JWT_EXPIRES_IN;
  const now = new Date();

  // Parse duration (e.g., '7d', '24h', '60m')
  const value = parseInt(expiresIn);
  const unit = expiresIn.slice(-1);

  switch (unit) {
    case "d":
      now.setDate(now.getDate() + value);
      break;
    case "h":
      now.setHours(now.getHours() + value);
      break;
    case "m":
      now.setMinutes(now.getMinutes() + value);
      break;
    default:
      now.setSeconds(now.getSeconds() + value);
  }

  return now;
}
