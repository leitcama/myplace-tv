import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ytdl-core", () => ({
  default: {},
  getInfo: vi.fn(async (_id:string) => ({
    formats: [
      { hasAudio: true, hasVideo: true, container: "mp4", url: "https://rr1---sn-a5mek.googlevideo.com/videoplayback?expire=9999999999", itag: 22 }
    ],
    playerResponse: { streamingData: {} }
  }))
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
  });

  it("uses piped fallback when youtube tier throws", async () => {
    const ytdl = await import("ytdl-core");
    (ytdl as any).getInfo.mockImplementationOnce(async () => { throw new Error("yt_down"); });
    g.fetch = vi.fn(async (_u:string) => ({ ok: true, json: async () => ({ dash: "https://piped.invalid/manifest.mpd" }) }));
    const mod = await import("../app/api/video/playback/resolve/route");
    const req = new Request("http://localhost/api/video/playback/resolve?videoId=abc");
    const res: Response = await (mod as any).GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("dash");
    expect(body.tier).toBe("piped");
  });
});