import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getDbPath(): string {
  return join(__dirname, "..", "..", "..", "data", "knowledge.db");
}
