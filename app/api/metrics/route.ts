import { NextResponse } from "next/server";
import { getCacheMetrics } from "@/lib/cache";
import { getInvidiousStats } from "@/lib/invidious";
import { getDecipherStats } from "@/lib/decipher";
import { getCanaryStats, getCanaryHealth } from "@/lib/canary";
import { getPrefetchStats, getPrefetchHealth } from "@/lib/prefetch";
import { getExpiryStats, getExpiryHealth } from "@/lib/expiry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const cacheMetrics = getCacheMetrics();
    const invidiousStats = getInvidiousStats();
    const decipherStats = getDecipherStats();
    const canaryStats = getCanaryStats();
    const canaryHealth = getCanaryHealth();
    const prefetchStats = getPrefetchStats();
    const prefetchHealth = getPrefetchHealth();
    const expiryStats = getExpiryStats();
    const expiryHealth = getExpiryHealth();
    
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
      decipher: {
        totalBaseJsHashes: decipherStats.totalBaseJsHashes,
        baseJsHashes: decipherStats.baseJsHashes,
        errorDistribution: decipherStats.errorDistribution,
      },
      canary: {
        health: canaryHealth,
        lastRun: canaryStats.lastRun,
        consecutiveFailures: canaryStats.consecutiveFailures,
        alertHistory: canaryStats.alertHistory,
        baseJsHashFailures: canaryStats.baseJsHashFailures,
      },
      prefetch: {
        health: prefetchHealth,
        activePrefetches: prefetchStats.activePrefetches,
        historyLength: prefetchStats.historyLength,
        successRate: `${prefetchStats.successRate.toFixed(1)}%`,
        recentResults: prefetchStats.recentResults.slice(-5), // Last 5 results
      },
      expiry: {
        health: expiryHealth,
        totalTracked: expiryStats.totalTracked,
        activeIntervals: expiryStats.activeIntervals,
        expiringSoon: expiryStats.expiringSoon,
        refreshAttempts: expiryStats.refreshAttempts,
        averageTimeUntilExpiry: `${Math.round(expiryStats.averageTimeUntilExpiry / 60)}m`,
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