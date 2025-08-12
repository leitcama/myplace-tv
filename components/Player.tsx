"use client";
import { useEffect, useRef } from "react";
import { useYouTube } from "@/lib/hooks/useYouTube";
import { useDriftSync } from "@/lib/hooks/useDriftSync";

export default function Player({ videoId, startSeconds, muted = false, onAdvance, onSkip }:{
  videoId:string; startSeconds:number; muted?:boolean; onAdvance:()=>void; onSkip:(code:number)=>void;
}){
  const ref = useRef<HTMLDivElement|null>(null);
  const { ready, player, loadById, getCurrentTime, seekTo, mute, unMute } = useYouTube(ref);
  const badIds = useRef<Set<string>>(new Set());

  useEffect(() => { if (ready && videoId) loadById(videoId, startSeconds); }, [ready, videoId, startSeconds, loadById]);
  useDriftSync({ currentId: videoId, getCurrentTime, seekTo });

  // Apply mute state
  useEffect(() => {
    if (!player) return;
    if (muted) { mute(); } else { unMute(); }
  }, [player, muted, mute, unMute]);

  useEffect(() => {
    if (!player) return;
    let started = false;
    const startTimer = setTimeout(() => { if (!started) { badIds.current.add(videoId); onSkip(599); onAdvance(); } }, 6000);

    function onPlayback(e:any){ if (e.data === window.YT?.PlayerState.PLAYING) started = true; }
    function onStateChange(e:any){ if (e.data === window.YT?.PlayerState.ENDED) onAdvance(); }
    function onError(code:number){ badIds.current.add(videoId); onSkip(code); onAdvance(); }

    player.addEventListener("onStateChange", onStateChange);
    player.addEventListener("onError", onError);
    player.addEventListener("onStateChange", onPlayback);
    return () => { clearTimeout(startTimer); try {
      player.removeEventListener("onError", onError);
      player.removeEventListener("onStateChange", onStateChange);
      player.removeEventListener("onStateChange", onPlayback);
    } catch {} };
  }, [player, videoId, onAdvance, onSkip]);

  return <div className="relative w-full max-w-[1600px] mx-auto aspect-video bg-black rounded-xl overflow-hidden shadow-screen vignette grain">
    <div ref={ref} className="absolute inset-0" />
  </div>;
}
