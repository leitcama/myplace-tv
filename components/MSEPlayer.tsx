"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export default function MSEPlayer({ videoId, startSeconds, onStarted, onEnded, onError }:{
  videoId: string;
  startSeconds: number;
  onStarted: () => void;
  onEnded: () => void;
  onError: (err: any) => void;
}){
  const videoRef = useRef<HTMLVideoElement|null>(null);
  const [src, setSrc] = useState<{ type:"dash"|"hls"|"file"; url:string }|null>(null);

  // Preconnect hint host
  const preconnectHost = useMemo(() => {
    try{ if (!src?.url) return null; return new URL(src.url).origin; } catch{return null}
  }, [src?.url]);

  useEffect(()=>{
    let cancelled = false;
    async function resolve(){
      try{
        const r = await fetch(`/api/video/playback/resolve?videoId=${encodeURIComponent(videoId)}`, { cache:"no-store" });
        if (!r.ok) throw new Error(`resolve_failed_${r.status}`);
        const j = await r.json();
        if (cancelled) return;
        if (j?.type && j?.url) setSrc({ type:j.type, url:j.url }); else throw new Error("no_source");
      }catch(e){ onError(e); }
    }
    resolve();
    return () => { cancelled = true; };
  }, [videoId, onError]);

  useEffect(()=>{
    if (!src || !videoRef.current) return;
    let player: any | null = null;
    let destroyed = false;

    async function boot(){
      try{
        if (src.type === "dash"){
          const { default: shaka } = await import("shaka-player/dist/shaka-player.ui.js");
          if (destroyed) return;
          if (!shaka.Player.isBrowserSupported()) throw new Error("shaka_unsupported");
          player = new shaka.Player(videoRef.current);
          // Minimal buffering for fast TTF
          player.configure({
            streaming: { bufferingGoal: 10, rebufferingGoal: 2 },
            abr: { defaultBandwidthEstimate: 3_000_000, enabled: true, switchInterval: 2 },
          });
          player.addEventListener("error", (ev:any)=> onError(ev?.detail || ev));
          await player.load(src.url, startSeconds);
          onStarted();
        } else if (src.type === "hls"){
          // Prefer native HLS; if not supported, use hls.js
          const video = videoRef.current!;
          if (video.canPlayType("application/vnd.apple.mpegurl")){
            video.src = src.url;
            video.currentTime = startSeconds;
            await video.play().catch(()=>{});
            onStarted();
          } else {
            const { default: Hls } = await import("hls.js");
            if (!(Hls as any).isSupported()) throw new Error("hls_unsupported");
            player = new (Hls as any)({ lowLatencyMode: true, backBufferLength: 30 });
            player.on((Hls as any).Events.ERROR, (_e:any, data:any)=> onError(data));
            player.loadSource(src.url);
            player.attachMedia(video);
            player.on((Hls as any).Events.MANIFEST_PARSED, async ()=>{
              try { video.currentTime = startSeconds; await video.play(); onStarted(); } catch(e){ onError(e); }
            });
          }
        } else {
          // file/mp4 progressive
          const v = videoRef.current!;
          v.src = src.url;
          v.currentTime = startSeconds;
          await v.play().catch(()=>{});
          onStarted();
        }
      }catch(e){ onError(e); }
    }

    boot();
    return () => {
      destroyed = true;
      try{ player?.destroy?.(); }catch{}
    };
  }, [src, startSeconds, onError, onStarted]);

  useEffect(()=>{
    const v = videoRef.current; if (!v) return;
    const ended = ()=> onEnded();
    v.addEventListener("ended", ended);
    return ()=> v.removeEventListener("ended", ended);
  }, [onEnded]);

  return <div className="absolute inset-0">
    {preconnectHost && (
      <link rel="preconnect" href={preconnectHost} crossOrigin="anonymous" />
    )}
    <video
      ref={videoRef}
      className="w-full h-full bg-black"
      playsInline
      autoPlay
      muted
      preload="auto"
      controls={false}
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
    />
  </div>;
}