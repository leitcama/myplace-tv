import { NextResponse } from "next/server";

// Simple in-memory telemetry store (resets on server restart)
const telemetryBuffer: Array<{
  ts: string;
  type: string;
  message?: string;
  meta?: Record<string, unknown>;
}> = [];

const MAX_ENTRIES = 5000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type"); // single or comma-separated
  const sinceParam = url.searchParams.get("since");
  const q = url.searchParams.get("q");
  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(Number(limitParam) || 100, 500));

  let events = telemetryBuffer;
  if (typeParam) {
    const types = new Set(typeParam.split(",").map(s=>s.trim()).filter(Boolean));
    events = events.filter(e => types.has(e.type));
  }
  if (sinceParam) {
    const t0 = Date.parse(sinceParam);
    if (!isNaN(t0)) events = events.filter(e => Date.parse(e.ts) >= t0);
  }
  if (q) {
    const needle = q.toLowerCase();
    events = events.filter(e => (e.type?.toLowerCase().includes(needle)) || (e.message||"").toLowerCase().includes(needle));
  }

  const sliced = events.slice(-limit);
  return NextResponse.json({ count: telemetryBuffer.length, returned: sliced.length, events: sliced });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const event = {
      ts: typeof body.ts === "string" ? body.ts : new Date().toISOString(),
      type: typeof body.type === "string" ? body.type : "unknown",
      message: typeof body.message === "string" ? body.message : undefined,
      meta: typeof body.meta === "object" && body.meta ? body.meta : undefined,
    } as const;
    telemetryBuffer.push(event as any);
    if (telemetryBuffer.length > MAX_ENTRIES) telemetryBuffer.splice(0, telemetryBuffer.length - MAX_ENTRIES);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "invalid_json" }, { status: 400 });
  }
}