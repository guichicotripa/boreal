// BigQuery client — server-only (uses service account key).
// Never import this in client components.
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";

let _client: BigQuery | null = null;

export function getBigQueryClient(): BigQuery {
  if (_client) return _client;

  const projectId = process.env.GCP_PROJECT_ID;
  const keyRelPath = process.env.GCP_KEY_PATH;

  if (!projectId || !keyRelPath) {
    throw new Error(
      "Missing GCP_PROJECT_ID or GCP_KEY_PATH in environment. Check .env.local."
    );
  }

  // Resolve relative to project root (process.cwd() = C:\boreal when running Next.js / scripts)
  const keyFilename = path.resolve(process.cwd(), keyRelPath);

  _client = new BigQuery({ projectId, keyFilename });
  return _client;
}
