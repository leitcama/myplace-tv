"use client";
import { useCallback, useEffect, useRef, useState } from "react";

declare global { interface Window { YT?: any } }

export function useYouTube(mountRef: React.MutableRefObject<HTMLDivElement|null>){
  const [ready, setReady] = useState(false);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    function onYouTubeIframeAPIReady(){ if (cancelled) return; setReady(true); }
    if (!window.YT || !window.YT.Player){
      const tag = document.createElement("script"); tag.src = "https://www.youtube.com/iframe_api"; document.body.appendChild(tag);
      (window as any).onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
    } else { setReady(true); }
    return () => { cancelled = true; };
  }, []);

  const ensurePlayer = useCallback(() => {
    const el = mountRef.current; if (!el) return null;
    if (playerRef.current) return playerRef.current;
    playerRef.current = new window.YT.Player(el, {
      width: "100%", height: "100%",
      playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, playsinline: 1 },
      events: {}
    });
    return playerRef.current;
  }, [mountRef]);

  const loadById = useCallback((id: string, startSeconds = 0) => {
    const p = ensurePlayer(); if (!p) return;
    p.loadVideoById({ videoId: id, startSeconds });
  }, [ensurePlayer]);

  const getCurrentTime = useCallback((): number => {
    const p = playerRef.current; return p ? p.getCurrentTime?.() ?? 0 : 0;
  }, []);

  const seekTo = useCallback((s: number) => {
    const p = playerRef.current; if (p) p.seekTo?.(s, true);
  }, []);

  return { ready, player: playerRef.current, loadById, getCurrentTime, seekTo };
}
