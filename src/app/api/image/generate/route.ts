import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type OpenAIImageResponse = {
    data?: Array<{
        b64_json?: string;
        url?: string;
    }>;
    error?: {
        message?: string;
    };
};

export async function POST(request: NextRequest) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
    }

    const body = (await request.json().catch(() => null)) as { prompt?: string } | null;
    const prompt = body?.prompt?.trim();

    if (!prompt) {
        return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const upstream = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-image-1",
            prompt,
            size: "1536x1024",
        }),
    });

    const result = (await upstream.json().catch(() => null)) as OpenAIImageResponse | null;

    if (!upstream.ok) {
        return NextResponse.json(
            { error: result?.error?.message ?? "OpenAI image generation failed." },
            { status: upstream.status || 500 },
        );
    }

    const image = result?.data?.[0];
    if (!image?.b64_json && !image?.url) {
        return NextResponse.json({ error: "No image returned from OpenAI." }, { status: 502 });
    }

    const imageUrl = image.b64_json ? `data:image/png;base64,${image.b64_json}` : image.url;
    return NextResponse.json({ imageUrl });
}
