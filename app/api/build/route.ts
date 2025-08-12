import { NextResponse } from "next/server";
import ytpl from "ytpl";
import ytdl from "ytdl-core";
import fs from "node:fs/promises";
import path from "node:path";
import type { ChannelConfig, ChannelItem } from "@/lib/schedule/types";

async function resolveUploadsPlaylistIdFromHandle(handle: string): Promise<string> {
  const base = handle.startsWith("@") ? `https://www.youtube.com/${handle}` : handle;
  const candidates = [base, `${base}/about`, `${base}/videos`, `${base}/streams`];
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  } as Record<string, string>;
  const patterns = [
    /"channelId":"(UC[\w-]{22})"/,
    /"externalId":"(UC[\w-]{22})"/,
    /data-channel-external-id=\"(UC[^"]+)\"/,
    /https:\/\/www\.youtube\.com\/channel\/(UC[\w-]+)/
  ];
  for (const url of candidates) {
    try {
      const resp = await fetch(url, { headers });
      if (!resp.ok) continue;
      const html = await resp.text();
      for (const re of patterns) {
        const m = html.match(re);
        if (m) {
          const channelId = m[1];
          return `UU${channelId.slice(2)}`;
        }
      }
    } catch {}
  }
  throw new Error("channel_id_not_found");
}

async function listPlaylistItems(playlistIdOrUrl: string): Promise<Array<{ id: string; title: string }>> {
  const pl = await ytpl(playlistIdOrUrl, { pages: Infinity });
  return pl.items.map(i => ({ id: i.id!, title: i.title || "Untitled" }));
}

async function fetchDurations(ids: string[]): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  const limit = 6; let i = 0;
  async function worker(){
    while (i < ids.length){
      const id = ids[i++];
      try { const info = await ytdl.getInfo(id); map[id] = Number(info.videoDetails.lengthSeconds || 0) || 0; }
      catch { map[id] = 0; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, ids.length) }, () => worker()));
  return map;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get("handle");
  const playlist = searchParams.get("playlist");
  if (!handle && !playlist) return NextResponse.json({ error: "missing_handle_or_playlist" }, { status: 400 });

  try {
    const uploads = handle ? await resolveUploadsPlaylistIdFromHandle(handle) : playlist!;
    const itemsLite = await listPlaylistItems(uploads);
    const durations = await fetchDurations(itemsLite.map(i => i.id));

    const items: ChannelItem[] = itemsLite.map(i => ({ kind: "yt", id: i.id, title: i.title, duration: durations[i.id] || 0 }));
    const config: ChannelConfig = {
      channel: "My Place Ohio",
      epochStart: new Date().toISOString(),
      items,
      bumpers: {},
      rules: {}
    };

    const outPath = path.join(process.cwd(), "public", "myplace-channel.json");
    await fs.writeFile(outPath, JSON.stringify(config, null, 2));

    return NextResponse.json({ ok: true, count: items.length, playlist: uploads, out: "/myplace-channel.json" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message||e) }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";