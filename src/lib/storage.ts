import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Object-storage abstraction. Photos never live in Postgres — only their keys.
 * If S3-compatible credentials are configured we upload there, otherwise we
 * fall back to a local object store on disk (dev / sandbox).
 */
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_BUCKET = process.env.S3_BUCKET;
const S3_KEY = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET = process.env.S3_SECRET_ACCESS_KEY;
const S3_REGION = process.env.S3_REGION ?? "us-east-1";

const LOCAL_DIR = path.join(process.cwd(), ".data", "uploads");

export type StoredObject = { key: string; url: string };

function extFromMime(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

export function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl.trim());
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

async function putS3(key: string, body: Buffer, mime: string): Promise<StoredObject> {
  const url = `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const shortDate = date.slice(0, 8);
  const payloadHash = crypto.createHash("sha256").update(body).digest("hex");
  const host = new URL(S3_ENDPOINT!).host;
  const canonical = [
    "PUT",
    `/${S3_BUCKET}/${key}`,
    "",
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${date}`,
    "",
    "host;x-amz-content-sha256;x-amz-date",
    payloadHash,
  ].join("\n");
  const scope = `${shortDate}/${S3_REGION}/s3/aws4_request`;
  const toSign = [
    "AWS4-HMAC-SHA256",
    date,
    scope,
    crypto.createHash("sha256").update(canonical).digest("hex"),
  ].join("\n");
  let signingKey: Buffer = crypto
    .createHmac("sha256", `AWS4${S3_SECRET}`)
    .update(shortDate)
    .digest();
  for (const part of [S3_REGION, "s3", "aws4_request"]) {
    signingKey = crypto.createHmac("sha256", signingKey).update(part).digest();
  }
  const signature = crypto.createHmac("sha256", signingKey).update(toSign).digest("hex");
  await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": mime,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": date,
      Authorization: `AWS4-HMAC-SHA256 Credential=${S3_KEY}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`,
    },
    body: new Uint8Array(body),
  });
  return { key, url };
}

export async function putObject(
  buffer: Buffer,
  mime: string,
  prefix = "photos",
): Promise<StoredObject> {
  const key = `${prefix}/${new Date().toISOString().slice(0, 10)}/${crypto
    .randomUUID()
    .slice(0, 12)}.${extFromMime(mime)}`;

  if (S3_ENDPOINT && S3_BUCKET && S3_KEY && S3_SECRET) {
    try {
      return await putS3(key, buffer, mime);
    } catch {
      // fall through to local storage
    }
  }

  const target = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return { key, url: `/api/photos/file/${key}` };
}

export async function readLocalObject(key: string): Promise<Buffer | null> {
  const safe = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  try {
    return await fs.readFile(path.join(LOCAL_DIR, safe));
  } catch {
    return null;
  }
}
