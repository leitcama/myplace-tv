#!/usr/bin/env tsx

import { writeFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

type Json = Record<string, unknown>;

const BASE_URL = process.env.BASE_URL || process.env.AGENT_BASE_URL || "http://localhost:3000";
const ARGS = process.argv.slice(2);
function getArg(name: string, def = ""): string {
  const idx = ARGS.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (idx === -1) return def;
  const v = ARGS[idx].split("=")[1];
  return v ?? ARGS[idx+1] ?? def;
}

const videoIdArg = getArg("id");
const instanceArg = getArg("instance");
const outFile = getArg("out", `diag-${Date.now()}.jsonl`);

function stamp(){ return new Date().toISOString(); }
function jline(obj: Json){ const s = JSON.stringify(obj); console.log(s); lines.push(s); }
const lines: string[] = [];

function envStatus(){
  const cookieEnv = process.env.YOUTUBE_COOKIE ? true : false;
  const cookieLen = process.env.YOUTUBE_COOKIE?.length || 0;
  const file = process.env.YOUTUBE_COOKIES_FILE || "";
  return { cookieEnv, cookieLen, fileSet: !!file };
}

async function fetchText(url: string, init?: RequestInit){
  const t0 = Date.now();
  try{
    const res = await fetch(url, { cache: "no-store", ...init });
    const text = await res.text();
    return { ok: res.ok, status: res.status, headers: Object.fromEntries(res.headers.entries()), ms: Date.now()-t0, text };
  } catch (e:any){
    return { ok:false, status: 0, headers: {}, ms: Date.now()-t0, text: String(e?.message||e) };
  }
}
async function fetchJson(url: string, init?: RequestInit){
  const r = await fetchText(url, init);
  try{ return { ...r, json: JSON.parse(r.text) }; }
  catch{ return { ...r, json: null }; }
}

async function testHealth(){
  const u = `${BASE_URL}/api/health`;
  const r = await fetchJson(u);
  jline({ ts: stamp(), kind: "health", url: u, ok: r.ok, status: r.status, ms: r.ms, json: r.json });
  return r.ok;
}
async function getNow(){
  const u = `${BASE_URL}/api/now`;
  const r = await fetchJson(u);
  jline({ ts: stamp(), kind: "now", url: u, ok: r.ok, status: r.status, ms: r.ms, json: r.json });
  return r.json as any;
}

async function testMeta(id: string, source: "core"|"piped", instance?: string){
  const qs = new URLSearchParams({ progressive: "1", verbose: "1" });
  if (source === "piped") qs.set("source","piped");
  if (instance) qs.set("instance", instance);
  const u = `${BASE_URL}/api/stream/${encodeURIComponent(id)}?${qs.toString()}`;
  const r = await fetchJson(u);
  jline({ ts: stamp(), kind: "meta", source, instance: instance||null, url: u, ok: r.ok, status: r.status, ms: r.ms, json: r.json });
  return r;
}

async function testProxy(urlGoogle: string){
  const u = `${BASE_URL}/api/stream/proxy?verbose=1&u=${encodeURIComponent(urlGoogle)}`;
  // try tiny range GET
  const r = await fetchText(u, { method: "GET", headers: { Range: "bytes=0-1" } });
  jline({ ts: stamp(), kind: "proxy", url: u, ok: r.ok, status: r.status, ms: r.ms, headers: r.headers });
  return r;
}

async function main(){
  jline({ ts: stamp(), kind: "start", base: BASE_URL, id: videoIdArg||null, instance: instanceArg||null, env: envStatus() });
  const healthy = await testHealth();
  const now = await getNow();
  const id = videoIdArg || now?.videoId || "";
  if (!id){ jline({ ts: stamp(), kind: "fatal", reason: "no_video_id" }); finish(); return; }

  // Try core and piped (with instance override if provided)
  const sources: Array<{ s:"core"|"piped"; instance?:string|null }> = [{ s:"core" }, { s:"piped", instance: instanceArg||null }];
  const pipedInstances = [undefined, "https://piped.projectsegfau.lt", "https://piped.video", "https://piped.yt", "https://piped.lunar.icu"];

  for (const entry of sources){
    if (entry.s === "core"){
      const m = await testMeta(id, "core");
      if (m.ok && m.json?.variants?.length){
        const top = m.json.variants[0];
        await testProxy(top.url);
      }
    } else {
      // try override first (if any), then a few known instances
      const list = instanceArg ? [instanceArg] : pipedInstances;
      for (const inst of list){
        const m = await testMeta(id, "piped", inst as any);
        if (m.ok && m.json?.variants?.length){
          const top = m.json.variants[0];
          await testProxy(top.url);
          break;
        }
      }
    }
  }

  // Also test the test page HTML load
  const pageUrl = `${BASE_URL}/test/${encodeURIComponent(id)}?verbose=1&source=piped`;
  const page = await fetchText(pageUrl);
  jline({ ts: stamp(), kind: "page", url: pageUrl, ok: page.ok, status: page.status, ms: page.ms, ct: page.headers["content-type"] });

  // Summary
  jline({ ts: stamp(), kind: "done" });
  finish();
}

function finish(){
  try{ writeFileSync(resolvePath(process.cwd(), outFile), lines.join("\n")+"\n", "utf8"); } catch {}
}

main().catch(e=>{ jline({ ts: stamp(), kind: "fatal", error: String(e?.message||e) }); finish(); process.exitCode = 1; });