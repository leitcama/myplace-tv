#!/usr/bin/env tsx
import ytpl from "ytpl";
import ytdl from "ytdl-core";
import fs from "node:fs/promises";
import path from "node:path";

type ChannelItem = { kind: "yt"; id: string; title: string; duration: number };

async function resolveUploadsPlaylistIdFromHandle(handle: string): Promise<string> {
  const resp = await fetch(`https://www.youtube.com/${handle}`);
  if (!resp.ok) throw new Error(`handle_fetch_${resp.status}`);
  const html = await resp.text();
  const m = html.match(/"channelId":"(UC[^"]+)"/);
  if (!m) throw new Error("channel_id_not_found");
  const channelId = m[1];
  return `UU${channelId.slice(2)}`;
}

async function listPlaylistItems(playlistIdOrUrl: string): Promise<Array<{ id: string; title: string }>> {
  const pl = await ytpl(playlistIdOrUrl, { pages: Infinity });
  return pl.items.map(i => ({ id: i.id!, title: i.title || "Untitled" }));
}

async function fetchDurations(ids: string[]): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  for (const id of ids) {
    try {
      const info = await ytdl.getInfo(id);
      map[id] = Number(info.videoDetails.lengthSeconds || 0) || 0;
    } catch {
      map[id] = 0;
    }
  }
  return map;
}

async function main(){
  const args = process.argv.slice(2);
  let handle = ""; let playlist = ""; let out = "public/myplace-channel.json";
  for (let i=0;i<args.length;i++){
    const a = args[i];
    if (a === "--handle") handle = args[++i] || "";
    else if (a === "--playlist") playlist = args[++i] || "";
    else if (a === "--out") out = args[++i] || out;
  }
  if (!handle && !playlist) throw new Error("Provide --handle @myplaceohio or --playlist <ID|URL>");

  const uploads = handle ? await resolveUploadsPlaylistIdFromHandle(handle) : playlist;
  console.log(`Building from uploads playlist: ${uploads}`);
  const itemsLite = await listPlaylistItems(uploads);
  const durations = await fetchDurations(itemsLite.map(i => i.id));
  const items: ChannelItem[] = itemsLite.map(i => ({ kind: "yt", id: i.id, title: i.title, duration: durations[i.id] || 0 }));
  const config = { channel: "My Place Ohio", epochStart: new Date().toISOString(), items, bumpers: {}, rules: {} };
  const outPath = path.isAbsolute(out) ? out : path.join(process.cwd(), out);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(config, null, 2));
  console.log(JSON.stringify({ ok: true, count: items.length, out: outPath }));
}

main().catch(err => { console.error(JSON.stringify({ ok:false, error: String(err?.message||err) })); process.exit(1); });