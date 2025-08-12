import { NextResponse } from "next/server";
import { telemetry, TelemetryEvent } from "@/lib/server/telemetry";

export async function GET() {
  const data = { summary: telemetry.getSummary(), recent: telemetry.getEvents() };
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ev: TelemetryEvent = {
      ts: new Date().toISOString(),
      type: body?.type ?? "unknown",
      data: body?.data ?? {}
    };
    telemetry.add(ev);
  } catch (e) {
    console.warn("telemetry parse error", e);
  }
  return new NextResponse(null, { status: 204 });
}