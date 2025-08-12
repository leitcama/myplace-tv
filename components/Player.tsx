"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useYouTube } from "@/lib/hooks/useYouTube";
import { useDriftSync } from "@/lib/hooks/useDriftSync";

declare global { interface Window { Hls?: any; } }

export default function Player({ videoId, startSeconds, onAdvance, onSkip }:{
  videoId:string; startSeconds:number; onAdvance:()=>void; onSkip:(code:number)=>void;
}){
  const containerRef = useRef<HTMLDivElement|null>(null);
  const videoRef = useRef<HTMLVideoElement|null>(null);
  const [usingIframe, setUsingIframe] = useState(false);
  const { ready, player, loadById } = useYouTube(containerRef);

  const [variants, setVariants] = useState<Array<{ url:string; itag:number; qualityLabel?:string; bitrate?:number }>>([]);
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const setError = useCallback((code: string, meta?: unknown) => {
    try {
      const m = meta ? ` ${JSON.stringify(meta)}` : "";
      setErr(`${code}${m}`);
      fetch("/api/telemetry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "player_error", message: code, meta }) }).catch(()=>{});
    } catch { setErr(code); }
  }, []);

  const proxify = (u:string) => `/api/stream/proxy?u=${encodeURIComponent(u)}`;

  const chooseVariant = useCallback((list: typeof variants) => {
    if (!list.length) return undefined;
    const sorted = list.slice().sort((a,b)=>(a.bitrate||0)-(b.bitrate||0));
    const mid = sorted[Math.floor(sorted.length/2)] || sorted[0];
    return mid;
  }, []);

  async function ensureHls(): Promise<any>{
    if (typeof window === "undefined") return null;
    if (window.Hls) return window.Hls;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js"; s.async = true;
      s.onload = () => resolve(); s.onerror = () => reject(new Error("hls_cdn_fail"));
      document.head.appendChild(s);
    });
    return window.Hls;
  }

  const fetchVariants = useCallback(async (id:string) => {
    const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const qs = new URLSearchParams();
    qs.set("progressive", "1");
    if (sp.get("source")) qs.set("source", sp.get("source")!);
    if (sp.get("verbose")) qs.set("verbose", sp.get("verbose")!);
    const r = await fetch(`/api/stream/${encodeURIComponent(id)}?${qs.toString()}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`stream_meta_${r.status}`);
    const data = await r.json();
    const list = (data.variants || []) as Array<{ url:string; itag:number; qualityLabel?:string; bitrate?:number }>;
    if (!list.length) throw new Error("no_variants");
    setVariants(list);
    return list;
  }, []);

  const loadHls = useCallback(async (id:string, start:number) => {
    try{
      const el = videoRef.current; if (!el) throw new Error("no_video");
      const list = (variants.length ? variants : await fetchVariants(id));
      const v = chooseVariant(list); if (!v) throw new Error("no_choice");
      const srcForPack = proxify(v.url);
      const masterUrl = `/api/hls/${encodeURIComponent(id)}?kind=master&src=${encodeURIComponent(srcForPack)}`;
      const HlsCtor = await ensureHls();
      if (HlsCtor && HlsCtor.isSupported?.()){
        const hls = new HlsCtor({});
        hls.loadSource(masterUrl);
        hls.attachMedia(el);
        hls.on(HlsCtor.Events.MANIFEST_PARSED, () => { el.currentTime = start; el.play().catch(()=>{}); });
        return true;
      } else if (el.canPlayType("application/vnd.apple.mpegurl")){
        el.src = masterUrl; el.currentTime = start; await el.play(); return true;
      }
      return false;
    } catch(e:any){ setError("hls_fail", { err: String(e?.message||e) }); return false; }
  }, [variants, chooseVariant, fetchVariants, setError]);

  const loadDirect = useCallback(async (id:string, start:number) => {
    try{
      const list = (variants.length ? variants : await fetchVariants(id));
      const v = chooseVariant(list);
      if (!v) throw new Error("no_choice");
      const el = videoRef.current; if (!el) throw new Error("no_video");
      const src = proxify(v.url);
      setCurrentUrl(src);
      el.src = src;
      el.muted = true;
      el.playsInline = true;
      el.currentTime = start;
      await el.play();
      setErr("");
      return true;
    } catch (e:any){
      setError("direct_fail", { id, err: String(e?.message||e) });
      return false;
    }
  }, [variants, chooseVariant, fetchVariants, setError]);

  useDriftSync({ currentId: videoId, getCurrentTime: async ()=> videoRef.current?.currentTime || 0, seekTo: s => { const el=videoRef.current; if (el) el.currentTime = s; } });

  useEffect(()=>{ let cancelled=false; (async()=>{
    setUsingIframe(false);
    setVariants([]);
    setCurrentUrl("");
    const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const preferHls = sp.get("hls") === "1";
    let ok = false;
    if (preferHls) ok = await loadHls(videoId, startSeconds);
    if (!ok) ok = await loadDirect(videoId, startSeconds);
    if (cancelled) return;
    if (!ok){
      setUsingIframe(true);
      if (ready) loadById(videoId, startSeconds);
    }
  })(); return ()=>{ cancelled=true; const el=videoRef.current; if (el) { el.pause(); el.removeAttribute("src"); el.load(); } }; }, [videoId, startSeconds, ready, loadById, loadDirect, loadHls]);

  useEffect(()=>{
    const el = videoRef.current; if (!el) return;
    const onStall = () => {
      if (!variants.length) return;
      const idx = variants.findIndex(v=>proxify(v.url)===currentUrl);
      const next = variants[Math.max(0, idx-1)] || variants[idx];
      if (next){
        const ct = el.currentTime;
        const src = proxify(next.url);
        setCurrentUrl(src);
        el.src = src;
        el.currentTime = ct;
        el.play().catch(()=>{});
      } else {
        setError("stall_no_lower_bitrate");
      }
    };
    const onMediaError = () => {
      const me = (el as any).error;
      setError("media_error", { code: me?.code, ns: el.networkState, rs: el.readyState });
    };
    el.addEventListener("waiting", onStall);
    el.addEventListener("stalled", onStall);
    el.addEventListener("error", onMediaError);
    return ()=>{ el.removeEventListener("waiting", onStall); el.removeEventListener("stalled", onStall); el.removeEventListener("error", onMediaError); };
  }, [variants, currentUrl, setError]);

  useEffect(() => {
    if (!player || !usingIframe) return;
    let started = false;
    const startTimer = setTimeout(() => { if (!started) { setError("iframe_no_start", { id: videoId }); onSkip(599); onAdvance(); } }, 2000);
    function onPlayback(e:any){ if (e.data === (window as any).YT?.PlayerState.PLAYING) started = true; }
    function onStateChange(e:any){ if (e.data === (window as any).YT?.PlayerState.ENDED) onAdvance(); }
    function onError(code:number){ setError("iframe_error", { code }); onSkip(code); onAdvance(); }
    player.addEventListener("onStateChange", onStateChange);
    player.addEventListener("onError", onError);
    player.addEventListener("onStateChange", onPlayback);
    return () => { clearTimeout(startTimer); try {
      player.removeEventListener("onError", onError);
      player.removeEventListener("onStateChange", onStateChange);
      player.removeEventListener("onStateChange", onPlayback);
    } catch {} };
  }, [player, usingIframe, onAdvance, onSkip, videoId, setError]);

  return (
    <div className="relative w-full max-w-[1600px] mx-auto aspect-video bg-black rounded-xl overflow-hidden shadow-screen vignette grain">
      {!usingIframe && (
        <video ref={videoRef} className="absolute inset-0 w-full h-full" playsInline muted controls={false} preload="auto" />
      )}
      {usingIframe && (
        <div ref={containerRef} className="absolute inset-0" />
      )}
      {err && (
        <div className="absolute bottom-2 left-2 z-50 bg-black/80 text-red-300 font-mono text-xs px-2 py-1 rounded select-text" title="Tap to copy" onClick={()=>{ navigator.clipboard?.writeText(err).catch(()=>{}); }}>
          {err}
        </div>
      )}
    </div>
  );
}
