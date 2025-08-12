import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("telemetry:", JSON.stringify(body));
  } catch (e) {
    console.warn("telemetry parse error", e);
  }
  return new NextResponse(null, { status: 204 });
}