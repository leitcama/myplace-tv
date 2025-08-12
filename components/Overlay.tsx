"use client";
import { useEffect, useRef, useState } from "react";
import { Tv2, Volume2, VolumeX, List, Info } from "lucide-react";

export default function Overlay({
  channel, title, localTime, offset, duration, muted, videoId, onToggleMute, onToggleGuide, onToggleHelp
}:{ channel:string; title:string; localTime:string; offset:number; duration:number; muted:boolean; videoId:string; onToggleMute:()=>void; onToggleGuide:()=>void; onToggleHelp:()=>void; }){
  const [show, setShow] = useState(true); const idle = useRef<number|undefined>();
  useEffect(() => {
    const kick = () => { setShow(true); clearTimeout(idle.current); idle.current = window.setTimeout(()=>setShow(false), 5000); };
    kick(); const mm = () => kick(); const kd = () => kick();
    window.addEventListener("mousemove", mm); window.addEventListener("keydown", kd);
    return () => { window.removeEventListener("mousemove", mm); window.removeEventListener("keydown", kd); };
  }, []);
  const pct = Math.min(100, Math.max(0, (offset / Math.max(1, duration)) * 100));

  return <>
    <div className="absolute top-3 left-3 z-20 glass rounded-md px-2 py-1 text-xs text-white/90 flex items-center gap-1">
      <Tv2 className="w-4 h-4 text-accent"/><span>{channel}</span>
    </div>
    <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener" 
       className="absolute top-3 right-3 z-20 glass rounded-md px-3 py-2 text-xs text-white/90 hover:text-white">
      Watch on YouTube ↗
    </a>
    <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
      <button aria-label={muted?"Unmute":"Mute"} onClick={onToggleMute}
        className="glass rounded-md px-3 py-2 text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent">
        {muted ? <VolumeX className="w-5 h-5"/> : <Volume2 className="w-5 h-5"/>}
      </button>
      <button aria-label="Open guide" onClick={onToggleGuide}
        className="glass rounded-md px-3 py-2 text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent">
        <List className="w-5 h-5"/>
      </button>
      <button aria-label="Help" onClick={onToggleHelp}
        className="glass rounded-md px-3 py-2 text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent">
        <Info className="w-5 h-5"/>
      </button>
    </div>
    {show && (
        <div role="status" className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(96%,1100px)] glass rounded-xl px-5 py-3 text-white/90">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[15px] tracking-wide uppercase text-glow/90 font-medium">{channel}</div>
              <div className="text-xl md:text-2xl font-semibold truncate">{title}</div>
            </div>
            <div className="text-sm whitespace-nowrap opacity-90">{localTime}</div>
          </div>
          <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-accent" style={{width:`${pct}%`}}/>
          </div>
          <div className="mt-1 text-xs opacity-80">{fmt(offset)} / {fmt(duration)}</div>
        </div>
      )}
  </>;
}
const fmt = (s:number)=>{const m=Math.floor(s/60),r=Math.floor(s%60);return `${m}:${`${r}`.padStart(2,"0")}`;}
