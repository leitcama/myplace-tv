"use client";
import { useEffect, useRef } from "react";
import MSEPlayer from "@/components/MSEPlayer";
import { useDriftSync } from "@/lib/hooks/useDriftSync";

export default function Player({ videoId, startSeconds, onAdvance, onSkip }:{
  videoId:string; startSeconds:number; onAdvance:()=>void; onSkip:(code:number)=>void;
}){
  const currentTimeRef = useRef<number>(startSeconds||0);
  const getCurrentTime = async ()=> currentTimeRef.current;
  const seekTo = (s:number)=>{ currentTimeRef.current = s; const el = document.querySelector("video"); if (el) el.currentTime = s; };

  useDriftSync({ currentId: videoId, getCurrentTime, seekTo });

  const watchdogRef = useRef<number|undefined>();
  const startedRef = useRef<boolean>(false);

  useEffect(() => {
    currentTimeRef.current = startSeconds||0;
    startedRef.current = false;
    if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
    watchdogRef.current = window.setTimeout(() => {
      if (!startedRef.current) { onSkip(599); onAdvance(); }
    }, 2000);
    return () => { if (watchdogRef.current) window.clearTimeout(watchdogRef.current); };
  }, [videoId, startSeconds, onAdvance, onSkip]);

  return <div className="relative w-full max-w-[1600px] mx-auto aspect-video bg-black rounded-xl overflow-hidden shadow-screen vignette grain">
    <MSEPlayer
      videoId={videoId}
      startSeconds={startSeconds}
      onStarted={()=>{ startedRef.current = true; if (watchdogRef.current) window.clearTimeout(watchdogRef.current); }}
      onEnded={onAdvance}
      onError={(e)=>{ console.warn("playback_error", e); onSkip(599); onAdvance(); }}
    />
  </div>;
}
