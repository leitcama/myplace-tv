import { NextResponse } from "next/server";
import ytdl from "ytdl-core";
import { execFile as _execFile } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

export const dynamic = "force-dynamic";

// Simple in-memory cache and rate limiting (per-process)
const cache = new Map<string, { data: { url: string; itag: number; qualityLabel?: string } | { variants: Array<{ url: string; itag: number; qualityLabel?: string; bitrate?: number }> }; expires: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const COOLDOWN_MS = 5 * 1000; // avoid thrashing per id
const lastFetchAt = new Map<string, number>();

// Token bucket for global ytdl calls
let tokens = 10; // capacity
let lastRefill = Date.now();
const REFILL_RATE_PER_SEC = 0.5; // 0.5 tokens/sec => 30 per minute
const CAPACITY = 15;

function takeToken(): boolean {
  const now = Date.now();
  const elapsedSec = (now - lastRefill) / 1000;
  tokens = Math.min(CAPACITY, tokens + elapsedSec * REFILL_RATE_PER_SEC);
  lastRefill = now;
  if (tokens >= 1) { tokens -= 1; return true; }
  return false;
}

async function postTelemetry(req: Request, ev: { type: string; message: string; meta?: Record<string, unknown> }){
  try{
    const origin = new URL(req.url).origin;
    await fetch(`${origin}/api/telemetry`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ts:new Date().toISOString(), ...ev }) });
  } catch {}
}

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const ACCEPT_LANG = process.env.YOUTUBE_ACCEPT_LANGUAGE || "en-US,en;q=0.9";
const COOKIE = process.env.YOUTUBE_COOKIE || "";
const COOKIES_FILE = process.env.YOUTUBE_COOKIES_FILE || "";

async function extractWithYtdlCore(id: string){
  const requestOptions = { headers: { "user-agent": UA, "accept-language": ACCEPT_LANG, ...(COOKIE ? { cookie: COOKIE } : {}) } } as any;
  const info = await ytdl.getInfo(id, { requestOptions });
  const formats = info.formats || [];
  const progressive = formats
    .filter(f => !!f.url && (f.container === "mp4" || (f.mimeType||"").includes("mp4")) && f.hasAudio && f.hasVideo)
    .map(f => ({ url: f.url, itag: f.itag, qualityLabel: f.qualityLabel, bitrate: (f.bitrate as number) || (f.averageBitrate as number) || 0 }))
    .sort((a,b)=> (b.bitrate||0) - (a.bitrate||0));
  const fallback = formats
    .filter(f => !!f.url)
    .map(f => ({ url: f.url, itag: f.itag, qualityLabel: f.qualityLabel, bitrate: (f.bitrate as number) || (f.averageBitrate as number) || 0 }));
  return { progressive, fallback };
}

const DEFAULT_PIPED_INSTANCES = [
  "https://piped.video",
  "https://piped.projectsegfau.lt",
  "https://piped.yt",
  "https://piped.lunar.icu",
  "https://piped.syncpundit.com"
];

const DEFAULT_INVIDIOUS_INSTANCES = [
  "https://yewtu.be",
  "https://inv.nadeko.net",
  "https://vid.puffyan.us",
  "https://invidious.nerdvpn.de",
  "https://invidious.flokinet.to",
  "https://inv.tux.pizza"
];

async function fetchTextWithTimeout(url: string, opts: RequestInit & { timeoutMs?: number } = {}){
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), opts.timeoutMs ?? 6000);
  try{
    const r = await fetch(url, { headers: { "user-agent": UA, ...(opts.headers||{}) }, ...opts, signal: controller.signal });
    const text = await r.text();
    return { res: r, text };
  } finally { clearTimeout(to); }
}
async function fetchJsonWithTimeout(url: string, opts: RequestInit & { timeoutMs?: number } = {}){
  const { res, text } = await fetchTextWithTimeout(url, opts);
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) throw new Error(`http_${res.status}`);
  if (!ct.toLowerCase().includes("application/json")) throw new Error("not_json");
  return JSON.parse(text);
}

async function extractWithPiped(id: string, instanceOverride?: string){
  const bases = instanceOverride ? [instanceOverride] : DEFAULT_PIPED_INSTANCES;
  const errs: Array<{ base:string; err:string }> = [];
  for (const base of bases){
    try{
      const j: any = await fetchJsonWithTimeout(`${base}/api/v1/streams/${encodeURIComponent(id)}`, { headers: { accept: "application/json" } });
      const muxed: any[] = Array.isArray(j?.muxedStreams) ? j.muxedStreams : [];
      const progressive = muxed
        .filter(s => s?.url && (s?.container?.includes("mp4") || (s?.mimeType||"").includes("mp4")))
        .map(s => ({ url: s.url, itag: Number(s.itag)||0, qualityLabel: s.quality || s.qualityLabel, bitrate: Number(s.bitrate)||0 }))
        .sort((a,b)=> (b.bitrate||0) - (a.bitrate||0));
      const fallback = progressive.slice();
      if (progressive.length || fallback.length) return { progressive, fallback, base } as const;
      errs.push({ base, err: "empty" });
    } catch (e:any){ errs.push({ base, err: String(e?.message||e) }); }
  }
  throw new Error(`piped_all_failed:${errs.map(e=>`${e.base}:${e.err}`).join(",")}`);
}

