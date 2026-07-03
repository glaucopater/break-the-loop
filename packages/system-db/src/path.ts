import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getSystemDbPath(): string {
  return join(__dirname, "..", "..", "..", "data", "system.db");
}
