import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeMealImage } from "@/lib/ai/meal-analysis";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "meal-images";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const AnalyzeRequestSchema = z.object({
  path: z.string().min(1).max(180),
});

function detectImageMime(bytes: Uint8Array) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    )
  ) {
    return "image/png";
  }

  const signature = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (
    bytes.length >= 12 &&
    signature(0, 4) === "RIFF" &&
    signature(8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const parsed = AnalyzeRequestSchema.safeParse(await request.json());
  if (!parsed.success || !parsed.data.path.startsWith(`${userId}/`)) {
    return NextResponse.json(
      { error: "Invalid meal image path" },
      { status: 422 },
    );
  }

  const pathPattern = new RegExp(
    `^${userId}/[0-9a-f-]{36}\\.(?:jpg|jpeg|png|webp)$`,
    "i",
  );
  if (!pathPattern.test(parsed.data.path)) {
    return NextResponse.json(
      { error: "Invalid meal image path" },
      { status: 422 },
    );
  }

  const storage = supabase.storage.from(BUCKET);
  const { data: image, error: downloadError } = await storage.download(
    parsed.data.path,
  );

  if (downloadError || !image) {
    console.error("meal_analysis.image_download_failed", {
      code: downloadError?.statusCode,
    });
    return NextResponse.json(
      { error: "Unable to read the uploaded image" },
      { status: 404 },
    );
  }

  if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    await storage.remove([parsed.data.path]);
    return NextResponse.json(
      { error: "Image must be smaller than 8 MB" },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await image.arrayBuffer());
  const mimeType = detectImageMime(bytes);
  if (!mimeType) {
    await storage.remove([parsed.data.path]);
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP meal photos are supported" },
      { status: 415 },
    );
  }

  try {
    const analysis = await analyzeMealImage(bytes, mimeType);
    return NextResponse.json({
      analysis,
      imagePath: parsed.data.path,
    });
  } catch (error) {
    await storage.remove([parsed.data.path]);
    console.error("meal_analysis.gemini_failed", {
      type: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "AI analysis is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
