"use client";
export default function GuideModal({ open, onClose, items }:{
  open:boolean; onClose:()=>void; items: Array<{ title:string; kind:string; duration:number; etaISO:string }>;
}){
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/60" onClick={onClose}/>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(96%,900px)] glass rounded-2xl p-6 text-white/90">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Program Guide (next 90 min)</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white focus:ring-2 focus:ring-accent rounded px-3 py-1">Close</button>
        </div>
        <div className="max-h-[60vh] overflow-auto divide-y divide-white/10">
          {items.map((it, i) => (
            <div key={i} className="py-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm uppercase opacity-70">{it.kind === "bump" ? "IDENT" : "Video"}</div>
                <div className="font-medium truncate">{it.title}</div>
              </div>
              <div className="text-sm opacity-80 whitespace-nowrap">
                {new Date(it.etaISO).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs opacity-70">View-only channel. Clicking items does not seek.</p>
      </div>
    </div>
  );
}
