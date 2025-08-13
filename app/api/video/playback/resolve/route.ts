import { NextResponse } from "next/server";
import ytdl from "ytdl-core";
import { cache, cacheKey, generateCorrelationId, logWithContext, incrementCacheMetric } from "@/lib/cache";
import { ResolveResponse, ResolveContext, ResolveError, CachedResolveResult, CachedPlayerResponse, ClientProfile } from "@/types/resolver";
import { getClientConfig, getOptimalClientProfile, detectRegion, CLIENT_CONFIGS } from "@/lib/clients";
import { tryInvidious, getInvidiousStats } from "@/lib/invidious";

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

function extractResolutionLadder(formats: any[]): any[] {
  return formats
    .filter((f) => (f as any).hasAudio && (f as any).hasVideo && !!f.url)
    .map((f) => ({
      itag: f.itag,
      quality: f.qualityLabel || f.quality,
      bitrate: f.bitrate,
      width: f.width,
      height: f.height,
      container: f.container,
      hasAudio: (f as any).hasAudio,
      hasVideo: (f as any).hasVideo,
    }))
    .sort((a, b) => (Number(b.bitrate || 0) - Number(a.bitrate || 0)));
}

async function tryPiped(videoId: string, context: ResolveContext) {
  const endpoints = [
    "https://piped.video/api/v1/streams/", // generic
    "https://pipedapi.kavin.rocks/api/v1/streams/", // common
  ];
  
  for (const base of endpoints) {
    try {
      const r = await fetch(base + encodeURIComponent(videoId), {
        headers: { "user-agent": "midwest-tv/0.1 (+https://example.com)" },
        cache: "no-store"
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (j?.dash) return { type: "dash" as const, url: String(j.dash) };
      if (j?.hls) return { type: "hls" as const, url: String(j.hls) };
    } catch (e) {
      logWithContext('warn', 'Piped endpoint failed', context, { endpoint: base, error: e });
    }
  }
  return null;
}

async function resolveWithYouTube(videoId: string, context: ResolveContext): Promise<ResolveResponse | null> {
  const { correlationId, clientProfile = 'WEB' } = context;
  
  // Get client configuration
  const clientConfig = getClientConfig(clientProfile);
  
  // Check cache for player response
  const playerResponseKey = cacheKey('playerResponse', videoId, clientProfile);
  let playerResponse = await cache.get<CachedPlayerResponse>(playerResponseKey);
  
  if (playerResponse) {
    incrementCacheMetric('hits');
    logWithContext('info', 'Player response cache hit', context);
  } else {
    incrementCacheMetric('misses');
    logWithContext('info', 'Player response cache miss', context);
    
    try {
      // Use ytdl-core with client configuration
      const info = await ytdl.getInfo(videoId, {
        requestOptions: {
          headers: {
            'User-Agent': clientConfig.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
        },
      });
      
      const pr: any = (info as any).player_response || (info as any).playerResponse || {};
      
      // Cache the player response
      const cachedResponse: CachedPlayerResponse = {
        playerResponse: pr,
        cachedAt: new Date().toISOString(),
        ttl: 5 * 60 * 1000, // 5 minutes
        clientProfile,
        region: context.region,
      };
      await cache.set(playerResponseKey, cachedResponse, cachedResponse.ttl);
      incrementCacheMetric('sets');
      
      playerResponse = cachedResponse;
    } catch (e) {
      logWithContext('error', 'YouTube resolve failed', context, { 
        error: e, 
        clientProfile,
        userAgent: clientConfig.userAgent 
      });
      return null;
    }
  }
  
  const pr = playerResponse.playerResponse;
  const sd = pr?.streamingData || {};
  
  // Prefer DASH if available for ABR/MSE
  if (sd.dashManifestUrl) {
    const url = sd.dashManifestUrl as string;
    const expiresAt = computeExpiry(url);
    const host = (() => { try { return new URL(url).host; } catch { return undefined; } })();
    
    return {
      type: "dash",
      url,
      expiresAt,
      cdnHost: host,
      tier: "youtube",
      clientProfile,
      correlationId,
      timestamp: new Date().toISOString(),
    };
  }
  
  // Fallback to HLS if present (more common for live)
  if (sd.hlsManifestUrl) {
    const url = sd.hlsManifestUrl as string;
    const expiresAt = computeExpiry(url);
    const host = (() => { try { return new URL(url).host; } catch { return undefined; } })();
    
    return {
      type: "hls",
      url,
      expiresAt,
      cdnHost: host,
      tier: "youtube",
      clientProfile,
      correlationId,
      timestamp: new Date().toISOString(),
    };
  }
  
  // Final fallback: progressive MP4 with both audio+video
  const info = await ytdl.getInfo(videoId, {
    requestOptions: {
      headers: {
        'User-Agent': clientConfig.userAgent,
      },
    },
  });
  const progressive = (info.formats || [])
    .filter((f) => (f as any).hasAudio && (f as any).hasVideo && (f as any).container === "mp4" && !!f.url)
    .sort((a, b) => (Number(b.bitrate || 0) - Number(a.bitrate || 0)) || (Number(b.contentLength || 0) - Number(a.contentLength || 0)));
  
  if (progressive.length > 0) {
    const url = progressive[0].url as string;
    const expiresAt = computeExpiry(url);
    const host = (() => { try { return new URL(url).host; } catch { return undefined; } })();
    
    return {
      type: "file",
      url,
      expiresAt,
      cdnHost: host,
      tier: "youtube",
      clientProfile,
      resolutionLadder: extractResolutionLadder(info.formats || []),
      correlationId,
      timestamp: new Date().toISOString(),
    };
  }
  
  return null;
}

export async function GET(req: Request) {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();
  
  try {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");
    const requestedClientProfile = searchParams.get("clientProfile") as ClientProfile;
    const requestedRegion = searchParams.get("region");
    
    if (!videoId) {
      const error: ResolveError = {
        code: 'unknown',
        message: 'videoId is required',
        correlationId,
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json({ error }, { status: 400 });
    }
    
    // Detect region and determine optimal client profile
    const headers = Object.fromEntries(req.headers.entries());
    const detectedRegion = requestedRegion || detectRegion(headers);
    const userAgent = req.headers.get('user-agent') || undefined;
    const rawClientProfile = requestedClientProfile || getOptimalClientProfile(detectedRegion, userAgent);
    
    // Validate client profile and fallback to WEB if invalid
    const clientProfile: ClientProfile = CLIENT_CONFIGS[rawClientProfile as ClientProfile] ? rawClientProfile as ClientProfile : 'WEB';
    
    const context: ResolveContext = {
      videoId,
      clientProfile,
      region: detectedRegion,
      correlationId,
      userAgent,
      operation: 'resolve',
    };
    
    logWithContext('info', 'Resolve request started', context, {
      detectedRegion,
      optimalClientProfile: clientProfile,
      requestedClientProfile,
      requestedRegion,
    });
    
    // Check cache for resolve result
    const resolveKey = cacheKey('resolveOutcome', videoId, clientProfile, detectedRegion);
    const cachedResult = await cache.get<CachedResolveResult>(resolveKey);
    
    if (cachedResult) {
      incrementCacheMetric('hits');
      logWithContext('info', 'Resolve result cache hit', context, { 
        latency: Date.now() - startTime,
        tier: cachedResult.result.tier 
      });
      return NextResponse.json(cachedResult.result);
    }
    
    incrementCacheMetric('misses');
    
    // Tier 1: YouTube via ytdl-core with optimal client
    const youtubeResult = await resolveWithYouTube(videoId, context);
    if (youtubeResult) {
      // Cache the result
      const ttl = youtubeResult.expiresAt 
        ? Math.max(0, new Date(youtubeResult.expiresAt).getTime() - Date.now() - 60000) // 1 minute safety margin
        : 4 * 60 * 1000; // 4 minutes default
      
      const cachedResult: CachedResolveResult = {
        result: youtubeResult,
        cachedAt: new Date().toISOString(),
        ttl,
      };
      await cache.set(resolveKey, cachedResult, ttl);
      incrementCacheMetric('sets');
      
      logWithContext('info', 'YouTube resolve successful', context, { 
        latency: Date.now() - startTime,
        tier: youtubeResult.tier,
        type: youtubeResult.type,
        clientProfile: youtubeResult.clientProfile,
      });
      
      return NextResponse.json(youtubeResult);
    }
    
    // Tier 2: Piped fallback
    logWithContext('info', 'Attempting Piped fallback', context);
    const piped = await tryPiped(videoId, context);
    if (piped) {
      const expiresAt = computeExpiry(piped.url);
      const host = (() => { try { return new URL(piped.url).host; } catch { return undefined; } })();
      
      const result: ResolveResponse = {
        type: piped.type,
        url: piped.url,
        expiresAt,
        cdnHost: host,
        tier: "piped",
        clientProfile,
        correlationId,
        timestamp: new Date().toISOString(),
      };
      
      // Cache with shorter TTL for fallback results
      const cachedResult: CachedResolveResult = {
        result,
        cachedAt: new Date().toISOString(),
        ttl: 2 * 60 * 1000, // 2 minutes for fallback
      };
      await cache.set(resolveKey, cachedResult, cachedResult.ttl);
      incrementCacheMetric('sets');
      
      logWithContext('info', 'Piped fallback successful', context, { 
        latency: Date.now() - startTime,
        tier: result.tier,
        type: result.type 
      });
      
      return NextResponse.json(result);
    }
    
    // Tier 3: Invidious fallback
    logWithContext('info', 'Attempting Invidious fallback', context);
    const invidious = await tryInvidious(videoId, context);
    if (invidious) {
      const expiresAt = computeExpiry(invidious.url);
      const host = (() => { try { return new URL(invidious.url).host; } catch { return undefined; } })();
      
      const result: ResolveResponse = {
        type: invidious.type,
        url: invidious.url,
        expiresAt,
        cdnHost: host,
        tier: "invidious",
        clientProfile,
        correlationId,
        timestamp: new Date().toISOString(),
      };
      
      // Cache with very short TTL for Invidious results
      const cachedResult: CachedResolveResult = {
        result,
        cachedAt: new Date().toISOString(),
        ttl: 1 * 60 * 1000, // 1 minute for Invidious
      };
      await cache.set(resolveKey, cachedResult, cachedResult.ttl);
      incrementCacheMetric('sets');
      
      logWithContext('info', 'Invidious fallback successful', context, { 
        latency: Date.now() - startTime,
        tier: result.tier,
        type: result.type 
      });
      
      return NextResponse.json(result);
    }
    
    // No playable formats found
    const error: ResolveError = {
      code: 'unknown',
      message: 'No playable formats found',
      correlationId,
      timestamp: new Date().toISOString(),
    };
    
    logWithContext('error', 'No playable formats found', context, { 
      latency: Date.now() - startTime,
      tiersAttempted: ['youtube', 'piped', 'invidious']
    });
    
    // Return error with context information for debugging
    return NextResponse.json({ 
      error,
      context: {
        clientProfile,
        region: detectedRegion,
        tiersAttempted: ['youtube', 'piped', 'invidious']
      }
    }, { status: 502 });
    
  } catch (error: any) {
    const errorResponse: ResolveError = {
      code: 'unknown',
      message: error?.message || String(error),
      correlationId,
      timestamp: new Date().toISOString(),
    };
    
    logWithContext('error', 'Resolve failed', { 
      correlationId, 
      videoId: 'unknown', 
      operation: 'resolve' 
    }, { error: errorResponse, latency: Date.now() - startTime });
    
    return NextResponse.json({ 
      error: errorResponse,
      context: {
        clientProfile: 'unknown',
        region: 'unknown',
        tiersAttempted: []
      }
    }, { status: 500 });
  }
}