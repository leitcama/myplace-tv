import { NextResponse } from "next/server";
import { isReady, readFileIfExists, startPackager, getFilePath } from "@/lib/server/packager";
import { promises as fs } from "node:fs";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }:{ params:{ id: string } }){
  const url = new URL(req.url);
  const id = params.id;
  const kind = url.searchParams.get("kind") || "master"; // master|v0|seg
  const src = url.searchParams.get("src"); // optional direct source URL to pack

  if (src){
    const internalBase = process.env.INTERNAL_ORIGIN || "http://localhost:3000";
    const packSrc = /^https?:\/\//.test(src) ? src : `${internalBase}${src}`;
    startPackager(id, packSrc);
  }

  if (!isReady(id) && !src){
    return NextResponse.json({ error: "not_ready" }, { status: 404 });
  }

  if (kind === "master"){
    const data = readFileIfExists(id, "index.m3u8");
    if (!data) return NextResponse.json({ error: "no_master" }, { status: 404 });
    return new NextResponse(new Uint8Array(data), { headers: { "content-type": "application/vnd.apple.mpegurl" } });
  }
  if (kind === "v0"){
    const data = readFileIfExists(id, "v0.m3u8");
    if (!data) return NextResponse.json({ error: "no_variant" }, { status: 404 });
    return new NextResponse(new Uint8Array(data), { headers: { "content-type": "application/vnd.apple.mpegurl" } });
  }
  if (kind === "seg"){
    const n = url.searchParams.get("n") || "0";
    const p = getFilePath(id, `seg-${String(n).padStart(5,"0")}.ts`);
    try{ const b = await fs.readFile(p); return new NextResponse(new Uint8Array(b), { headers: { "content-type": "video/MP2T", "cache-control": "public, max-age=30" } }); } catch {
      return NextResponse.json({ error: "no_segment" }, { status: 404 });
    }
  }

  return NextResponse.json({ error: "bad_kind" }, { status: 400 });
}