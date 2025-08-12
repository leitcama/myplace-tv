import { NextResponse } from "next/server";
import ytdl from "ytdl-core";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

    const info = await ytdl.getInfo(id);
    // Prefer mp4 video+audio progressive; fallback to highest quality audio/video
    const progressive = ytdl.filterFormats(info.formats, "audioandvideo")
      .filter(f => f.container === "mp4" && !!f.url);
    const adaptive = ytdl.filterFormats(info.formats, "videoandaudio" as any)
      .filter(f => !!f.url);

    const chosen = (progressive.sort((a,b)=>(b.bitrate||0)-(a.bitrate||0))[0]) || adaptive[0] || info.formats.find(f=>!!f.url);
    if (!chosen?.url) return NextResponse.json({ error: "no_url" }, { status: 404 });

    return NextResponse.json({ url: chosen.url, itag: chosen.itag, qualityLabel: chosen.qualityLabel });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "resolve_failed" }, { status: 500 });
  }
}