import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const photo = String(body.photo ?? "");
  const folder = String(body.folder ?? "facility-tracker");

  if (!photo || !photo.startsWith("data:")) {
    return NextResponse.json({ error: "Invalid photo data" }, { status: 400 });
  }

  try {
    const result = await uploadToCloudinary(photo, folder);
    return NextResponse.json({
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
    });
  } catch (err) {
    console.error("Photo upload failed:", err);
    return NextResponse.json(
      { error: "Photo upload failed" },
      { status: 500 },
    );
  }
}
