import { readLocalObject } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ key: string[] }> },
) {
  const { key } = await ctx.params;
  const buffer = await readLocalObject(key.join("/"));
  if (!buffer) return new Response("Not found", { status: 404 });
  const ext = key[key.length - 1]?.split(".").pop() ?? "jpg";
  const mime =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
