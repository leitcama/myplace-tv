"use client";
import { useEffect, useRef, useState } from "react";
import { useYouTube } from "@/lib/hooks/useYouTube";
import { useDriftSync } from "@/lib/hooks/useDriftSync";

async function sendEvent(type:string, data?:Record<string,unknown>){
  try{ await fetch("/api/telemetry", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ type, data }) }); } catch {}
}

export default function Player({ videoId, startSeconds, muted, onAdvance, onSkip }:{
  videoId:string; startSeconds:number; muted:boolean; onAdvance:()=>void; onSkip:(code:number)=>void;
}){
  const ref = useRef<HTMLDivElement|null>(null);
  const { ready, player, loadById, getCurrentTime, seekTo, setMuted } = useYouTube(ref);
  const badIds = useRef<Set<string>>(new Set());
  const [isBuffering, setIsBuffering] = useState<boolean>(false);

  useEffect(() => { if (ready && videoId) loadById(videoId, startSeconds); }, [ready, videoId, startSeconds, loadById]);
  useDriftSync({ currentId: videoId, getCurrentTime, seekTo });

  useEffect(() => { setMuted(!!muted); }, [muted, setMuted]);

  useEffect(() => {
    if (!player) return;
    let started = false;
    setIsBuffering(true);
    sendEvent("buffer_start", { id: videoId });
    const startTimer = setTimeout(() => { if (!started) { badIds.current.add(videoId); onSkip(599); sendEvent("auto_skip", { id: videoId, reason:"no_start" }); onAdvance(); } }, 2000);

    function onPlayback(e:any){
      const PS = window.YT?.PlayerState;
      if (e.data === PS?.PLAYING) { started = true; if (isBuffering) sendEvent("buffer_end", { id: videoId }); setIsBuffering(false); }
      if (e.data === PS?.BUFFERING) { if (!isBuffering) sendEvent("buffer_start", { id: videoId }); setIsBuffering(true); }
      if (e.data === PS?.PAUSED) { setIsBuffering(false); }
    }
    function onStateChange(e:any){ if (e.data === window.YT?.PlayerState.ENDED) onAdvance(); }
    function onError(code:number){ badIds.current.add(videoId); onSkip(code); sendEvent("yt_error", { id: videoId, code }); onAdvance(); }

    player.addEventListener("onStateChange", onStateChange);
    player.addEventListener("onError", onError);
    player.addEventListener("onStateChange", onPlayback);
    return () => { clearTimeout(startTimer); try {
      player.removeEventListener("onError", onError);
      player.removeEventListener("onStateChange", onStateChange);
      player.removeEventListener("onStateChange", onPlayback);
    } catch {} };
  }, [player, videoId, onAdvance, onSkip, isBuffering]);

  return <div className="relative w-full max-w-[1600px] mx-auto aspect-video bg-black rounded-xl overflow-hidden shadow-screen vignette grain">
    <div ref={ref} className="absolute inset-0" />
    {isBuffering && (
      <div className="absolute inset-0 grid place-items-center z-10">
        <div className="glass rounded-full px-4 py-2 text-sm opacity-90">Buffering…</div>
      </div>
    )}
  </div>;
}
