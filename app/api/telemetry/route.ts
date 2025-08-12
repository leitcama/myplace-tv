import { NextResponse } from "next/server";

// Simple in-memory telemetry store (resets on server restart)
const telemetryBuffer: Array<{
  ts: string;
  type: string;
  message?: string;
  meta?: Record<string, unknown>;
}> = [];

const MAX_ENTRIES = 500;

export async function GET() {
  return NextResponse.json({ count: telemetryBuffer.length, events: telemetryBuffer.slice(-100) });
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