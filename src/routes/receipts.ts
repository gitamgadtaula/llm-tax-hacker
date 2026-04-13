import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sql } from "../db/config";
import { authMiddleware } from "../middleware/auth";
import { getLLMProvider } from "../services/llm";
import { FileService } from "../services/file";
import { config, getAllowedFileTypes } from "../utils/config";
import { Receipt, ReceiptAnalysis } from "../types";

const receiptsRoutes = new Hono();
const fileService = new FileService();

// Apply auth middleware to all routes
receiptsRoutes.use("*", authMiddleware);

// Upload and analyze receipt
receiptsRoutes.post("/analyze", async (c) => {
  const auth = c.get("auth");

  // Parse multipart form data
  const formData = await c.req.parseBody();
  const file = formData["image"];

  if (!file || !(file instanceof File)) {
    throw new HTTPException(400, { message: "No image file provided" });
  }

  // Validate file type
  const allowedTypes = getAllowedFileTypes();
  if (!allowedTypes.includes(file.type)) {
    throw new HTTPException(400, {
      message: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
    });
  }

  // Validate file size
  if (file.size > config.MAX_FILE_SIZE) {
    throw new HTTPException(400, {
      message: `File too large. Maximum size: ${config.MAX_FILE_SIZE / 1048576}MB`,
    });
  }

  try {
    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Save file
    const filePath = await fileService.saveFile(buffer, file.name, auth.userId);

    // Create receipt record
    const [receipt] = await sql`
      INSERT INTO receipts (user_id, filename, file_path, mime_type, file_size)
      VALUES (${auth.userId}, ${file.name}, ${filePath}, ${file.type}, ${file.size})
      RETURNING id, filename, file_path, mime_type, file_size, uploaded_at
    `;

    // Convert to base64 for LLM
    const imageBase64 = await fileService.convertToBase64(buffer);

    // Analyze with LLM
    const llmProvider = getLLMProvider();
    const analysis = await llmProvider.analyzeReceipt(imageBase64);

    // Save analysis
    const [savedAnalysis] = await sql`
      INSERT INTO receipt_analyses (
        receipt_id, name, merchant, description, type, issued_at,
        category, location, note, contact, transactions,
        tax, vat, other_charges, total, raw_llm_response
      ) VALUES (
        ${receipt.id}, ${analysis.name}, ${analysis.merchant}, 
        ${analysis.description}, ${analysis.type}, ${analysis.issued_at},
        ${analysis.category}, ${analysis.location}, ${analysis.note}, 
        ${analysis.contact}, ${JSON.stringify(analysis.transactions)},
        ${analysis.tax}, ${analysis.vat}, ${analysis.other_charges}, 
        ${analysis.total}, ${JSON.stringify(analysis)}
      ) RETURNING id
    `;

    return c.json(
      {
        receipt: {
          id: receipt.id,
          filename: receipt.filename,
          uploadedAt: receipt.uploaded_at,
        },
        analysis: {
          id: savedAnalysis.id,
          ...analysis,
        },
      },
      201,
    );
  } catch (error) {
    console.error("Receipt analysis error:", error);
    if (
      error instanceof Error &&
      error.message === "Failed to analyze receipt"
    ) {
      throw new HTTPException(500, {
        message: "Failed to analyze receipt. Please try again.",
      });
    }
    throw error;
  }
});

// Get receipt analysis
receiptsRoutes.get("/:id/analysis", async (c) => {
  const auth = c.get("auth");
  const receiptId = parseInt(c.req.param("id"));

  if (isNaN(receiptId)) {
    throw new HTTPException(400, { message: "Invalid receipt ID" });
  }

  // Get receipt and analysis
  const [result] = await sql`
    SELECT 
      r.id as receipt_id,
      r.filename,
      r.file_path,
      r.mime_type,
      r.file_size,
      r.uploaded_at,
      a.id as analysis_id,
      a.name,
      a.merchant,
      a.description,
      a.type,
      a.issued_at,
      a.category,
      a.location,
      a.note,
      a.contact,
      a.transactions,
      a.tax,
      a.vat,
      a.other_charges,
      a.total,
      a.created_at as analyzed_at
    FROM receipts r
    LEFT JOIN receipt_analyses a ON a.receipt_id = r.id
    WHERE r.id = ${receiptId} AND r.user_id = ${auth.userId}
  `;

  if (!result) {
    throw new HTTPException(404, { message: "Receipt not found" });
  }

  const response = {
    receipt: {
      id: result.receipt_id,
      filename: result.filename,
      mimeType: result.mime_type,
      fileSize: result.file_size,
      uploadedAt: result.uploaded_at,
    },
    analysis: result.analysis_id
      ? {
          id: result.analysis_id,
          name: result.name,
          merchant: result.merchant,
          description: result.description,
          type: result.type,
          issued_at: result.issued_at,
          category: result.category,
          location: result.location,
          note: result.note,
          contact: result.contact,
          transactions: result.transactions,
          tax: result.tax,
          vat: result.vat,
          other_charges: result.other_charges,
          total: result.total,
          analyzedAt: result.analyzed_at,
        }
      : null,
  };

  return c.json(response);
});

// List user's receipts
receiptsRoutes.get("/", async (c) => {
  const auth = c.get("auth");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");

  const receipts = await sql`
    SELECT 
      r.id,
      r.filename,
      r.file_size,
      r.uploaded_at,
      a.merchant,
      a.total,
      a.issued_at,
      a.type,
      a.category
    FROM receipts r
    LEFT JOIN receipt_analyses a ON a.receipt_id = r.id
    WHERE r.user_id = ${auth.userId}
    ORDER BY r.uploaded_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [{ count }] = await sql`
    SELECT COUNT(*) FROM receipts WHERE user_id = ${auth.userId}
  `;

  return c.json({
    receipts,
    pagination: {
      limit,
      offset,
      total: parseInt(count),
    },
  });
});

export default receiptsRoutes;
