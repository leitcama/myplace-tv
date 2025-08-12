"use client";
import { useMemo, useState } from "react";
import Player from "@/components/Player";

export default function TestPage({ params }:{ params:{ id:string } }){
  const id = params.id;
  const [started, setStarted] = useState(false);
  const sp = useMemo(()=> new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""), []);
  const verbose = sp.get("verbose") === "1";
  const source = sp.get("source") || "auto";
  const makeLink = (q: Record<string,string>) => {
    const s = new URLSearchParams(sp); Object.entries(q).forEach(([k,v])=> s.set(k,v)); return `?${s.toString()}`;
  };
  return (
    <main className="min-h-screen bg-black text-white px-3 py-6 space-y-3">
      <div className="text-xs opacity-70 font-mono">id={id} source={source} verbose={String(verbose)}</div>
      <div className="flex gap-2 text-sm">
        <a className="underline" href={makeLink({ verbose: verbose?"0":"1" })}>toggle verbose</a>
        <a className="underline" href={makeLink({ source: source==="piped"?"auto":"piped" })}>toggle source</a>
      </div>
      <div className="relative w-full max-w-[1600px] mx-auto">
        {!started && (
          <div className="grid place-items-center aspect-video bg-black/80 rounded-xl">
            <button className="glass rounded-2xl px-6 py-4 text-lg font-semibold border border-white/20" onClick={()=>setStarted(true)}>
              ▶ Start Playback
            </button>
          </div>
        )}
        {started && (
          <Player videoId={id} startSeconds={0} onAdvance={()=>{}} onSkip={()=>{}}/>
        )}
      </div>
    </main>
  );
}