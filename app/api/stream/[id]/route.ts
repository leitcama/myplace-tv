import { NextResponse } from "next/server";
import ytdl from "ytdl-core";

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

async function extractWithYtdlCore(id: string){
  const info = await ytdl.getInfo(id);
  const progressive = ytdl.filterFormats(info.formats, "audioandvideo")
    .filter(f => f.container === "mp4" && !!f.url)
    .map(f => ({ url: f.url, itag: f.itag, qualityLabel: f.qualityLabel, bitrate: f.bitrate || f.averageBitrate }))
    .sort((a,b)=> (b.bitrate||0) - (a.bitrate||0));
  const fallback = info.formats.filter(f => !!f.url)
    .map(f => ({ url: f.url, itag: f.itag, qualityLabel: f.qualityLabel, bitrate: f.bitrate || f.averageBitrate }));
  return { progressive, fallback };
}

const DEFAULT_PIPED_INSTANCES = [
  "https://piped.video",
  "https://piped.projectsegfau.lt",
  "https://piped.yt",
  "https://piped.lunar.icu"
];

async function fetchJsonWithTimeout(url: string, opts: RequestInit & { timeoutMs?: number } = {}){
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try{
    const r = await fetch(url, { ...opts, signal: controller.signal });
    const ct = r.headers.get("content-type") || "";
    const text = await r.text();
    if (!r.ok) throw new Error(`http_${r.status}`);
    if (!ct.toLowerCase().includes("application/json")) throw new Error("not_json");
    return JSON.parse(text);
  } finally { clearTimeout(to); }
}

async function extractWithPiped(id: string, instanceOverride?: string){
  const bases = instanceOverride ? [instanceOverride] : DEFAULT_PIPED_INSTANCES;
  const errs: Array<{ base:string; err:string }> = [];
  for (const base of bases){
    try{
      const j: any = await fetchJsonWithTimeout(`${base}/api/v1/streams/${encodeURIComponent(id)}`, { headers: { accept: "application/json" }, timeoutMs: 6000 });
      const muxed: any[] = Array.isArray(j?.muxedStreams) ? j.muxedStreams : [];
      const progressive = muxed
        .filter(s => s?.url && (s?.container?.includes("mp4") || (s?.mimeType||"").includes("mp4")))
        .map(s => ({ url: s.url, itag: Number(s.itag)||0, qualityLabel: s.quality || s.qualityLabel, bitrate: Number(s.bitrate)||Number(s.tbr)||0 }))
        .sort((a,b)=> (b.bitrate||0) - (a.bitrate||0));
      const fallback = progressive.slice();
      if (progressive.length || fallback.length) return { progressive, fallback, base } as const;
      errs.push({ base, err: "empty" });
    } catch (e:any){ errs.push({ base, err: String(e?.message||e) }); }
  }
  throw new Error(`piped_all_failed:${errs.map(e=>`${e.base}:${e.err}`).join(",")}`);
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const trace = Math.random().toString(36).slice(2);
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: "missing_id", trace }, { status: 400 });

    const urlObj = new URL(req.url);
    const wantProgressiveList = urlObj.searchParams.get("progressive") === "1" || urlObj.searchParams.get("all") === "1";
    const forceSource = urlObj.searchParams.get("source"); // "piped" to force
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
    const tryPiped = async () => { const r = await extractWithPiped(id, instanceOverride); progressive = r.progressive; fallback = r.fallback; };

    let source: "core"|"piped" = "core";
    try {
      if (forceSource === "piped") { await tryPiped(); source = "piped"; }
      else { await tryCore(); source = "core"; }
      if (!progressive.length && !fallback.length) throw new Error("empty_formats");
    } catch (e:any) {
      try { await tryPiped(); source = "piped"; }
      catch (ee:any) {
        await postTelemetry(req, { type:"stream_error", message:"extract_fail", meta:{ id, trace, err: ee?.message || e?.message } });
        return NextResponse.json({ error: "extract_fail", detail: ee?.message || e?.message, trace }, { status: 502 });
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