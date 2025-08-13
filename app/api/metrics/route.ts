import { NextResponse } from "next/server";
import { getCacheMetrics } from "@/lib/cache";
import { getInvidiousStats } from "@/lib/invidious";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const cacheMetrics = getCacheMetrics();
    const invidiousStats = getInvidiousStats();
    
    const hitRate = cacheMetrics.hits + cacheMetrics.misses > 0 
      ? (cacheMetrics.hits / (cacheMetrics.hits + cacheMetrics.misses) * 100).toFixed(2)
      : '0.00';

    const metrics = {
      timestamp: new Date().toISOString(),
      cache: {
        hits: cacheMetrics.hits,
        misses: cacheMetrics.misses,
        sets: cacheMetrics.sets,
        deletes: cacheMetrics.deletes,
        hitRate: `${hitRate}%`,
      },
      invidious: {
        totalEndpoints: invidiousStats.totalEndpoints,
        availableEndpoints: invidiousStats.availableEndpoints,
        availabilityRate: `${((invidiousStats.availableEndpoints / invidiousStats.totalEndpoints) * 100).toFixed(1)}%`,
        endpointStates: invidiousStats.endpointStates,
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
      },
    };

    return NextResponse.json(metrics);
  } catch (error: any) {
    return NextResponse.json(
      { error: "metrics_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}