"use client";

import { FormEvent, useState } from "react";
import { Sparkles } from "lucide-react";

type GenerateResponse = {
    imageUrl?: string;
    error?: string;
};

export function ImageGenScreen() {
    const [prompt, setPrompt] = useState("Clean accounting dashboard UI in navy and white, realistic product mockup");
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!prompt.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/image/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt }),
            });

            const data = (await response.json()) as GenerateResponse;

            if (!response.ok || !data.imageUrl) {
                throw new Error(data.error ?? "Failed to generate image");
            }

            setImageUrl(data.imageUrl);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to generate image");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section id="image-studio" className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-[#0B1F33]">AI Visual Studio</h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#0B1F33]/30 bg-[#0B1F33]/10 px-2.5 py-1 text-[11px] font-semibold text-[#0B1F33]">
                    <Sparkles className="h-3.5 w-3.5" /> OpenAI
                </span>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#5f6f87]" htmlFor="image-prompt">
                    Prompt
                </label>
                <textarea
                    id="image-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[90px] w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#0B1F33] outline-none ring-[#0B1F33]/30 focus:ring"
                    placeholder="Describe the visual you want to generate..."
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0B1F33] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#132d47] disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {isLoading ? "Generating..." : "Generate image"}
                </button>
            </form>

            <div className="mt-4 overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F9FAFB]">
                {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="AI generated visual" className="h-auto w-full object-cover" />
                ) : (
                    <div className="flex h-52 items-center justify-center px-4 text-center text-sm text-[#5f6f87]">
                        Your generated visual will appear here.
                    </div>
                )}
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </section>
    );
}
