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

async function checkUrlReachable(url: string){
  // Try HEAD, then tiny Range GET
  try {
    const h = await fetch(url, { method: "HEAD" });
    if (h.ok) return true;
  } catch {}
  try {
    const g = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1" } });
    if (g.ok) return true;
  } catch {}
  return false;
}

async function resolveStream(videoId: string){
  return fetchJson<{ url: string; itag: number; qualityLabel?: string }>(`${BASE_URL}/api/stream/${encodeURIComponent(videoId)}`);
}

async function validateStream(videoId: string, maxAttempts = 3){
  let lastError: any;
  for (let attempt=1; attempt<=maxAttempts; attempt++){
    try{
      const res = await resolveStream(videoId);
      const reachable = await checkUrlReachable(res.url);
      if (reachable){
        await postTelemetry({ type: "stream_ok", message: videoId, meta: { attempt, itag: res.itag, q: res.qualityLabel } });
        return true;
      } else {
        lastError = new Error("unreachable");
      }
    } catch (e:any){ lastError = e; }
    const backoff = Math.min(15000, 1000 * 2 ** (attempt-1)) + Math.floor(Math.random()*500);
    await sleep(backoff);
  }
  await postTelemetry({ type: "stream_fail", message: videoId, meta: { error: String(lastError?.message||lastError), attempts: maxAttempts } });
  return false;
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