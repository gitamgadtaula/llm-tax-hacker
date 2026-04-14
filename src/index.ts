import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { HTTPException } from "hono/http-exception";

import { swaggerUI } from "@hono/swagger-ui";
import authRoutes from "./routes/auth";
import receiptsRoutes from "./routes/receipts";
import { errorHandler } from "./middleware/error";
import { config } from "./utils/config";

// OpenAPI documentation
const openApiDoc = {
  openapi: "3.0.0",
  info: {
    title: "Tax LLM API",
    version: "1.0.0",
    description:
      "API for analyzing receipts and managing tax-related documents using LLM",
  },
  servers: [
    {
      url: process.env.APP_URL || "http://localhost:3000",
      description: "Development server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "integer" },
          email: { type: "string", format: "email" },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          token: { type: "string" },
          expiresAt: { type: "string", format: "date-time" },
          user: { $ref: "#/components/schemas/User" },
        },
      },
      Transaction: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
        },
      },
      ReceiptAnalysis: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          merchant: { type: "string" },
          description: { type: "string" },
          type: {
            type: "string",
            enum: ["expense", "income", "pending", "other"],
          },
          issued_at: { type: "string", format: "date" },
          category: { type: "string" },
          location: { type: "string", nullable: true },
          note: { type: "string", nullable: true },
          contact: { type: "string", nullable: true },
          transactions: {
            type: "array",
            items: { $ref: "#/components/schemas/Transaction" },
          },
          tax: { type: "number", nullable: true },
          vat: { type: "number", nullable: true },
          other_charges: { type: "number", nullable: true },
          total: { type: "number" },
          analyzedAt: { type: "string", format: "date-time" },
        },
      },
      Receipt: {
        type: "object",
        properties: {
          id: { type: "integer" },
          filename: { type: "string" },
          mimeType: { type: "string" },
          fileSize: { type: "integer" },
          uploadedAt: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
          status: { type: "integer" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        tags: ["System"],
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/register": {
      post: {
        summary: "Register a new user",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    description: "User's email address",
                  },
                  password: {
                    type: "string",
                    minLength: 8,
                    description: "Password (minimum 8 characters)",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "User successfully registered",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "409": {
            description: "User already exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "Login with email and password",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    description: "User's email address",
                  },
                  password: {
                    type: "string",
                    description: "User's password",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          "401": {
            description: "Invalid email or password",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        summary: "Logout current user",
        tags: ["Authentication"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Logged out successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      example: "Logged out successfully",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/receipts/analyze": {
      post: {
        summary: "Upload and analyze a receipt image",
        tags: ["Receipts"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["image"],
                properties: {
                  image: {
                    type: "string",
                    format: "binary",
                    description: "Receipt image file",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Receipt uploaded and analyzed successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    receipt: { $ref: "#/components/schemas/Receipt" },
                    analysis: { $ref: "#/components/schemas/ReceiptAnalysis" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid file or validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Analysis failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/receipts/{id}/analysis": {
      get: {
        summary: "Get analysis results for a receipt",
        tags: ["Receipts"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            description: "Receipt ID",
          },
        ],
        responses: {
          "200": {
            description: "Receipt analysis retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    receipt: { $ref: "#/components/schemas/Receipt" },
                    analysis: {
                      nullable: true,
                      $ref: "#/components/schemas/ReceiptAnalysis",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid receipt ID",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Receipt not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/receipts": {
      get: {
        summary: "List user's receipts",
        tags: ["Receipts"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "limit",
            schema: { type: "integer", default: 50 },
            description: "Number of receipts to return",
          },
          {
            in: "query",
            name: "offset",
            schema: { type: "integer", default: 0 },
            description: "Number of receipts to skip",
          },
        ],
        responses: {
          "200": {
            description: "Receipts retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    receipts: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "integer" },
                          filename: { type: "string" },
                          file_size: { type: "integer" },
                          uploaded_at: { type: "string", format: "date-time" },
                          merchant: { type: "string", nullable: true },
                          total: { type: "number", nullable: true },
                          issued_at: { type: "string", nullable: true },
                          type: { type: "string", nullable: true },
                          category: { type: "string", nullable: true },
                        },
                      },
                    },
                    pagination: {
                      type: "object",
                      properties: {
                        limit: { type: "integer" },
                        offset: { type: "integer" },
                        total: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: "System",
      description: "System endpoints",
    },
    {
      name: "Authentication",
      description: "User authentication endpoints",
    },
    {
      name: "Receipts",
      description: "Receipt management and analysis endpoints",
    },
  ],
};

const app = new Hono();

// Global middleware
app.use("*", cors());
app.use("*", logger());
app.use("*", prettyJSON());

// Serve the OpenAPI document
app.get("/doc", (c) => c.json(openApiDoc));

// Use the middleware to serve Swagger UI at /ui
app.get("/ui", swaggerUI({ url: "/doc" }));

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API documentation
app.get("/", (c) => {
  return c.json({
    name: "Tax LLM API",
    version: "1.0.0",
    endpoints: {
      "POST /api/auth/register": {
        description: "Register a new user",
        body: {
          email: "string",
          password: "string (min 8 chars)",
        },
      },
      "POST /api/auth/login": {
        description: "Login with email and password",
        body: {
          email: "string",
          password: "string",
        },
      },
      "POST /api/receipts/analyze": {
        description: "Upload and analyze a receipt image",
        headers: {
          Authorization: "Bearer <token>",
        },
        body: 'multipart/form-data with "image" field',
      },
      "GET /api/receipts/:id/analysis": {
        description: "Get analysis results for a receipt",
        headers: {
          Authorization: "Bearer <token>",
        },
      },
      "GET /api/receipts": {
        description: "List user receipts",
        headers: {
          Authorization: "Bearer <token>",
        },
        queryParams: {
          limit: "number (default: 50)",
          offset: "number (default: 0)",
        },
      },
    },
  });
});

// Mount routes
app.route("/api/auth", authRoutes);
app.route("/api/receipts", receiptsRoutes);

// Error handler
app.onError(errorHandler);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found", status: 404 }, 404);
});

const port = parseInt(config.PORT);
console.log(`Starting server on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`Server running at http://localhost:${port}`);
console.log(`Environment: ${config.NODE_ENV}`);
console.log(`LLM Provider: ${config.LLM_PROVIDER}`);
