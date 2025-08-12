"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useYouTube } from "@/lib/hooks/useYouTube";
import { useDriftSync } from "@/lib/hooks/useDriftSync";

export default function Player({ videoId, startSeconds, onAdvance, onSkip }:{
  videoId:string; startSeconds:number; onAdvance:()=>void; onSkip:(code:number)=>void;
}){
  const containerRef = useRef<HTMLDivElement|null>(null);
  const videoRef = useRef<HTMLVideoElement|null>(null);
  const [usingIframe, setUsingIframe] = useState(false);
  const { ready, player, loadById, getCurrentTime, seekTo } = useYouTube(containerRef);

  const [variants, setVariants] = useState<Array<{ url:string; itag:number; qualityLabel?:string; bitrate?:number }>>([]);
  const [currentUrl, setCurrentUrl] = useState<string>("");

  const chooseVariant = useCallback((list: typeof variants) => {
    // Simple heuristic: pick medium bitrate first, then adapt
    if (!list.length) return undefined;
    const sorted = list.slice().sort((a,b)=>(a.bitrate||0)-(b.bitrate||0));
    const mid = sorted[Math.floor(sorted.length/2)] || sorted[0];
    return mid;
  }, []);

  const loadDirect = useCallback(async (id:string, start:number) => {
    try{
      const r = await fetch(`/api/stream/${encodeURIComponent(id)}?progressive=1`, { cache: "no-store" });
      if (!r.ok) throw new Error(`stream_meta_${r.status}`);
      const data = await r.json();
      const list = (data.variants || []) as Array<{ url:string; itag:number; qualityLabel?:string; bitrate?:number }>;
      if (!list.length) throw new Error("no_variants");
      setVariants(list);
      const v = chooseVariant(list);
      if (!v) throw new Error("no_choice");
      setCurrentUrl(v.url);
      const el = videoRef.current;
      if (!el) throw new Error("no_video");
      el.src = v.url;
      el.currentTime = start;
      await el.play();
      return true;
    } catch (e:any){
      return false;
    }
  }, [chooseVariant]);

  // Drift sync integration for direct video
  useDriftSync({ currentId: videoId, getCurrentTime: async ()=> videoRef.current?.currentTime || 0, seekTo: s => { const el=videoRef.current; if (el) el.currentTime = s; } });

  useEffect(()=>{ let cancelled=false; (async()=>{
    setUsingIframe(false);
    setVariants([]);
    setCurrentUrl("");
    // Try direct first
    const ok = await loadDirect(videoId, startSeconds);
    if (cancelled) return;
    if (!ok){
      // Fallback to iframe
      setUsingIframe(true);
      if (ready) loadById(videoId, startSeconds);
    }
  })(); return ()=>{ cancelled=true; const el=videoRef.current; if (el) { el.pause(); el.removeAttribute("src"); el.load(); } }; }, [videoId, startSeconds, ready, loadById]);

  // Basic adaptive downshift on stalling/buffering
  useEffect(()=>{
    const el = videoRef.current; if (!el) return;
    const onStall = () => {
      if (!variants.length) return;
      const idx = variants.findIndex(v=>v.url===currentUrl);
      const next = variants[Math.max(0, idx-1)] || variants[idx];
      if (next && next.url !== currentUrl){
        const ct = el.currentTime;
        setCurrentUrl(next.url);
        el.src = next.url;
        el.currentTime = ct;
        el.play().catch(()=>{});
      }
    };
    el.addEventListener("waiting", onStall);
    el.addEventListener("stalled", onStall);
    return ()=>{ el.removeEventListener("waiting", onStall); el.removeEventListener("stalled", onStall); };
  }, [variants, currentUrl]);

  useEffect(() => {
    if (!player || !usingIframe) return;
    let started = false;
    const startTimer = setTimeout(() => { if (!started) { onSkip(599); onAdvance(); } }, 2000);
    function onPlayback(e:any){ if (e.data === (window as any).YT?.PlayerState.PLAYING) started = true; }
    function onStateChange(e:any){ if (e.data === (window as any).YT?.PlayerState.ENDED) onAdvance(); }
    function onError(code:number){ onSkip(code); onAdvance(); }
    player.addEventListener("onStateChange", onStateChange);
    player.addEventListener("onError", onError);
    player.addEventListener("onStateChange", onPlayback);
    return () => { clearTimeout(startTimer); try {
      player.removeEventListener("onError", onError);
      player.removeEventListener("onStateChange", onStateChange);
      player.removeEventListener("onStateChange", onPlayback);
    } catch {} };
  }, [player, usingIframe, onAdvance, onSkip]);

  return (
    <div className="relative w-full max-w-[1600px] mx-auto aspect-video bg-black rounded-xl overflow-hidden shadow-screen vignette grain">
      {!usingIframe && (
        <video ref={videoRef} className="absolute inset-0 w-full h-full" playsInline muted={false} controls={false} />
      )}
      {usingIframe && (
        <div ref={containerRef} className="absolute inset-0" />
      )}
    </div>
  );
}
