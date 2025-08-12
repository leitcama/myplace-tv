import { NextResponse } from "next/server";
import ytdl from "ytdl-core";

// Simple in-memory cache and rate limiting (per-process)
const cache = new Map<string, { data: { url: string; itag: number; qualityLabel?: string }; expires: number }>();
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

function getClientKey(req: Request) {
  try {
    const xf = req.headers.get("x-forwarded-for") || "";
    return xf.split(",")[0].trim() || "unknown";
  } catch { return "unknown"; }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

    // Serve from cache if valid
    const cached = cache.get(id);
    const now = Date.now();
    if (cached && cached.expires > now) {
      return NextResponse.json(cached.data, { headers: { "x-cache": "hit" } });
    }

    // Cooldown enforcement
    const last = lastFetchAt.get(id) || 0;
    if (now - last < COOLDOWN_MS && cached) {
      return NextResponse.json(cached.data, { headers: { "x-cache": "cooldown" } });
    }

    // Rate limiting (global)
    if (!takeToken()) {
      const retryAfter = 3;
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(retryAfter) } });
    }

    lastFetchAt.set(id, now);

    const info = await ytdl.getInfo(id);
    // Prefer mp4 video+audio progressive; fallback to highest quality with URL
    const progressive = ytdl.filterFormats(info.formats, "audioandvideo").filter(f => f.container === "mp4" && !!f.url);
    const fallback = info.formats.filter(f => !!f.url);

    const chosen = (progressive.sort((a,b)=>(b.bitrate||0)-(a.bitrate||0))[0]) || fallback[0];
    if (!chosen?.url) return NextResponse.json({ error: "no_url" }, { status: 404 });

    const data = { url: chosen.url, itag: chosen.itag, qualityLabel: chosen.qualityLabel };
    cache.set(id, { data, expires: now + CACHE_TTL_MS });

    return NextResponse.json(data, { headers: { "x-cache": "miss" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "resolve_failed" }, { status: 500 });
  }
}