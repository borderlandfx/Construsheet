import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { BudgetDocument } from "@/lib/pdf/BudgetDocument";
import { GanttDocument } from "@/lib/pdf/GanttDocument";

// Force Node.js runtime — @react-pdf/renderer is not Edge-compatible
export const runtime = "nodejs";

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Auth check
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    type,
    projectId,
    language = "es",
    currency = "USD",
  } = body as {
    type?: string;
    projectId?: string;
    language?: "es" | "en";
    currency?: string;
  };

  if (!type || (type !== "budget" && type !== "gantt")) {
    return NextResponse.json(
      { error: "type must be 'budget' or 'gantt'" },
      { status: 400 }
    );
  }

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  // 3. Fetch data with service role (bypasses RLS — auth already validated above)
  const db = createServiceClient();

  const { data: project, error: projectErr } = await db
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (projectErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // 4. Render PDF
  try {
    let buffer: Buffer;
    const lang = language as "es" | "en";

    if (type === "budget") {
      const { data: rows, error: rowsErr } = await db
        .from("budget_rows")
        .select("*")
        .eq("project_id", projectId)
        .order("section")
        .order("sort_order");

      if (rowsErr) throw new Error(rowsErr.message);

      const element = React.createElement(BudgetDocument, {
        project,
        rows: rows ?? [],
        language: lang,
        currency,
      });

      buffer = await renderToBuffer(element);
    } else {
      // gantt
      const { data: tasks, error: tasksErr } = await db
        .from("gantt_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order");

      if (tasksErr) throw new Error(tasksErr.message);

      const element = React.createElement(GanttDocument, {
        project,
        tasks: tasks ?? [],
        language: lang,
      });

      buffer = await renderToBuffer(element);
    }

    // 5. Build filename and return binary response
    const dateTag = new Date().toISOString().slice(0, 10);
    const filename = `ConstruSheet_${type}_${dateTag}.pdf`;

    // Convert Buffer to Uint8Array — required by the Web Response API
    const uint8 = new Uint8Array(buffer);

    return new Response(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": uint8.byteLength.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
