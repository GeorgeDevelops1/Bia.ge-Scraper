import * as fs from "fs";
import * as path from "path";
import { Business } from "../types/Business";
import { logger } from "./logger";

const ensureDir = (filePath: string) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export async function appendBusinessToJson(
  biz: Business,
  filePath: string
): Promise<void> {
  ensureDir(filePath);

  let existing: Business[] = [];
  if (fs.existsSync(filePath)) {
    try {
      const raw = await fs.promises.readFile(filePath, "utf-8");
      existing = raw ? (JSON.parse(raw) as Business[]) : [];
    } catch (err) {
      logger.warn(
        `Failed to read/parse existing JSON at ${filePath}, starting fresh: ${String(
          err
        )}`
      );
      existing = [];
    }
  }

  existing.push(biz);

  await fs.promises.writeFile(
    filePath,
    JSON.stringify(existing, null, 2),
    "utf-8"
  );
  logger.info(
    `JSON store updated at ${filePath}, total businesses: ${existing.length}`
  );
}

export async function readAllBusinessesFromJson(
  filePath: string
): Promise<Business[]> {
  if (!fs.existsSync(filePath)) return [];

  const raw = await fs.promises.readFile(filePath, "utf-8");
  if (!raw) return [];

  try {
    return JSON.parse(raw) as Business[];
  } catch (err) {
    logger.error(
      `Failed to parse JSON store at ${filePath}: ${String(err)}`
    );
    return [];
  }
}