async function extractWithInvidious(id: string, instanceOverride?: string){
  const bases = instanceOverride ? [instanceOverride] : DEFAULT_INVIDIOUS_INSTANCES;
  const errs: Array<{ base:string; err:string }> = [];
  for (const base of bases){
    try{
      const j: any = await fetchJsonWithTimeout(`${base}/api/v1/videos/${encodeURIComponent(id)}`, { headers: { accept: "application/json" } });
      const streams: any[] = Array.isArray(j?.formatStreams) ? j.formatStreams : [];
      const progressive = streams
        .filter(s => s?.url && ((s?.type||"").includes("video/mp4")==true))
        .map(s => ({ url: s.url, itag: 0, qualityLabel: s.qualityLabel || s.quality, bitrate: Number(s.bitrate)||0 }))
        .sort((a,b)=> (b.bitrate||0) - (a.bitrate||0));
      const fallback = progressive.slice();
      if (progressive.length || fallback.length) return { progressive, fallback, base } as const;
      errs.push({ base, err: "empty" });
    } catch (e:any){ errs.push({ base, err: String(e?.message||e) }); }
  }
  throw new Error(`invidious_all_failed:${errs.map(e=>`${e.base}:${e.err}`).join(",")}`);
}

function resolveYtDlpBinary(): string {
  const candidates = [
    process.env.YTDLP_PATH,
    resolvePath(process.cwd(), "scripts/yt-dlp"),
    "yt-dlp"
  ].filter(Boolean) as string[];
  for (const p of candidates){ try { if (p && (p === "yt-dlp" || existsSync(p))) return p; } catch {} }
  throw new Error("yt-dlp_not_found");
}

function execFile(cmd: string, args: string[], timeoutMs = 8000): Promise<{ stdout:string; stderr:string }>{
  return new Promise((resolve, reject) => {
    const cp = _execFile(cmd, args, { env: process.env, maxBuffer: 10*1024*1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve({ stdout:String(stdout||""), stderr:String(stderr||"") });
    });
    const to = setTimeout(() => { try { cp.kill(); } catch {} reject(new Error("exec_timeout")); }, timeoutMs);
    cp.on("exit", () => clearTimeout(to));
  });
}

