import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type PackagerSession = {
  id: string;
  dir: string;
  src: string;
  proc?: ChildProcessWithoutNullStreams;
  startedAt: number;
};

const idToSession = new Map<string, PackagerSession>();

function resolveFfmpegBinary(): string { return process.env.FFMPEG_PATH || "ffmpeg"; }
function getDirFor(id: string){ const dir = `/tmp/hls-${id}`; if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); return dir; }

export function getSession(id: string){ return idToSession.get(id); }

export function getFilePath(id: string, file: string){ return join(getDirFor(id), file); }

export function readFileIfExists(id: string, file: string){ try { return readFileSync(getFilePath(id, file)); } catch { return null; } }

export function isReady(id: string, file = "index.m3u8"){ try { const s = statSync(getFilePath(id, file)); return s.isFile() && s.size > 0; } catch { return false; } }

export function startPackager(id: string, src: string, variants?: Array<{ name:string; vcodec?:string; acodec?:string; bitrateK?:number }>): PackagerSession {
  const existing = idToSession.get(id);
  if (existing?.proc && !existing.proc.killed) return existing;

  const dir = getDirFor(id);
  const ffmpeg = resolveFfmpegBinary();
  const args: string[] = [
    "-hide_banner", "-loglevel", process.env.FFMPEG_LOGLEVEL || "error",
    "-y",
    "-i", src,
    "-c", "copy",
    "-f", "hls",
    "-hls_time", process.env.HLS_SEG_TIME || "4",
    "-hls_list_size", process.env.HLS_LIST_SIZE || "20",
    "-hls_flags", "delete_segments+independent_segments",
    "-master_pl_name", "index.m3u8",
    "-hls_segment_filename", join(dir, "seg-%05d.ts"),
    join(dir, "v0.m3u8")
  ];
  const proc = spawn(ffmpeg, args, { stdio: "ignore" });
  const sess: PackagerSession = { id, dir, src, proc, startedAt: Date.now() };
  idToSession.set(id, sess);
  proc.on("exit", ()=>{ /* keep session for logs; caller may restart */ });
  return sess;
}