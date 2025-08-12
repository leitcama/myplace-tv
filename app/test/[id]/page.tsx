"use client";
import Player from "@/components/Player";

export default function TestPage({ params }:{ params:{ id:string } }){
  const id = params.id;
  return (
    <main className="min-h-screen bg-ink text-white px-3 py-6">
      <div className="relative w-full max-w-[1600px] mx-auto">
        <Player videoId={id} startSeconds={0} onAdvance={()=>{}} onSkip={()=>{}}/>
      </div>
    </main>
  );
}