import { sql } from "./config";
import { readFileSync } from "fs";
import { join } from "path";

async function migrate() {
  try {
    console.log("Starting database migration...");

    // Read schema file
    const schemaPath = join(__dirname, "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");

    // Execute schema
    await sql.unsafe(schema);

    console.log("Database migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
