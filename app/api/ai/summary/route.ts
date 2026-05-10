import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tableName: z.string().min(1),
  headers: z.array(z.string()),
  /** sample of rows (limit on the client; we trim again here) */
  rows: z.array(z.record(z.string(), z.unknown())).max(200),
  /** optional context, e.g. interval */
  context: z.string().optional(),
});

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function tableToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const esc = (s: unknown) => {
    const v = s == null ? "" : String(s);
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h])).join(","));
  }
  return lines.join("\n");
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ summary: null, error: "Unauthorized" }, { status: 401 });
  }

  const apiKey =
    process.env.SimeraAPIKey ??
    process.env.SIMERA_API_KEY ??
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ summary: null, error: "no_api_key" });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ summary: null, error: "invalid_body" }, { status: 400 });
  }
  const { tableName, headers, rows, context } = parsed.data;

  if (!rows.length) {
    return NextResponse.json({ summary: null, error: "no_rows" });
  }

  const sample = rows.slice(0, 60);
  const csv = tableToCsv(headers, sample);

  const prompt = `You are a fleet-operations analyst for Simera Transport Ltd. Write a SHORT executive summary (4 to 6 sentences, plain prose, no markdown, no bullet lists) of the report below. Highlight totals, notable vehicles or drivers, time windows or trends, and any obvious anomalies (high values, drains, idling, violations). Keep numbers when relevant. Do not invent fields.

Report: ${tableName}
${context ? `Context: ${context}\n` : ""}
Sample rows (CSV, up to 60):
${csv}`;

  try {
    const r = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 350,
        },
      }),
    });

    if (r.status === 429) {
      return NextResponse.json({ summary: null, error: "quota" });
    }
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.error("gemini summary failed", r.status, text);
      return NextResponse.json({ summary: null, error: `http_${r.status}` });
    }

    const data = (await r.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join(" ")
      .trim();

    if (!text) {
      return NextResponse.json({ summary: null, error: "empty_response" });
    }

    return NextResponse.json({ summary: text });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ summary: null, error: "exception" });
  }
}
