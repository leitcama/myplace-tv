import { NextResponse } from "next/server";
import ytdl from "ytdl-core";

function isValidId(id: string){ return /^[a-zA-Z0-9_-]{6,}$/.test(id); }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "";
  if (!isValidId(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  try {
    const info = await ytdl.getInfo(id);
    const formats = info.formats || [];
    const pick =
      formats.find(f => f.itag === 22) ||
      formats.find(f => f.itag === 18) ||
      formats.find(f => f.container === "mp4" && !!f.hasAudio && !!f.hasVideo);
    if (!pick?.url) throw new Error("no_muxed_url");
    const head = await fetch(pick.url, { method: "HEAD" });
    if (!head.ok) throw new Error(`upstream_head_${head.status}`);
    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, id, error: String(e?.message||e) }, { status: 503 });
  }
}

export const dynamic = "force-dynamic";