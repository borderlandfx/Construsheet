import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(language: string, currency: string, unitSys: string): string {
  const metric = unitSys === "m";

  const unitExamples = metric
    ? "m³, m², ml, kg, ton, jor, hr"
    : "ft³, ft², lf, lb, ton, day, hr";

  const schema = `{
  "code": "string (e.g. 03.01)",
  "description": "string",
  "unit": "string (e.g. ${metric ? "m³" : "ft³"})",
  "overhead_pct": number,
  "profit_pct": number,
  "materials": [{ "name": "string", "unit": "string", "qty": number, "unit_price": number }],
  "labor":     [{ "name": "string", "unit": "string", "qty": number, "unit_price": number }],
  "equipment": [{ "name": "string", "unit": "string", "qty": number, "unit_price": number }],
  "direct_cost": number,
  "selling_price": number
}`;

  if (language === "es") {
    return `Eres un ingeniero civil experto en construcción latinoamericana (México y Colombia), \
especializado en Análisis de Precio Unitario (APU).

Dado un concepto de obra, genera un APU completo con precios reales de mercado.
Responde ÚNICAMENTE con un bloque JSON válido — sin texto adicional, sin markdown.

Esquema exacto:
${schema}

Reglas:
- Moneda: ${currency}. Usa precios actuales de mercado mexicano/colombiano.
- Sistema de unidades: ${metric ? "métrico" : "imperial"} (${unitExamples}).
- overhead_pct: entre 10 y 20 (típicamente 12). profit_pct: entre 5 y 15 (típicamente 5).
- qty es la cantidad del recurso POR UNIDAD del concepto.
- direct_cost = Σ(qty × unit_price) de materiales + mano de obra + equipo.
- selling_price = direct_cost × (1 + overhead_pct/100 + profit_pct/100).
- Incluye TODOS los insumos necesarios; arrays vacíos [] si no aplica la categoría.
- No incluyas ningún texto fuera del JSON.`;
  }

  return `You are an expert civil engineer specializing in Latin American construction \
(Mexico and Colombia), with deep expertise in Unit Price Analysis (APU/UPA).

Given a work activity, generate a complete, realistic unit price analysis with current market prices.
Respond ONLY with a valid JSON block — no extra text, no markdown fences.

Exact schema:
${schema}

Rules:
- Currency: ${currency}. Use real Mexican/Colombian construction market prices.
- Unit system: ${metric ? "metric" : "imperial"} (${unitExamples}).
- overhead_pct: 10–20 (typically 12). profit_pct: 5–15 (typically 5).
- qty is the quantity of the resource PER UNIT of the activity.
- direct_cost = Σ(qty × unit_price) across materials + labor + equipment.
- selling_price = direct_cost × (1 + overhead_pct/100 + profit_pct/100).
- Include ALL required resources; use empty arrays [] if a category does not apply.
- Do not include any text outside the JSON.`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, language = "es", currency = "USD", unitSys = "m" } = body as {
    prompt?: string;
    language?: string;
    currency?: string;
    unitSys?: string;
  };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  // Call Anthropic
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: buildSystemPrompt(language, currency, unitSys),
      messages: [{ role: "user", content: prompt.trim() }],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Strip markdown fences if the model wraps the JSON
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const src = fenceMatch ? fenceMatch[1] : raw;
    const objMatch = src.match(/\{[\s\S]*\}/);

    if (!objMatch) {
      return NextResponse.json(
        { error: "Model returned invalid JSON" },
        { status: 500 }
      );
    }

    const parsed: unknown = JSON.parse(objMatch[0]);
    return NextResponse.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Anthropic API error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
