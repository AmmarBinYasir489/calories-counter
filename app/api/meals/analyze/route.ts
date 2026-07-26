import { NextResponse } from "next/server";
import { z } from "zod";
import {
  analyzeMealImage,
  getGeminiModel,
  NonFoodImageError,
} from "@/lib/ai/meal-analysis";
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

type ProviderError = Error & {
  status?: number;
  code?: number | string;
};

function analysisFailure(error: unknown) {
  const providerError = error instanceof Error ? (error as ProviderError) : null;
  const status = providerError?.status;
  const message = providerError?.message.toLowerCase() ?? "";

  if (error instanceof NonFoodImageError) {
    return {
      status: 422,
      error: error.message,
      category: "non_food",
    };
  }
  if (message.includes("gemini_api_key is not configured")) {
    return {
      status: 503,
      error:
        "AI analysis is not configured. Add GEMINI_API_KEY to the Vercel environment.",
      category: "configuration",
    };
  }
  if (status === 429 || message.includes("quota") || message.includes("rate limit")) {
    return {
      status: 429,
      error:
        "The Gemini free-tier limit is temporarily exhausted. Please try again later.",
      category: "quota",
    };
  }
  if (status === 403 || message.includes("permission denied")) {
    return {
      status: 503,
      error:
        "Gemini API access is not enabled for the configured key.",
      category: "permission",
    };
  }
  if (
    status === 404 ||
    (message.includes("model") &&
      (message.includes("not found") ||
        message.includes("no longer available") ||
        message.includes("shut down") ||
        message.includes("not supported")))
  ) {
    return {
      status: 503,
      error:
        "The configured Gemini model is unavailable. Check GEMINI_MODEL in Vercel.",
      category: "model",
    };
  }
  if (
    error instanceof SyntaxError ||
    error instanceof z.ZodError ||
    message.includes("empty response")
  ) {
    return {
      status: 502,
      error:
        "Gemini returned an incomplete nutrition estimate. Please try the photo again.",
      category: "invalid_response",
    };
  }
  return {
    status: 503,
    error: "AI analysis is temporarily unavailable. Please try again.",
    category: "provider",
  };
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
    const failure = analysisFailure(error);
    const providerError = error instanceof Error ? (error as ProviderError) : null;
    console.error("meal_analysis.gemini_failed", {
      type: providerError?.name ?? "UnknownError",
      status: providerError?.status,
      code: providerError?.code,
      category: failure.category,
      model: getGeminiModel(),
    });
    return NextResponse.json(
      { error: failure.error, code: failure.category },
      { status: failure.status },
    );
  }
}
