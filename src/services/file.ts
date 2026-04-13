import { writeFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import sharp from "sharp";
import { randomUUID } from "crypto";

export class FileService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = join(process.cwd(), "uploads");
  }

  async ensureUploadDir(): Promise<void> {
    if (!existsSync(this.uploadDir)) {
      await mkdir(this.uploadDir, { recursive: true });
    }
  }

  async saveFile(
    buffer: Buffer,
    filename: string,
    userId: number,
  ): Promise<string> {
    await this.ensureUploadDir();

    // Create user-specific directory
    const userDir = join(this.uploadDir, userId.toString());
    if (!existsSync(userDir)) {
      await mkdir(userDir, { recursive: true });
    }

    // Generate unique filename
    const fileId = randomUUID();
    const extension = filename.split(".").pop() || "jpg";
    const savedFilename = `${fileId}.${extension}`;
    const filePath = join(userDir, savedFilename);

    await writeFile(filePath, buffer);

    return `${userId}/${savedFilename}`;
  }

  async getFile(filePath: string): Promise<Buffer> {
    const fullPath = join(this.uploadDir, filePath);
    return readFile(fullPath);
  }

  async convertToBase64(buffer: Buffer): Promise<string> {
    // Resize image if too large to save on API costs
    const resized = await sharp(buffer)
      .resize(2000, 2000, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    return resized.toString("base64");
  }

  async getFileBase64(filePath: string): Promise<string> {
    const buffer = await this.getFile(filePath);
    return this.convertToBase64(buffer);
  }
}
