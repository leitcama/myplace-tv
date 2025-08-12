export default function MyPlace(){
  return (
    <div className="min-h-screen bg-black text-white grid place-items-center p-6">
      <div className="glass rounded-2xl p-6 max-w-xl w-full text-center">
        <h1 className="text-2xl font-semibold mb-3">My Place Ohio</h1>
        <p className="opacity-80 mb-6">Choose a player:</p>
        <div className="flex items-center justify-center gap-4">
          <a className="underline" href="/">IFrame Player (fallback)</a>
          <a className="underline" href="/myplace-direct">Direct Player (chromeless)</a>
        </div>
      </div>
    </div>
  );
}