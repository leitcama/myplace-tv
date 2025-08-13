import { NextResponse } from "next/server";
import { runPrefetch, getPrefetchStats, getPrefetchHealth, clearPrefetchCache, DEFAULT_PREFETCH_CONFIG } from "@/lib/prefetch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const stats = getPrefetchStats();
    const health = getPrefetchHealth();
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      health,
      stats,
      config: DEFAULT_PREFETCH_CONFIG,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "prefetch_stats_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const headers = Object.fromEntries(req.headers.entries());
    const currentTime = Date.now();
    
    console.log('🚀 Manual prefetch triggered via API');
    const results = await runPrefetch(currentTime, DEFAULT_PREFETCH_CONFIG, headers);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      success: true,
      results,
      count: results.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "prefetch_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await clearPrefetchCache();
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      success: true,
      message: "Prefetch cache cleared",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "cache_clear_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}