async function extractWithYtDlpCmd(id: string){
  const bin = resolveYtDlpBinary();
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  const args = ["-J", "--no-warnings", "--no-check-certificates", "--skip-download", "--add-header", `User-Agent: ${UA}`, "--add-header", `Accept-Language: ${ACCEPT_LANG}`];
  if (COOKIE) { args.push("--add-header", `Cookie: ${COOKIE}`); }
  if (COOKIES_FILE && existsSync(COOKIES_FILE)) { args.push("--cookies", COOKIES_FILE); }
  args.push(url);
  const { stdout } = await execFile(bin, args, 15000);
  const json: any = JSON.parse(stdout);
  const formats: any[] = Array.isArray(json?.formats) ? json.formats : [];
  const progressive = formats
    .filter((f:any) => f?.url && ((f.ext === "mp4") || ((f.mime_type||f.mimeType||"").includes("mp4"))) && f.acodec !== "none" && f.vcodec !== "none")
    .map((f:any) => ({ url: f.url, itag: Number(f.itag)||0, qualityLabel: f.format_note || f.format || f.resolution, bitrate: Number(f.tbr)||Number(f.bitrate)||0 }))
    .sort((a,b)=> (b.bitrate||0) - (a.bitrate||0));
  const fallback = formats.filter((f:any)=>f?.url).map((f:any)=>({ url: f.url, itag: Number(f.itag)||0, qualityLabel: f.format_note || f.format || f.resolution, bitrate: Number(f.tbr)||Number(f.bitrate)||0 }));
  return { progressive, fallback };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const trace = Math.random().toString(36).slice(2);
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: "missing_id", trace }, { status: 400 });

    const urlObj = new URL(req.url);
    const wantProgressiveList = urlObj.searchParams.get("progressive") === "1" || urlObj.searchParams.get("all") === "1";
    const forceSource = urlObj.searchParams.get("source"); // "piped" | "invidious" | "ytdlp" to force
    const instanceOverride = urlObj.searchParams.get("instance") || process.env.PIPED_INSTANCE || undefined;
    const verbose = urlObj.searchParams.get("verbose") === "1";

    const cacheKey = `${id}:${wantProgressiveList?"list":"top"}`;
    const cached = cache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expires > now) {
      const body = cached.data as any;
      const meta = { cache: "hit", trace } as const;
      if (!wantProgressiveList && "variants" in body) {
        const top = body.variants[0];
        return NextResponse.json(verbose ? { ...meta, ...top } : { url: top.url, itag: top.itag, qualityLabel: top.qualityLabel, trace }, { headers: { "x-cache": "hit" } });
      }
      return NextResponse.json(verbose ? { ...meta, ...body } : body, { headers: { "x-cache": "hit" } });
    }

    const last = lastFetchAt.get(cacheKey) || 0;
    if (now - last < COOLDOWN_MS && cached) {
      const body = cached.data as any;
      const meta = { cache: "cooldown", trace } as const;
      if (!wantProgressiveList && "variants" in body) {
        const top = body.variants[0];
        return NextResponse.json(verbose ? { ...meta, ...top } : { url: top.url, itag: top.itag, qualityLabel: top.qualityLabel, trace }, { headers: { "x-cache": "cooldown" } });
      }
      return NextResponse.json(verbose ? { ...meta, ...body } : body, { headers: { "x-cache": "cooldown" } });
    }

    if (!takeToken()) {
      const retryAfter = 3;
      return NextResponse.json({ error: "rate_limited", retryAfter, trace }, { status: 429, headers: { "retry-after": String(retryAfter) } });
    }

    lastFetchAt.set(cacheKey, now);

    let progressive: Array<{ url:string; itag:number; qualityLabel?:string; bitrate?:number }> = [];
    let fallback: Array<{ url:string; itag:number; qualityLabel?:string; bitrate?:number }> = [];

    const tryCore = async () => { const r = await extractWithYtdlCore(id); progressive = r.progressive; fallback = r.fallback; };
    const tryYtDlp = async () => { const r = await extractWithYtDlpCmd(id); progressive = r.progressive; fallback = r.fallback; };
    const tryPiped = async () => { const r = await extractWithPiped(id, instanceOverride); progressive = r.progressive; fallback = r.fallback; };
    const tryInv = async () => { const r = await extractWithInvidious(id); progressive = r.progressive; fallback = r.fallback; };

    let source: "core"|"ytdlp"|"piped"|"invidious" = "core";
    const errors: string[] = [];

    try {
      if (forceSource === "piped") { await tryPiped(); source = "piped"; }
      else if (forceSource === "invidious") { await tryInv(); source = "invidious"; }
      else if (forceSource === "ytdlp") { await tryYtDlp(); source = "ytdlp"; }
      else { await tryCore(); source = "core"; }
      if (!progressive.length && !fallback.length) throw new Error("empty_formats");
    } catch (e:any) {
      errors.push(String(e?.message||e));
      try { await tryYtDlp(); source = "ytdlp"; }
      catch (e1:any) { errors.push(String(e1?.message||e1)); try { await tryPiped(); source = "piped"; } catch (e2:any){ errors.push(String(e2?.message||e2)); try { await tryInv(); source = "invidious"; } catch (e3:any){ errors.push(String(e3?.message||e3)); } } }
      if (!progressive.length && !fallback.length){
        const detail = errors.join(" | ");
        await postTelemetry(req, { type:"stream_error", message:"extract_fail", meta:{ id, trace, detail } });
        return NextResponse.json({ error: "extract_fail", detail, trace }, { status: 502 });
      }
    }

    if (wantProgressiveList && progressive.length > 0) {
      const data = { variants: progressive } as const;
      cache.set(cacheKey, { data: data as any, expires: now + CACHE_TTL_MS });
      const resp = verbose ? { source, trace, count: progressive.length, variants: progressive } : data;
      return NextResponse.json(resp, { headers: { "x-cache": "miss", "x-source": source } });
    }

    const chosen = progressive[0] || fallback[0];
    if (!chosen?.url) return NextResponse.json({ error: "no_url", trace }, { status: 404 });

    const data = { url: chosen.url, itag: chosen.itag, qualityLabel: chosen.qualityLabel };
    cache.set(cacheKey, { data, expires: now + CACHE_TTL_MS });

    const resp = verbose ? { source, trace, chosen } : data;
    return NextResponse.json(resp, { headers: { "x-cache": "miss", "x-source": source } });
  } catch (err: any) {
    try{ await postTelemetry(req, { type:"stream_error", message:"unhandled", meta:{ trace, err: err?.message } }); } catch {}
    return NextResponse.json({ error: "resolve_failed", detail: err?.message, trace }, { status: 500 });
  }
}