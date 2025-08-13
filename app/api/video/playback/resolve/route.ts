import { NextResponse } from "next/server";
import ytdl from "ytdl-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function computeExpiry(urlString: string | undefined) {
  try {
    if (!urlString) return null;
    const u = new URL(urlString);
    const expire = u.searchParams.get("expire");
    if (expire) {
      const ms = Number(expire) * 1000;
      if (!Number.isNaN(ms)) return new Date(ms).toISOString();
    }
  } catch {}
  return null;
}

async function tryPiped(videoId: string) {
  const endpoints = [
    "https://piped.video/api/v1/streams/", // generic
    "https://pipedapi.kavin.rocks/api/v1/streams/", // common
  ];
  for (const base of endpoints) {
    try{
      const r = await fetch(base + encodeURIComponent(videoId), {
        headers: { "user-agent": "midwest-tv/0.1 (+https://example.com)" },
        cache: "no-store"
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (j?.dash) return { type: "dash" as const, url: String(j.dash) };
      if (j?.hls) return { type: "hls" as const, url: String(j.hls) };
    }catch{ /* continue */ }
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");
    if (!videoId) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    // Tier 1: youtubei via ytdl-core
    try{
      const info = await ytdl.getInfo(videoId);
      // ytdl-core keeps the raw player response here
      const pr: any = (info as any).player_response || (info as any).playerResponse || {};
      const sd = pr?.streamingData || {};

      // Prefer DASH if available for ABR/MSE
      if (sd.dashManifestUrl) {
        const url = sd.dashManifestUrl as string;
        const expiresAt = computeExpiry(url);
        const host = (() => { try { return new URL(url).host; } catch { return undefined; } })();
        return NextResponse.json({ type: "dash", url, expiresAt, cdnHost: host });
      }

      // Fallback to HLS if present (more common for live)
      if (sd.hlsManifestUrl) {
        const url = sd.hlsManifestUrl as string;
        const expiresAt = computeExpiry(url);
        const host = (() => { try { return new URL(url).host; } catch { return undefined; } })();
        return NextResponse.json({ type: "hls", url, expiresAt, cdnHost: host });
      }

      // Final fallback: progressive MP4 with both audio+video
      const progressive = (info.formats || [])
        .filter((f) => (f as any).hasAudio && (f as any).hasVideo && (f as any).container === "mp4" && !!f.url)
        .sort((a, b) => (Number(b.bitrate || 0) - Number(a.bitrate || 0)) || (Number(b.contentLength || 0) - Number(a.contentLength || 0)));

      if (progressive.length > 0) {
        const url = progressive[0].url as string;
        const expiresAt = computeExpiry(url);
        const host = (() => { try { return new URL(url).host; } catch { return undefined; } })();
        return NextResponse.json({ type: "file", url, expiresAt, cdnHost: host, itag: progressive[0].itag });
      }
    } catch (e) {
      // continue to Tier 2
    }

    // Tier 2: Piped fallback
    const piped = await tryPiped(videoId);
    if (piped) {
      const expiresAt = computeExpiry(piped.url);
      const host = (() => { try { return new URL(piped.url).host; } catch { return undefined; } })();
      return NextResponse.json({ type: piped.type, url: piped.url, expiresAt, cdnHost: host, tier: "piped" });
    }

    return NextResponse.json({ error: "No playable formats found" }, { status: 502 });
  } catch (error: any) {
    return NextResponse.json({ error: "resolve_failed", message: error?.message || String(error) }, { status: 500 });
  }
}