import { NextResponse } from "next/server";
import ytdl from "ytdl-core";

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

async function extractWithPiped(id: string){
  const r = await fetch(`https://piped.video/api/v1/streams/${encodeURIComponent(id)}`, { headers: { "accept": "application/json" } });
  if (!r.ok) throw new Error(`piped_${r.status}`);
  const j: any = await r.json();
  const muxed: any[] = Array.isArray(j?.muxedStreams) ? j.muxedStreams : [];
  const progressive = muxed
    .filter(s => s?.url && (s?.container?.includes("mp4") || (s?.mimeType||"").includes("mp4")))
    .map(s => ({ url: s.url, itag: Number(s.itag)||0, qualityLabel: s.quality || s.qualityLabel, bitrate: Number(s.bitrate)||Number(s.tbr)||0 }))
    .sort((a,b)=> (b.bitrate||0) - (a.bitrate||0));
  const fallback = progressive.slice();
  return { progressive, fallback };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

    const urlObj = new URL(req.url);
    const wantProgressiveList = urlObj.searchParams.get("progressive") === "1" || urlObj.searchParams.get("all") === "1";
    const forceSource = urlObj.searchParams.get("source"); // "piped" to force

    const cacheKey = `${id}:${wantProgressiveList?"list":"top"}`;
    const cached = cache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expires > now) {
      const body = cached.data as any;
      if (!wantProgressiveList && "variants" in body) {
        const top = body.variants[0];
        return NextResponse.json({ url: top.url, itag: top.itag, qualityLabel: top.qualityLabel }, { headers: { "x-cache": "hit" } });
      }
      return NextResponse.json(body, { headers: { "x-cache": "hit" } });
    }

    const last = lastFetchAt.get(cacheKey) || 0;
    if (now - last < COOLDOWN_MS && cached) {
      const body = cached.data as any;
      if (!wantProgressiveList && "variants" in body) {
        const top = body.variants[0];
        return NextResponse.json({ url: top.url, itag: top.itag, qualityLabel: top.qualityLabel }, { headers: { "x-cache": "cooldown" } });
      }
      return NextResponse.json(body, { headers: { "x-cache": "cooldown" } });
    }

    if (!takeToken()) {
      const retryAfter = 3;
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(retryAfter) } });
    }

    lastFetchAt.set(cacheKey, now);

    let progressive: Array<{ url:string; itag:number; qualityLabel?:string; bitrate?:number }> = [];
    let fallback: Array<{ url:string; itag:number; qualityLabel?:string; bitrate?:number }> = [];

    const tryCore = async () => { const r = await extractWithYtdlCore(id); progressive = r.progressive; fallback = r.fallback; };
    const tryPiped = async () => { const r = await extractWithPiped(id); progressive = r.progressive; fallback = r.fallback; };

    try {
      if (forceSource === "piped") await tryPiped(); else await tryCore();
      if (!progressive.length && !fallback.length) throw new Error("empty_formats");
    } catch (e:any) {
      try { await tryPiped(); }
      catch (ee:any) {
        return NextResponse.json({ error: ee?.message || e?.message || "resolve_failed" }, { status: 502 });
      }
    }

    if (wantProgressiveList && progressive.length > 0) {
      const data = { variants: progressive } as const;
      cache.set(cacheKey, { data: data as any, expires: now + CACHE_TTL_MS });
      return NextResponse.json(data, { headers: { "x-cache": "miss", "x-source": forceSource==="piped"?"piped":"auto" } });
    }

    const chosen = progressive[0] || fallback[0];
    if (!chosen?.url) return NextResponse.json({ error: "no_url" }, { status: 404 });

    const data = { url: chosen.url, itag: chosen.itag, qualityLabel: chosen.qualityLabel };
    cache.set(cacheKey, { data, expires: now + CACHE_TTL_MS });

    return NextResponse.json(data, { headers: { "x-cache": "miss", "x-source": forceSource==="piped"?"piped":"auto" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "resolve_failed" }, { status: 500 });
  }
}