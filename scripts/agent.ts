#!/usr/bin/env tsx

import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import type { ChannelConfig } from "../lib/schedule/types";
import { resolveVideoId } from "../lib/schedule/now";

const BASE_URL = process.env.AGENT_BASE_URL || "http://localhost:3000";

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

async function postTelemetry(ev: { type: string; message?: string; meta?: Record<string, unknown> }){
  try {
    await fetch(`${BASE_URL}/api/telemetry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ts: new Date().toISOString(), ...ev })
    });
  } catch {}
}

async function getNowPlaying(): Promise<{ videoId: string; offset: number; title: string; index: number; serverTime: string }>{
  return fetchJson(`${BASE_URL}/api/now`);
}

async function validateStream(videoId: string){
  try{
    const res = await fetchJson<{ url: string; itag: number; qualityLabel?: string }>(`${BASE_URL}/api/stream/${encodeURIComponent(videoId)}`);
    // Try HEAD; if it fails, try a tiny ranged GET
    let ok = false;
    try {
      const head = await fetch(res.url, { method: "HEAD" });
      ok = head.ok;
    } catch {}
    if (!ok) {
      const tiny = await fetch(res.url, { method: "GET", headers: { Range: "bytes=0-1" } });
      ok = tiny.ok;
    }
    if (!ok) throw new Error(`unreachable`);

    await postTelemetry({ type: "stream_ok", message: videoId, meta: { itag: res.itag, q: res.qualityLabel } });
    return true;
  } catch (e:any){
    await postTelemetry({ type: "stream_fail", message: videoId, meta: { error: e?.message } });
    return false;
  }
}

function loadConfig(): ChannelConfig {
  const p = resolvePath(__dirname, "../public/channel.json");
  const raw = readFileSync(p, "utf8");
  return JSON.parse(raw) as ChannelConfig;
}

async function main(){
  const config = loadConfig();
  console.log(`[agent] starting with base ${BASE_URL}`);
  await postTelemetry({ type: "agent_start", message: "ok" });
  while(true){
    try{
      const now = await getNowPlaying();
      const ok = await validateStream(now.videoId);
      if (!ok){
        const nextIndex = (now.index + 1) % config.items.length;
        const nextId = resolveVideoId(config, config.items[nextIndex]);
        if (nextId) await validateStream(nextId);
      }
    } catch (e:any){
      await postTelemetry({ type: "agent_error", message: e?.message });
    }
    const jitter = 5000 + Math.floor(Math.random()*5000); // 5-10s
    await sleep(jitter);
  }
}

main().catch(err=>{ console.error(err); process.exitCode = 1; });