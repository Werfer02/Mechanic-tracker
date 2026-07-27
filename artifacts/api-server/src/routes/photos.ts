import { Router, json } from "express";
import { promises as fs } from "fs";
import path from "path";

const router = Router();

// Photos can be several MB each — override the default 100 kb body-parser limit
// just for these two routes so the rest of the API stays tight.
const largeJson = json({ limit: "25mb" });
const PHOTOS_DIR = path.resolve(process.cwd(), "data/photos");

/**
 * POST /photos
 * Body: { data: "<base64>", mimeType?: "image/jpeg" | "image/png" | "image/webp" }
 * Returns: { url: "/api/photos/<filename>" }
 *
 * Stores the image on disk and returns a stable path the client can use
 * to retrieve it later. Photos are immutable once written.
 */
router.post("/photos", largeJson, async (req, res) => {
  const { data, mimeType } = req.body as { data?: string; mimeType?: string };
  if (!data) {
    res.status(400).json({ error: "Missing data field (base64 image)" });
    return;
  }

  // Derive a safe extension from the declared mimeType
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg":  "jpg",
    "image/png":  "png",
    "image/webp": "webp",
    "image/gif":  "gif",
  };
  const ext = extMap[mimeType ?? ""] ?? "jpg";

  try {
    await fs.mkdir(PHOTOS_DIR, { recursive: true });
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const buffer = Buffer.from(data, "base64");
    await fs.writeFile(path.join(PHOTOS_DIR, filename), buffer);
    res.json({ url: `/api/photos/${filename}` });
  } catch (err) {
    res.status(500).json({ error: "Failed to save photo" });
  }
});

/**
 * GET /photos/:filename
 * Serves an uploaded photo by filename. Filenames are flat (no path separators).
 */
router.get("/photos/:filename", async (req, res) => {
  const { filename } = req.params;

  // Basic security: reject anything that looks like a path traversal attempt
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const filePath = path.join(PHOTOS_DIR, filename);
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filename).slice(1).toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
    };
    res.setHeader("Content-Type", mimeMap[ext] ?? "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(data);
  } catch {
    res.status(404).json({ error: "Photo not found" });
  }
});

export default router;
