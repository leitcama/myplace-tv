"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Player from "@/components/Player";
import Overlay from "@/components/Overlay";
import GuideModal from "@/components/GuideModal";
import cfg from "@/public/channel.json";
import type { ChannelConfig } from "@/lib/schedule/types";
import { positionAt, resolveVideoId, nextN } from "@/lib/schedule/now";
import { usePrefetch, useSeamlessTransitions } from "@/lib/hooks/usePrefetch";

export default function Page(){
  const config = cfg as unknown as ChannelConfig;
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("mute")==="1";
    }
    return false;
  });
  const [consented, setConsented] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("play_ok")==="1";
    }
    return false;
  });
  const [showGuide, setShowGuide] = useState(false);
  const [tick, setTick] = useState(0);
  const [serverTime, setServerTime] = useState<string>("");

  useEffect(()=>{ const id=setInterval(()=>setTick(t=>t+1),1000); return ()=>clearInterval(id); },[]);

  // Fetch server time for authoritative sync
  useEffect(() => {
    const fetchServerTime = async () => {
      try {
        const response = await fetch("/api/now", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          setServerTime(data.serverTime);
        }
      } catch (error) {
        console.warn("Failed to fetch server time:", error);
      }
    };
    fetchServerTime();
  }, []);

  // Apply mute to the underlying <video>
  useEffect(() => {
    const el = document.querySelector("video");
    if (el) el.muted = muted;
  }, [muted]);

  useEffect(()=>{
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "g") setShowGuide(v=>!v);
      if (e.key.toLowerCase() === "m") {
        const v = !muted; setMuted(v); if (typeof window !== "undefined") localStorage.setItem("mute", v?"1":"0");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [muted]);

  const now = useMemo(() => {
    const pos = positionAt(new Date(), config.epochStart, config.items);
    const item = config.items[pos.index];
    return { title:item.title, duration:item.duration, offset:pos.offset, videoId:resolveVideoId(config,item), index:pos.index };
  }, [config, tick]);

  // Prefetch and seamless transition hooks
  const { startPrefetch, stopPrefetch, manualPrefetch } = usePrefetch();
  const { startTransition, endTransition } = useSeamlessTransitions();

  // Start prefetching when consented
  useEffect(() => {
    if (consented) {
      startPrefetch();
    } else {
      stopPrefetch();
    }
  }, [consented, startPrefetch, stopPrefetch]);

  // Track transitions when video changes
  useEffect(() => {
    if (consented) {
      startTransition();
    }
  }, [now.videoId, consented, startTransition]);

  const advance = useCallback(() => {
    endTransition(now.videoId);
    setTick(t=>t+1);
  }, [now.videoId, endTransition]);
  
  const onSkip = useCallback((code:number) => {
    endTransition(now.videoId);
    console.log(JSON.stringify({ ts:new Date().toISOString(), code, reason:"yt_error", id: now.videoId }));
  }, [now.videoId, endTransition]);

  return (
    <main className="min-h-screen bg-ink text-white px-3 py-6">
      {!consented && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70">
          <button onClick={()=>{ 
            setConsented(true); 
            if (typeof window !== "undefined") {
              localStorage.setItem("play_ok","1"); 
            }
          }}
                  className="glass rounded-2xl px-6 py-4 text-lg font-semibold hover:scale-[1.02] transition">
            ▶ Play Channel
          </button>
        </div>
      )}

      <div className="relative w-full max-w-[1600px] mx-auto">
        <Player videoId={now.videoId} startSeconds={now.offset} onAdvance={advance} onSkip={onSkip}/>
        <Overlay
          channel={config.channel}
          title={now.title}
          localTime={new Date().toLocaleTimeString()}
          offset={now.offset}
          duration={now.duration}
          muted={muted}
          videoId={now.videoId}
          onToggleMute={()=>{ 
            const v=!muted; 
            setMuted(v); 
            if (typeof window !== "undefined") {
              localStorage.setItem("mute", v?"1":"0"); 
            }
          }}
          onToggleGuide={()=>setShowGuide(true)}
          onToggleHelp={()=>alert("Shortcuts: G=Guide, M=Mute")}
        />
      </div>

      <GuideModal open={showGuide} onClose={()=>setShowGuide(false)} items={nextN(config, new Date(), 36)} />
    </main>
  );
}
