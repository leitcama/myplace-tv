"use client";
import { useEffect, useRef, useState } from "react";
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
  const [ttff, setTtff] = useState<number|null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    currentTimeRef.current = startSeconds||0;
    startedRef.current = false;
    setTtff(null);
    startTimeRef.current = performance.now();
    
    if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
    watchdogRef.current = window.setTimeout(() => {
      if (!startedRef.current) { 
        console.warn("Startup timeout - skipping video", { videoId, elapsed: performance.now() - startTimeRef.current });
        onSkip(599); 
        onAdvance(); 
      }
    }, 3000); // Increased to 3s for better tolerance
    
    return () => { if (watchdogRef.current) window.clearTimeout(watchdogRef.current); };
  }, [videoId, startSeconds, onAdvance, onSkip]);

  const handleStarted = () => {
    startedRef.current = true;
    if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
    
    const ttffMs = performance.now() - startTimeRef.current;
    setTtff(ttffMs);
    
    // Log TTFF for monitoring
    console.log("TTFF measured", {
      videoId,
      ttff: ttffMs.toFixed(1),
      startSeconds,
      timestamp: new Date().toISOString(),
    });
    
    // Send telemetry if TTFF is available
    if (typeof window !== 'undefined' && window.navigator) {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ttff',
          videoId,
          ttff: ttffMs,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {}); // Silently fail
    }
  };

  const handleError = (e: any) => {
    console.warn("playback_error", { videoId, error: e, elapsed: performance.now() - startTimeRef.current });
    onSkip(599); 
    onAdvance(); 
  };

  return <div className="relative w-full max-w-[1600px] mx-auto aspect-video bg-black rounded-xl overflow-hidden shadow-screen vignette grain">
    <MSEPlayer
      videoId={videoId}
      startSeconds={startSeconds}
      onStarted={handleStarted}
      onEnded={onAdvance}
      onError={handleError}
    />
  </div>;
}
