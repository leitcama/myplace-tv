"use client";
import { useState } from "react";
import Player from "@/components/Player";

export default function TestPage({ params }:{ params:{ id:string } }){
  const id = params.id;
  const [started, setStarted] = useState(false);
  return (
    <main className="min-h-screen bg-black text-white px-3 py-6">
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