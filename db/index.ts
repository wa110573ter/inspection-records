import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

declare global {
  // Set by the Worker entry point for server-side route handlers.
  var __INSPECTION_ENV__:
    | { DB?: D1Database; BUCKET?: R2Bucket }
    | undefined;
}

export function getDb() {
  const database = globalThis.__INSPECTION_ENV__?.DB;
  if (!database) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(database, { schema });
}

export function getBucket() {
  const bucket = globalThis.__INSPECTION_ENV__?.BUCKET;
  if (!bucket) {
    throw new Error("檔案儲存空間尚未啟用");
  }
  return bucket;
}
