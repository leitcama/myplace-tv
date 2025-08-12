import { NextResponse } from "next/server";
import cfg from "@/public/channel.json";
import { positionAt, resolveVideoId } from "@/lib/schedule/now";
import type { ChannelConfig } from "@/lib/schedule/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = cfg as unknown as ChannelConfig;
  const serverTime = new Date().toISOString();
  const pos = positionAt(new Date(serverTime), config.epochStart, config.items);
  const item = config.items[pos.index];
  return NextResponse.json({
    videoId: resolveVideoId(config, item),
    title: item.title,
    index: pos.index,
    offset: pos.offset,
    serverTime
  }, {
    headers: {
      "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate"
    }
  });
}
