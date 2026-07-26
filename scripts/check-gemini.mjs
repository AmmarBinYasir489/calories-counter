import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

if (!apiKey) {
  console.error("Gemini check failed: GEMINI_API_KEY is not set.");
  process.exitCode = 1;
} else {
  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model,
      contents: [
        {
          inlineData: {
            mimeType: "image/png",
            data:
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          },
        },
        {
          text:
            'This is a connectivity test. Return JSON with "ok" set to true.',
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
          },
          required: ["ok"],
          additionalProperties: false,
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    if (parsed.ok !== true) {
      throw new Error("Gemini returned an unexpected structured response.");
    }

    console.log(`Gemini check passed: ${model} accepted image input and JSON output.`);
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? error.status
        : undefined;
    const message =
      error instanceof Error
        ? error.message.replaceAll(apiKey, "<redacted>")
        : "Unknown provider error";

    console.error(
      `Gemini check failed${status ? ` (${status})` : ""}: ${message}`,
    );
    process.exitCode = 1;
  }
}
