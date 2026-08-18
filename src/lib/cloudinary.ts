import crypto from "node:crypto";

const CLOUDINARY_URL = (process.env.CLOUDINARY_URL ?? "").trim();

function parseCloudinaryUrl(url: string) {
  // Format: cloudinary://api_key:api_secret@cloud_name
  const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!match) throw new Error("Invalid CLOUDINARY_URL format");
  return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
}

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

export async function uploadToCloudinary(
  base64DataUrl: string,
  folder: string = "facility-tracker",
): Promise<UploadResult> {
  if (!CLOUDINARY_URL) {
    throw new Error("CLOUDINARY_URL is not configured");
  }

  const { apiKey, apiSecret, cloudName } = parseCloudinaryUrl(CLOUDINARY_URL);

  // Extract the base64 data and mime type
  const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid base64 data URL");

  const mimeType = match[1];
  const base64Data = match[2];
  const format = mimeType.split("/")[1] === "jpeg" ? "jpg" : mimeType.split("/")[1];

  // Generate a unique public ID
  const timestamp = Math.round(Date.now() / 1000);
  const publicId = `${folder}/${timestamp}_${crypto.randomBytes(4).toString("hex")}`;

  // Build the signature
  const paramsToSign: Record<string, string | number> = {
    folder,
    public_id: publicId.split("/").slice(1).join("/"),
    timestamp,
  };

  const sortedParams = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join("&");

  const signature = crypto
    .createHash("sha1")
    .update(sortedParams + apiSecret)
    .digest("hex");

  // Upload to Cloudinary
  const formData = new FormData();
  formData.append("file", `data:${mimeType};base64,${base64Data}`);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("public_id", publicId.split("/").slice(1).join("/"));
  formData.append("format", format);
  formData.append("transformation", "f_auto,q_auto,w_1200");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: formData },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cloudinary upload failed: ${error}`);
  }

  const result = await response.json();
  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
  };
}

export function getCloudinaryUrl(
  publicId: string,
  options: { width?: number; height?: number; format?: string } = {},
): string {
  if (!CLOUDINARY_URL) return "";
  const { cloudName } = parseCloudinaryUrl(CLOUDINARY_URL);
  let url = `https://res.cloudinary.com/${cloudName}/image/upload`;
  if (options.width || options.height) {
    const transforms: string[] = [];
    if (options.width) transforms.push(`w_${options.width}`);
    if (options.height) transforms.push(`h_${options.height}`);
    transforms.push("c_fill", "f_auto", "q_auto");
    url += `/${transforms.join("/")}`;
  } else {
    url += "/f_auto,q_auto";
  }
  url += `/${publicId}`;
  return url;
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (!CLOUDINARY_URL) return;
  const { apiKey, apiSecret, cloudName } = parseCloudinaryUrl(CLOUDINARY_URL);
  const timestamp = Math.round(Date.now() / 1000);
  const signature = crypto
    .createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_id: publicId, timestamp, api_key: apiKey, signature }),
    },
  );
}
