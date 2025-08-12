"use client";
import { useEffect, useRef } from "react";

export function useDriftSync(opts:{ currentId:string; getCurrentTime:()=>Promise<number>|number; seekTo:(s:number)=>void; thresholdSec?:number; intervalMs?:number; }){
  const { currentId, getCurrentTime, seekTo, thresholdSec=1.5, intervalMs=5*60*1000 } = opts;
  const syncing = useRef(false);

  async function sync(){
    if (syncing.current) return; syncing.current = true;
    try{
      const r = await fetch("/api/now", { cache:"no-store" }); if (!r.ok) return;
      const s = await r.json() as { videoId:string; offset:number; serverTime:string };
      const c = await getCurrentTime();
      // Only sync if we are significantly off (1.5+ seconds) and on the same video
      if (s.videoId === currentId && Math.abs(c - s.offset) > thresholdSec) {
        console.log(`Drift sync: adjusting from ${c}s to ${s.offset}s (diff: ${Math.abs(c - s.offset).toFixed(1)}s)`);
        seekTo(s.offset);
      }
    } catch (error) {
      console.warn("Drift sync failed:", error);
    } finally { syncing.current = false; }
  }

  useEffect(() => {
    const id = setInterval(sync, intervalMs);
    // Only sync on visibility change if we have been away for more than 30 seconds
    let lastSync = Date.now();
    const vis = () => {
      if (document.visibilityState === "visible" && (Date.now() - lastSync) > 30000) {
        lastSync = Date.now();
        sync();
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [currentId]);
}
