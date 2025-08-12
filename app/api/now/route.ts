import { NextResponse } from "next/server";
import cfg from "@/public/channel.json";
import { positionAt, resolveVideoId } from "@/lib/schedule/now";
import type { ChannelConfig } from "@/lib/schedule/types";

export async function GET() {
  const config = cfg as unknown as ChannelConfig;
  const now = new Date();
  const serverTime = now.toISOString();
  const pos = positionAt(now, config.epochStart, config.items);
  const item = config.items[pos.index];
  const res = NextResponse.json({
    videoId: resolveVideoId(config, item),
    title: item.title,
    index: pos.index,
    offset: pos.offset,
    serverTime,
    serverEpochMs: now.getTime(),
  });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}
