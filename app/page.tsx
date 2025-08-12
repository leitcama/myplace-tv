"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Player from "@/components/Player";
import Overlay from "@/components/Overlay";
import GuideModal from "@/components/GuideModal";
import cfg from "@/public/channel.json";
import type { ChannelConfig } from "@/lib/schedule/types";
import { positionAt, resolveVideoId, nextN } from "@/lib/schedule/now";
import { nextIndex } from "@/lib/schedule/now";

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
  const [badIds, setBadIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem("bad_ids");
        if (raw) return new Set(JSON.parse(raw));
      } catch {}
    }
    return new Set();
  });

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

  const now = useMemo(() => {
    const pos = positionAt(new Date(), config.epochStart, config.items);
    // Choose the first playable item, skipping any known-bad YouTube IDs
    let idx = pos.index;
    let offset = pos.offset;
    for (let attempts = 0; attempts < config.items.length; attempts++) {
      const item = config.items[idx];
      const vid = resolveVideoId(config, item);
      if (!badIds.has(vid)) {
        return { title:item.title, duration:item.duration, offset, videoId:vid, index:idx };
      }
      idx = nextIndex(idx, config.items);
      offset = 0; // when skipping to a later program, start at its beginning
    }
    // Fallback: original item
    const fallback = config.items[pos.index];
    return { title:fallback.title, duration:fallback.duration, offset:pos.offset, videoId:resolveVideoId(config, fallback), index:pos.index };
  }, [config, tick, badIds]);

  const advance = useCallback(() => setTick(t=>t+1), []);
  const onSkip = useCallback((code:number) => {
    try { console.log(JSON.stringify({ ts:new Date().toISOString(), code, reason:"yt_error", id: now.videoId })); } catch {}
    setBadIds(prev => {
      const next = new Set(prev);
      next.add(now.videoId);
      try { sessionStorage.setItem("bad_ids", JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }, [now.videoId]);

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
        <Player videoId={now.videoId} startSeconds={now.offset} muted={muted} onAdvance={advance} onSkip={onSkip}/>
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
