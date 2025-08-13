import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ytdl-core", () => ({
  default: {
    getInfo: vi.fn(async (_id:string) => ({
      formats: [
        { hasAudio: true, hasVideo: true, container: "mp4", url: "https://rr1---sn-a5mek.googlevideo.com/videoplayback?expire=9999999999", itag: 22 }
      ],
      playerResponse: { streamingData: {} }
    }))
  },
  getInfo: vi.fn(async (_id:string) => ({
    formats: [
      { hasAudio: true, hasVideo: true, container: "mp4", url: "https://rr1---sn-a5mek.googlevideo.com/videoplayback?expire=9999999999", itag: 22 }
    ],
    playerResponse: { streamingData: {} }
  }))
}));

// Mock cache
vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
  cacheKey: vi.fn((type, videoId) => `${type}:${videoId}`),
  generateCorrelationId: vi.fn(() => "test-correlation-id"),
  logWithContext: vi.fn(),
  incrementCacheMetric: vi.fn(),
}));

// Mock clients
vi.mock("@/lib/clients", () => ({
  getClientConfig: vi.fn(() => ({
    name: 'WEB',
    version: '2.20231219.01.00',
    platform: 'DESKTOP',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    innertubeApiKey: 'test-key',
    innertubeContext: {},
  })),
  getOptimalClientProfile: vi.fn(() => 'WEB'),
  detectRegion: vi.fn(() => 'US'),
}));

// Mock invidious
vi.mock("@/lib/invidious", () => ({
  tryInvidious: vi.fn(async () => null),
  getInvidiousStats: vi.fn(() => ({
    totalEndpoints: 8,
    availableEndpoints: 8,
    endpointStates: {},
  })),
}));

// Piped mock via global fetch
const g: any = globalThis;

describe("/api/video/playback/resolve", () => {
  beforeEach(() => {
    g.fetch = vi.fn(async (_url:string) => ({ ok: true, json: async () => ({}) }));
  });

  it("returns progressive file when no dash/hls", async () => {
    const mod = await import("../app/api/video/playback/resolve/route");
    const req = new Request("http://localhost/api/video/playback/resolve?videoId=abc");
    const res: Response = await (mod as any).GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("file");
    expect(body.url).toMatch(/googlevideo/);
    expect(body.tier).toBe("youtube");
    expect(body.correlationId).toBe("test-correlation-id");
    expect(body.timestamp).toBeDefined();
  });

  it("uses piped fallback when youtube tier throws", async () => {
    const { cache } = await import("@/lib/cache");
    (cache.get as any).mockImplementationOnce(async () => null); // Cache miss
    (cache.get as any).mockImplementationOnce(async () => null); // Cache miss for resolve result
    
    const ytdl = await import("ytdl-core");
    (ytdl.default.getInfo as any).mockImplementationOnce(async () => { throw new Error("yt_down"); });
    
    g.fetch = vi.fn(async (_u:string) => ({ ok: true, json: async () => ({ dash: "https://piped.invalid/manifest.mpd" }) }));
    const mod = await import("../app/api/video/playback/resolve/route");
    const req = new Request("http://localhost/api/video/playback/resolve?videoId=abc");
    const res: Response = await (mod as any).GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("dash");
    expect(body.tier).toBe("piped");
    expect(body.correlationId).toBe("test-correlation-id");
  });

  it("returns error for missing videoId", async () => {
    const mod = await import("../app/api/video/playback/resolve/route");
    const req = new Request("http://localhost/api/video/playback/resolve");
    const res: Response = await (mod as any).GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("unknown");
  });

  it("uses optimal client profile and region detection", async () => {
    const { getOptimalClientProfile, detectRegion } = await import("@/lib/clients");
    (getOptimalClientProfile as any).mockReturnValueOnce('ANDROID');
    (detectRegion as any).mockReturnValueOnce('CN');
    
    const mod = await import("../app/api/video/playback/resolve/route");
    const req = new Request("http://localhost/api/video/playback/resolve?videoId=abc");
    const res: Response = await (mod as any).GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clientProfile).toBe("ANDROID");
    expect(body.correlationId).toBe("test-correlation-id");
  });
});