import { Router } from "express";
import { promises as fs } from "fs";
import path from "path";

const router = Router();

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "mechanic-desktop.json");

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ vehicles: [], jobs: [] }, null, 2), "utf-8");
  }
}

async function readData() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw) as { vehicles: unknown[]; jobs: unknown[] };
}

router.get("/desktop-data", async (_req, res) => {
  try {
    const data = await readData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to read desktop data" });
  }
});

router.put("/desktop-data", async (req, res) => {
  try {
    await ensureDataFile();
    const { vehicles, jobs } = req.body as { vehicles: unknown[]; jobs: unknown[] };
    await fs.writeFile(
      DATA_FILE,
      JSON.stringify({ vehicles: vehicles ?? [], jobs: jobs ?? [] }, null, 2),
      "utf-8"
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save desktop data" });
  }
});

export default router;
