import { NextRequest, NextResponse } from "next/server";
import ytdl from "ytdl-core";
import LruCache from "@/lib/server/lru";

const cache = new LruCache<string, { url: string; contentType?: string }>(64, 5 * 60 * 1000);

function logJson(obj: Record<string, unknown>) {
  try { console.error(JSON.stringify({ ts: new Date().toISOString(), ...obj })); } catch {}
}

function isValidId(id: string){ return /^[a-zA-Z0-9_-]{6,}$/.test(id); }

async function resolveMuxedUrl(videoId: string): Promise<{ url: string; contentType?: string }> {
  const cached = cache.get(videoId);
  if (cached) return cached;

  const info = await ytdl.getInfo(videoId);
  const formats = info.formats || [];
  const pick =
    formats.find(f => f.itag === 22) ||
    formats.find(f => f.itag === 18) ||
    formats.find(f => f.container === "mp4" && !!f.hasAudio && !!f.hasVideo) ||
    formats.find(f => !!f.url);
  if (!pick?.url) throw new Error("no_muxed_url");

  // HEAD
  const head = await fetch(pick.url, { method: "HEAD" });
  if (!head.ok) throw new Error(`upstream_head_${head.status}`);
  const contentType = head.headers.get("content-type") || undefined;

  const value = { url: pick.url, contentType };
  cache.set(videoId, value);
  return value;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }){
  const id = params.id;
  if (!isValidId(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });

  let resolved: { url: string; contentType?: string };
  try {
    resolved = await resolveMuxedUrl(id);
  } catch (err: any) {
    logJson({ id, reason: "resolve_failed", error: String(err?.message||err) });
    return NextResponse.json({ error: "stream_unavailable", id, fallback: `/watch/${id}` }, { status: 503 });
  }

  const range = req.headers.get("range");
  const headers: Record<string, string> = {
    "Accept": "*/*",
    "Accept-Encoding": req.headers.get("accept-encoding") || "",
    "User-Agent": req.headers.get("user-agent") || "",
    "Referer": "https://www.youtube.com/",
  };
  if (range) headers["Range"] = range;

  let upstreamResp: Response;
  try {
    upstreamResp = await fetch(resolved.url, { headers, redirect: "follow", signal: req.signal as unknown as AbortSignal });
    if (upstreamResp.status === 403 || upstreamResp.status === 404) {
      cache.delete(id);
      resolved = await resolveMuxedUrl(id);
      upstreamResp = await fetch(resolved.url, { headers, redirect: "follow", signal: req.signal as unknown as AbortSignal });
    }
  } catch (err: any) {
    logJson({ id, reason: "upstream_failed", error: String(err?.message||err) });
    return NextResponse.json({ error: "stream_unavailable", id, fallback: `/watch/${id}` }, { status: 503 });
  }

  if (!upstreamResp.ok && upstreamResp.status !== 206) {
    logJson({ id, reason: "upstream_bad_status", status: upstreamResp.status });
    return NextResponse.json({ error: "stream_unavailable", id, fallback: `/watch/${id}` }, { status: 503 });
  }

  const respHeaders = new Headers();
  const copyHeaders = ["content-length", "content-range", "accept-ranges", "content-type"] as const;
  for (const h of copyHeaders) {
    const v = upstreamResp.headers.get(h);
    if (v) respHeaders.set(h, v);
  }
  if (!respHeaders.has("content-type")) respHeaders.set("Content-Type", resolved.contentType || "video/mp4");
  respHeaders.set("Cache-Control", "private, max-age=300");

  return new Response(upstreamResp.body, {
    status: upstreamResp.status === 206 || range ? 206 : 200,
    headers: respHeaders,
  });
}

export const dynamic = "force-dynamic"; // ensure Node runtime
export const runtime = "nodejs";