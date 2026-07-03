import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const envPath = join(repoRoot, ".env");

if (existsSync(envPath)) {
  config({ path: envPath });
}

export { repoRoot };
