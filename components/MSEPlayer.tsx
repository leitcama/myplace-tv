"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ResolveResponse } from "@/types/resolver";

export default function MSEPlayer({ videoId, startSeconds, onStarted, onEnded, onError, onResolveComplete, onPlayerBootStart }:{
  videoId: string;
  startSeconds: number;
  onStarted: () => void;
  onEnded: () => void;
  onError: (err: any) => void;
  onResolveComplete?: () => void;
  onPlayerBootStart?: () => void;
}){
  const videoRef = useRef<HTMLVideoElement|null>(null);
  const [src, setSrc] = useState<ResolveResponse|null>(null);
  const [resolveError, setResolveError] = useState<string|null>(null);

  // Preconnect hint host
  const preconnectHost = useMemo(() => {
    try{ if (!src?.url) return null; return new URL(src.url).origin; } catch{return null}
  }, [src?.url]);

  useEffect(()=>{
    let cancelled = false;
    async function resolve(){
      try{
        setResolveError(null);
        const startTime = performance.now();
        
        const r = await fetch(`/api/video/playback/resolve?videoId=${encodeURIComponent(videoId)}`, { 
          cache: "no-store" 
        });
        
        if (!r.ok) {
          const errorData = await r.json().catch(() => ({}));
          throw new Error(`resolve_failed_${r.status}: ${errorData.error?.message || 'Unknown error'}`);
        }
        
        const j: ResolveResponse = await r.json();
        if (cancelled) return;
        
        if (j?.type && j?.url) {
          setSrc(j);
          // Log resolve performance
          const resolveTime = performance.now() - startTime;
          console.log(`Resolve completed in ${resolveTime.toFixed(1)}ms`, {
            videoId,
            tier: j.tier,
            type: j.type,
            correlationId: j.correlationId,
          });
          // Track resolve completion
          onResolveComplete?.();
        } else {
          throw new Error("no_source");
        }
      }catch(e){ 
        setResolveError(e instanceof Error ? e.message : String(e));
        onError(e); 
      }
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
        const startTime = performance.now();
        // Track player boot start
        onPlayerBootStart?.();
        
        if (src.type === "dash"){
          const { default: shaka } = await import("shaka-player/dist/shaka-player.ui.js");
          if (destroyed) return;
          if (!shaka.Player.isBrowserSupported()) throw new Error("shaka_unsupported");
          player = new shaka.Player(videoRef.current);
          
          // Enhanced Shaka config for optimal ABR performance and fast startup
          player.configure({
            streaming: { 
              bufferingGoal: 8, // 8 seconds of content
              rebufferingGoal: 2, // 2 seconds for rebuffering
              jumpLargeGaps: true, // Skip large gaps in content
              retryParameters: {
                maxAttempts: 3,
                baseDelay: 1000,
                backoffFactor: 2,
                fuzzFactor: 0.5,
              },
              // Enhanced buffer management
              bufferBehind: 30, // Keep 30 seconds behind current time
              bufferAhead: 10, // Buffer 10 seconds ahead
              lowLatencyMode: false, // Disable for TV-like experience
            },
            abr: { 
              defaultBandwidthEstimate: 1_500_000, // Reduced to 1.5 Mbps for faster startup
              enabled: true, 
              switchInterval: 1.0, // Faster quality switching
              bandwidthUpdateInterval: 0.5,
              // Enhanced ABR settings
              useNetworkInformation: true,
              restrictions: {
                minBandwidth: 500_000, // 500 Kbps minimum
                maxBandwidth: 10_000_000, // 10 Mbps maximum
              },
            },
            manifest: {
              retryParameters: {
                maxAttempts: 3,
                baseDelay: 1000,
                backoffFactor: 2,
                fuzzFactor: 0.5,
              },
              dash: {
                defaultTimeOffset: 0,
                ignoreMinBufferTime: false,
                autoCorrectDrift: true,
              },
            },
            // Enhanced drm settings
            drm: {
              retryParameters: {
                maxAttempts: 3,
                baseDelay: 1000,
                backoffFactor: 2,
                fuzzFactor: 0.5,
              },
            },
          });
          
          player.addEventListener("error", (ev:any)=> {
            console.error("Shaka error:", ev?.detail || ev);
            onError(ev?.detail || ev);
          });
          
          await player.load(src.url, startSeconds);
          const loadTime = performance.now() - startTime;
          console.log(`Shaka loaded in ${loadTime.toFixed(1)}ms`, { videoId, tier: src.tier });
          onStarted();
          
        } else if (src.type === "hls"){
          // Prefer native HLS; if not supported, use hls.js
          const video = videoRef.current!;
          if (video.canPlayType("application/vnd.apple.mpegurl")){
            video.src = src.url;
            video.currentTime = startSeconds;
            await video.play().catch(()=>{});
            const loadTime = performance.now() - startTime;
            console.log(`Native HLS loaded in ${loadTime.toFixed(1)}ms`, { videoId, tier: src.tier });
            onStarted();
          } else {
            const { default: Hls } = await import("hls.js");
            if (!(Hls as any).isSupported()) throw new Error("hls_unsupported");
            
            // Enhanced hls.js config for optimal ABR performance
            player = new (Hls as any)({ 
              lowLatencyMode: false, // Disable for TV-like experience
              backBufferLength: 30, // Keep 30 seconds in back buffer
              maxBufferLength: 8, // Reduced for faster startup
              maxMaxBufferLength: 10, // Conservative max buffer
              startLevel: 0, // Start at lowest quality for faster startup
              capLevelToPlayerSize: true, // Cap quality to player size
              abrEwmaDefaultEstimate: 1_500_000, // Reduced initial bandwidth estimate
              abrBandWidthFactor: 0.95, // Conservative bandwidth factor
              abrBandWidthUpFactor: 0.7, // Conservative up factor
              abrMaxWithRealBitrate: true, // Use real bitrate for ABR
              // Enhanced ABR settings
              abrEwmaFastLive: 3.0, // Fast adaptation for live content
              abrEwmaSlowLive: 9.0, // Slow adaptation for live content
              abrEwmaFastVoD: 3.0, // Fast adaptation for VOD
              abrEwmaSlowVoD: 9.0, // Slow adaptation for VOD
              // Enhanced buffer settings
              maxBufferHole: 0.5, // Max buffer hole in seconds
              maxStarvationDelay: 4, // Max starvation delay
              maxLoadingDelay: 4, // Max loading delay
              // Enhanced fragment loading
              fragLoadingTimeOut: 20000, // 20 second timeout
              manifestLoadingTimeOut: 10000, // 10 second timeout
              levelLoadingTimeOut: 10000, // 10 second timeout
            });
            
            player.on((Hls as any).Events.ERROR, (_e:any, data:any)=> {
              console.error("HLS.js error:", data);
              onError(data);
            });
            
            player.loadSource(src.url);
            player.attachMedia(video);
            player.on((Hls as any).Events.MANIFEST_PARSED, async ()=>{
              try { 
                video.currentTime = startSeconds; 
                await video.play(); 
                const loadTime = performance.now() - startTime;
                console.log(`HLS.js loaded in ${loadTime.toFixed(1)}ms`, { videoId, tier: src.tier });
                onStarted(); 
              } catch(e){ onError(e); }
            });
          }
        } else {
          // file/mp4 progressive
          const v = videoRef.current!;
          v.src = src.url;
          v.currentTime = startSeconds;
          await v.play().catch(()=>{});
          const loadTime = performance.now() - startTime;
          console.log(`Progressive MP4 loaded in ${loadTime.toFixed(1)}ms`, { videoId, tier: src.tier });
          onStarted();
        }
      }catch(e){ 
        console.error("Player boot error:", e);
        onError(e); 
      }
    }

    boot();
    return () => {
      destroyed = true;
      try{ player?.destroy?.(); }catch{}
    };
  }, [src, startSeconds, onError, onStarted, videoId]);

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