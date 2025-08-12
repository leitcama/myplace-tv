"use client";
import { useEffect, useRef, useState } from "react";
declare global { interface Window { YT:any; onYouTubeIframeAPIReady: () => void; } }

export function useYouTube(containerRef: React.RefObject<HTMLDivElement>) {
  const [ready, setReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const playerRef = useRef<any>(null);
  const pendingLoadRef = useRef<{ id:string; start:number }|null>(null);

  useEffect(() => {
    if (window.YT?.Player){ setReady(true); return; }
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s); window.onYouTubeIframeAPIReady = () => setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || playerRef.current) return;
    playerRef.current = new window.YT.Player(containerRef.current, {
      width: "100%", height: "100%",
      host: "https://www.youtube-nocookie.com",
      playerVars: {
        autoplay: 1, playsinline: 1, controls: 0, rel: 0,
        modestbranding: 1, iv_load_policy: 3, disablekb: 1,
        origin: window.location.origin
      },
      events: {
        onReady: () => {
          setPlayerReady(true);
          // If a load was requested before ready, perform it now
          if (pendingLoadRef.current) {
            const { id, start } = pendingLoadRef.current;
            try { playerRef.current?.loadVideoById?.({ videoId:id, startSeconds:start }); } catch {}
            pendingLoadRef.current = null;
          }
        }
      }
    });
    return () => { try { playerRef.current?.destroy?.(); } catch {} };
  }, [ready, containerRef]);

  // If player instance is swapped (should not generally happen), try to fulfill pending load
  useEffect(() => {
    if (playerReady && pendingLoadRef.current) {
      const { id, start } = pendingLoadRef.current;
      try { playerRef.current?.loadVideoById?.({ videoId:id, startSeconds:start }); } catch {}
      pendingLoadRef.current = null;
    }
  }, [playerReady]);

  const seekToDebounced = useRef<NodeJS.Timeout>();
  const seekTo = (s: number) => {
    if (seekToDebounced.current) {
      clearTimeout(seekToDebounced.current);
    }
    seekToDebounced.current = setTimeout(() => {
      playerRef.current?.seekTo?.(s, true);
    }, 100);
  };

  const loadById = (id:string, start:number) => {
    pendingLoadRef.current = { id, start };
    if (playerReady) {
      try { playerRef.current?.loadVideoById?.({ videoId:id, startSeconds:start }); } catch {}
      pendingLoadRef.current = null;
    }
  };

  const setMuted = (muted: boolean) => {
    try { muted ? playerRef.current?.mute?.() : playerRef.current?.unMute?.(); } catch {}
  };

  return {
    ready,
    player: playerRef.current,
    loadById,
    seekTo,
    getCurrentTime: async () => (await playerRef.current?.getCurrentTime?.()) ?? 0,
    mute: () => playerRef.current?.mute?.(), unMute: () => playerRef.current?.unMute?.(),
    setVolume: (v:number) => playerRef.current?.setVolume?.(v),
    setMuted,
  };
}
