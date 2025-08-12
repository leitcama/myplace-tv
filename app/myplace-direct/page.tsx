"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChannelConfig } from "@/lib/schedule/types";
import { nextIndex, positionAt, resolveVideoId, nextN } from "@/lib/schedule/now";
import Overlay from "@/components/Overlay";
import GuideModal from "@/components/GuideModal";
import { useDriftSync } from "@/lib/hooks/useDriftSync";

function useChannelConfig(){
  const [cfg, setCfg] = useState<ChannelConfig|null>(null);
  useEffect(() => {
    fetch("/myplace-channel.json", { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setCfg)
      .catch(() => fetch("/channel.json").then(r => r.json()).then(setCfg).catch(()=>setCfg(null)));
  }, []);
  return cfg;
}

export default function MyPlaceDirect(){
  const cfg = useChannelConfig();
  const [guideOpen, setGuideOpen] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem("mpo_muted") !== "0"; } catch { return true; }
  });

  const [state, setState] = useState<{ index:number; offset:number }>({ index:0, offset:0 });
  const [useIframeFor, setUseIframeFor] = useState<Set<string>>(new Set());
  const [currentId, setCurrentId] = useState<string>("");
  const [tick, setTick] = useState(0);
  const videoRef = useRef<HTMLVideoElement|null>(null);

  // compute schedule position on load
  useEffect(() => {
    if (!cfg) return;
    const pos = positionAt(new Date(), cfg.epochStart, cfg.items);
    setState(pos);
    const id = resolveVideoId(cfg, cfg.items[pos.index]);
    setCurrentId(id);
  }, [cfg]);

  // wall clock tick to maintain deterministic schedule and progress
  useEffect(() => {
    if (!cfg) return;
    const id = setInterval(() => setTick(t=>t+1), 1000);
    return () => clearInterval(id);
  }, [cfg]);

  // update index/offset by wall clock; switch items deterministically
  useEffect(() => {
    if (!cfg) return;
    const pos = positionAt(new Date(), cfg.epochStart, cfg.items);
    setState(pos);
    const idNext = resolveVideoId(cfg, cfg.items[pos.index]);
    if (idNext !== currentId) setCurrentId(idNext);
  }, [tick, cfg]);

  // Persist mute state
  useEffect(() => { try { localStorage.setItem("mpo_muted", muted ? "1" : "0"); } catch {} }, [muted]);

  const attempts = useRef(0);
  // Load direct video when id/offset changes unless we marked this id as iframe-only
  useEffect(() => {
    const v = videoRef.current; if (!v || !cfg || !currentId) return;
    if (useIframeFor.has(currentId)) return;

    const pos = positionAt(new Date(), cfg.epochStart, cfg.items);
    const desiredOffset = pos.offset;

    let cancelled = false;
    (async () => {
      try {
        v.src = `/api/stream/${currentId}`;
        v.muted = muted;
        v.autoplay = true;
        await v.play().catch(()=>undefined);
        const onLoaded = () => {
          try { v.currentTime = desiredOffset; } catch {}
        };
        v.addEventListener("loadedmetadata", onLoaded, { once: true });
      } catch (e){
        // mark for iframe fallback on failure
        setUseIframeFor(prev => new Set(prev).add(currentId));
      }
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [cfg, currentId, muted, useIframeFor]);

  // Drift sync with server now API
  useDriftSync({
    currentId,
    getCurrentTime: async () => videoRef.current ? videoRef.current.currentTime : 0,
    seekTo: (s:number) => { const v = videoRef.current; if (v) { try { v.currentTime = s; } catch {} } },
    thresholdSec: 10,
    intervalMs: 10 * 60 * 1000,
  });

  // Detect playback error and mark this id for iframe fallback; do not alter schedule (it is wall-clock based)
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onError = () => {
      if (currentId) setUseIframeFor(prev => new Set(prev).add(currentId));
      console.error(JSON.stringify({ ts: new Date().toISOString(), id: currentId, reason: "play_reject" }));
    };
    v.addEventListener("error", onError);
    return () => { v.removeEventListener("error", onError); };
  }, [currentId]);

  const guide = useMemo(() => cfg ? nextN(cfg, new Date(), 36) : [], [cfg]);

  if (!cfg || !currentId) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>;
  const item = cfg.items[state.index];
  const id = currentId;
  const offset = state.offset;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center py-6">
      <div className="relative w-full max-w-[1600px] mx-auto aspect-video bg-black rounded-xl overflow-hidden shadow-screen vignette grain">
        {!useIframeFor.has(id) ? (
          <video ref={videoRef} playsInline muted={muted} controls={false} className="absolute inset-0 w-full h-full object-contain bg-black" />
        ) : (
          <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${id}?autoplay=1&controls=0&modestbranding=1&rel=0&playsinline=1&start=${offset}`} allow="autoplay; encrypted-media" allowFullScreen/>
        )}
        <Overlay
          channel={cfg.channel}
          title={item.title}
          localTime={new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}
          offset={offset}
          duration={item.duration}
          muted={muted}
          videoId={id}
          onToggleMute={() => setMuted(m => !m)}
          onToggleGuide={() => setGuideOpen(true)}
          onToggleHelp={() => alert("Press Unmute to hear audio. The channel is deterministic by wall clock and may drift-correct periodically.")}
        />
      </div>
      <GuideModal open={!!guideOpen} onClose={() => setGuideOpen(false)} items={guide} />
    </div>
  );
}