import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { positionAt, resolveVideoId } from "@/lib/schedule/now";
import type { ChannelConfig } from "@/lib/schedule/types";

async function readConfig(): Promise<ChannelConfig> {
  const pub = path.join(process.cwd(), "public");
  const primary = path.join(pub, "myplace-channel.json");
  const fallback = path.join(pub, "channel.json");
  let raw = "";
  try { raw = await fs.readFile(primary, "utf8"); }
  catch {
    raw = await fs.readFile(fallback, "utf8");
  }
  return JSON.parse(raw) as ChannelConfig;
}

export async function GET() {
  const config = await readConfig();
  const serverTime = new Date().toISOString();
  const pos = positionAt(new Date(serverTime), config.epochStart, config.items);
  const item = config.items[pos.index];
  return NextResponse.json({
    videoId: resolveVideoId(config, item),
    title: item.title,
    index: pos.index,
    offset: pos.offset,
    serverTime
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
