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

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

    const urlObj = new URL(req.url);
    const wantProgressiveList = urlObj.searchParams.get("progressive") === "1" || urlObj.searchParams.get("all") === "1";

    // Serve from cache if valid
    const cached = cache.get(id);
    const now = Date.now();
    if (cached && cached.expires > now) {
      const body = cached.data as any;
      // ensure shape matches request type; if we have variants and caller wants single, return top
      if (!wantProgressiveList && "variants" in body) {
        const top = body.variants[0];
        return NextResponse.json({ url: top.url, itag: top.itag, qualityLabel: top.qualityLabel }, { headers: { "x-cache": "hit" } });
      }
      return NextResponse.json(body, { headers: { "x-cache": "hit" } });
    }

    // Cooldown enforcement
    const last = lastFetchAt.get(id) || 0;
    if (now - last < COOLDOWN_MS && cached) {
      const body = cached.data as any;
      if (!wantProgressiveList && "variants" in body) {
        const top = body.variants[0];
        return NextResponse.json({ url: top.url, itag: top.itag, qualityLabel: top.qualityLabel }, { headers: { "x-cache": "cooldown" } });
      }
      return NextResponse.json(body, { headers: { "x-cache": "cooldown" } });
    }

    // Rate limiting (global)
    if (!takeToken()) {
      const retryAfter = 3;
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(retryAfter) } });
    }

    lastFetchAt.set(id, now);

    const info = await ytdl.getInfo(id);
    // Progressive mp4: audio+video in one URL
    const progressive = ytdl.filterFormats(info.formats, "audioandvideo")
      .filter(f => f.container === "mp4" && !!f.url)
      .map(f => ({ url: f.url, itag: f.itag, qualityLabel: f.qualityLabel, bitrate: f.bitrate || f.averageBitrate }))
      .sort((a,b)=> (b.bitrate||0) - (a.bitrate||0));

    // Fallback: any with URL
    const fallback = info.formats.filter(f => !!f.url)
      .map(f => ({ url: f.url, itag: f.itag, qualityLabel: f.qualityLabel, bitrate: f.bitrate || f.averageBitrate }));

    if (wantProgressiveList && progressive.length > 0) {
      const data = { variants: progressive } as const;
      cache.set(id, { data: data as any, expires: now + CACHE_TTL_MS });
      return NextResponse.json(data, { headers: { "x-cache": "miss" } });
    }

    const chosen = progressive[0] || fallback[0];
    if (!chosen?.url) return NextResponse.json({ error: "no_url" }, { status: 404 });

    const data = { url: chosen.url, itag: chosen.itag, qualityLabel: chosen.qualityLabel };
    cache.set(id, { data, expires: now + CACHE_TTL_MS });

    return NextResponse.json(data, { headers: { "x-cache": "miss" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "resolve_failed" }, { status: 500 });
  }
}