import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Writes a file atomically: write to a temp file in the same folder, then rename.
 * A crash or a concurrent reader never sees a half-written JSON file.
 */
export function writeFileAtomic(file: string, data: string): void {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`);
  fs.writeFileSync(tmp, data, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, file);
}
