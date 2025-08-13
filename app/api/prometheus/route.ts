import { NextResponse } from "next/server";
import { getCacheMetrics } from "@/lib/cache";
import { getInvidiousStats } from "@/lib/invidious";
import { getDecipherStats } from "@/lib/decipher";
import { getCanaryStats, getCanaryHealth } from "@/lib/canary";
import { getPrefetchStats, getPrefetchHealth } from "@/lib/prefetch";
import { getExpiryStats, getExpiryHealth } from "@/lib/expiry";
import { getErrorStats, getErrorHealth } from "@/lib/error-taxonomy";
import { getRecoveryStats, getRecoveryHealth } from "@/lib/error-recovery";
import { getWatchdogStats, getWatchdogHealth } from "@/lib/enhanced-watchdog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Prometheus metric types
enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

// Prometheus metric
interface PrometheusMetric {
  name: string;
  type: MetricType;
  help: string;
  labels?: Record<string, string>;
  value: number;
  timestamp?: number;
}

// Generate Prometheus metric line
function formatMetric(metric: PrometheusMetric): string {
  const timestamp = metric.timestamp || Date.now();
  let line = `# HELP ${metric.name} ${metric.help}\n`;
  line += `# TYPE ${metric.name} ${metric.type}\n`;
  
  if (metric.labels && Object.keys(metric.labels).length > 0) {
    const labelPairs = Object.entries(metric.labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    line += `${metric.name}{${labelPairs}} ${metric.value} ${timestamp}\n`;
  } else {
    line += `${metric.name} ${metric.value} ${timestamp}\n`;
  }
  
  return line;
}

export async function GET() {
  try {
    const timestamp = Date.now();
    const metrics: PrometheusMetric[] = [];
    
    // Cache metrics
    const cacheMetrics = getCacheMetrics();
    metrics.push(
      {
        name: 'midwest_tv_cache_hits_total',
        type: MetricType.COUNTER,
        help: 'Total number of cache hits',
        value: cacheMetrics.hits,
        timestamp,
      },
      {
        name: 'midwest_tv_cache_misses_total',
        type: MetricType.COUNTER,
        help: 'Total number of cache misses',
        value: cacheMetrics.misses,
        timestamp,
      },
      {
        name: 'midwest_tv_cache_sets_total',
        type: MetricType.COUNTER,
        help: 'Total number of cache sets',
        value: cacheMetrics.sets,
        timestamp,
      },
      {
        name: 'midwest_tv_cache_deletes_total',
        type: MetricType.COUNTER,
        help: 'Total number of cache deletes',
        value: cacheMetrics.deletes,
        timestamp,
      },
      {
        name: 'midwest_tv_cache_hit_rate',
        type: MetricType.GAUGE,
        help: 'Cache hit rate as a percentage',
        value: cacheMetrics.hits + cacheMetrics.misses > 0 
          ? (cacheMetrics.hits / (cacheMetrics.hits + cacheMetrics.misses)) * 100 
          : 0,
        timestamp,
      }
    );
    
    // Invidious metrics
    const invidiousStats = getInvidiousStats();
    metrics.push(
      {
        name: 'midwest_tv_invidious_total_endpoints',
        type: MetricType.GAUGE,
        help: 'Total number of Invidious endpoints',
        value: invidiousStats.totalEndpoints,
        timestamp,
      },
      {
        name: 'midwest_tv_invidious_available_endpoints',
        type: MetricType.GAUGE,
        help: 'Number of available Invidious endpoints',
        value: invidiousStats.availableEndpoints,
        timestamp,
      },
      {
        name: 'midwest_tv_invidious_availability_rate',
        type: MetricType.GAUGE,
        help: 'Invidious endpoint availability rate as a percentage',
        value: invidiousStats.totalEndpoints > 0 
          ? (invidiousStats.availableEndpoints / invidiousStats.totalEndpoints) * 100 
          : 0,
        timestamp,
      }
    );
    
    // Decipher metrics
    const decipherStats = getDecipherStats();
    
    // Calculate total errors and success rate from base.js hashes
    let totalErrors = 0;
    let totalAttempts = 0;
    
    Object.values(decipherStats.baseJsHashes).forEach((hashInfo: any) => {
      totalErrors += hashInfo.failureCount || 0;
      totalAttempts += (hashInfo.successCount || 0) + (hashInfo.failureCount || 0);
    });
    
    const successRate = totalAttempts > 0 ? ((totalAttempts - totalErrors) / totalAttempts) * 100 : 0;
    
    metrics.push(
      {
        name: 'midwest_tv_decipher_total_basejs_hashes',
        type: MetricType.GAUGE,
        help: 'Total number of base.js hashes tracked',
        value: decipherStats.totalBaseJsHashes,
        timestamp,
      },
      {
        name: 'midwest_tv_decipher_total_errors',
        type: MetricType.COUNTER,
        help: 'Total number of decipher errors',
        value: totalErrors,
        timestamp,
      },
      {
        name: 'midwest_tv_decipher_success_rate',
        type: MetricType.GAUGE,
        help: 'Decipher success rate as a percentage',
        value: successRate,
        timestamp,
      }
    );
    
    // Canary metrics
    const canaryStats = getCanaryStats();
    const canaryHealth = getCanaryHealth();
    metrics.push(
      {
        name: 'midwest_tv_canary_consecutive_failures',
        type: MetricType.GAUGE,
        help: 'Number of consecutive canary test failures',
        value: canaryStats.consecutiveFailures,
        timestamp,
      },
      {
        name: 'midwest_tv_canary_health_status',
        type: MetricType.GAUGE,
        help: 'Canary health status (0=healthy, 1=warning, 2=critical)',
        value: canaryHealth === 'healthy' ? 0 : canaryHealth === 'warning' ? 1 : 2,
        timestamp,
      }
    );
    
    // Prefetch metrics
    const prefetchStats = getPrefetchStats();
    const prefetchHealth = getPrefetchHealth();
    metrics.push(
      {
        name: 'midwest_tv_prefetch_total_runs',
        type: MetricType.COUNTER,
        help: 'Total number of prefetch runs',
        value: prefetchStats.historyLength,
        timestamp,
      },
      {
        name: 'midwest_tv_prefetch_success_rate',
        type: MetricType.GAUGE,
        help: 'Prefetch success rate as a percentage',
        value: prefetchStats.successRate,
        timestamp,
      },
      {
        name: 'midwest_tv_prefetch_active_prefetches',
        type: MetricType.GAUGE,
        help: 'Number of active prefetches',
        value: prefetchStats.activePrefetches,
        timestamp,
      },
      {
        name: 'midwest_tv_prefetch_health_status',
        type: MetricType.GAUGE,
        help: 'Prefetch health status (0=healthy, 1=warning, 2=critical)',
        value: prefetchHealth === 'healthy' ? 0 : prefetchHealth === 'warning' ? 1 : 2,
        timestamp,
      }
    );
    
    // Expiry metrics
    const expiryStats = getExpiryStats();
    const expiryHealth = getExpiryHealth();
    metrics.push(
      {
        name: 'midwest_tv_expiry_total_tracked',
        type: MetricType.GAUGE,
        help: 'Total number of tracked expiry states',
        value: expiryStats.totalTracked,
        timestamp,
      },
      {
        name: 'midwest_tv_expiry_active_intervals',
        type: MetricType.GAUGE,
        help: 'Number of active expiry monitoring intervals',
        value: expiryStats.activeIntervals,
        timestamp,
      },
      {
        name: 'midwest_tv_expiry_expiring_soon',
        type: MetricType.GAUGE,
        help: 'Number of manifests expiring soon',
        value: expiryStats.expiringSoon,
        timestamp,
      },
      {
        name: 'midwest_tv_expiry_refresh_attempts',
        type: MetricType.COUNTER,
        help: 'Total number of refresh attempts',
        value: expiryStats.refreshAttempts,
        timestamp,
      },
      {
        name: 'midwest_tv_expiry_average_time_until_expiry',
        type: MetricType.GAUGE,
        help: 'Average time until expiry in seconds',
        value: expiryStats.averageTimeUntilExpiry,
        timestamp,
      },
      {
        name: 'midwest_tv_expiry_health_status',
        type: MetricType.GAUGE,
        help: 'Expiry health status (0=healthy, 1=warning, 2=critical)',
        value: expiryHealth === 'healthy' ? 0 : expiryHealth === 'warning' ? 1 : 2,
        timestamp,
      }
    );
    
    // Error metrics
    const errorStats = getErrorStats();
    const errorHealth = getErrorHealth();
    metrics.push(
      {
        name: 'midwest_tv_errors_total',
        type: MetricType.COUNTER,
        help: 'Total number of errors tracked',
        value: errorStats.totalErrors,
        timestamp,
      },
      {
        name: 'midwest_tv_errors_total_recoveries',
        type: MetricType.COUNTER,
        help: 'Total number of error recoveries',
        value: errorStats.totalRecoveries,
        timestamp,
      },
      {
        name: 'midwest_tv_errors_health_status',
        type: MetricType.GAUGE,
        help: 'Error health status (0=healthy, 1=warning, 2=critical)',
        value: errorHealth === 'healthy' ? 0 : errorHealth === 'warning' ? 1 : 2,
        timestamp,
      }
    );
    
    // Add error counts by type
    Object.entries(errorStats.errorCounts).forEach(([errorType, count]) => {
      metrics.push({
        name: 'midwest_tv_errors_by_type_total',
        type: MetricType.COUNTER,
        help: 'Total number of errors by type',
        labels: { error_type: errorType },
        value: count,
        timestamp,
      });
    });
    
    // Add error distribution by severity
    Object.entries(errorStats.errorDistribution).forEach(([severity, count]) => {
      metrics.push({
        name: 'midwest_tv_errors_by_severity_total',
        type: MetricType.COUNTER,
        help: 'Total number of errors by severity',
        labels: { severity },
        value: count,
        timestamp,
      });
    });
    
    // Recovery metrics
    const recoveryStats = getRecoveryStats();
    const recoveryHealth = getRecoveryHealth();
    metrics.push(
      {
        name: 'midwest_tv_recovery_total',
        type: MetricType.COUNTER,
        help: 'Total number of recovery attempts',
        value: recoveryStats.totalRecoveries,
        timestamp,
      },
      {
        name: 'midwest_tv_recovery_successful',
        type: MetricType.COUNTER,
        help: 'Total number of successful recoveries',
        value: recoveryStats.successfulRecoveries,
        timestamp,
      },
      {
        name: 'midwest_tv_recovery_success_rate',
        type: MetricType.GAUGE,
        help: 'Recovery success rate as a percentage',
        value: recoveryStats.recoverySuccessRate,
        timestamp,
      },
      {
        name: 'midwest_tv_recovery_active',
        type: MetricType.GAUGE,
        help: 'Number of active recoveries',
        value: recoveryStats.activeRecoveries,
        timestamp,
      },
      {
        name: 'midwest_tv_recovery_health_status',
        type: MetricType.GAUGE,
        help: 'Recovery health status (0=healthy, 1=warning, 2=critical)',
        value: recoveryHealth === 'healthy' ? 0 : recoveryHealth === 'warning' ? 1 : 2,
        timestamp,
      }
    );
    
    // Watchdog metrics
    const watchdogStats = getWatchdogStats();
    const watchdogHealth = getWatchdogHealth();
    metrics.push(
      {
        name: 'midwest_tv_watchdog_total_videos',
        type: MetricType.GAUGE,
        help: 'Total number of videos being monitored',
        value: watchdogStats.totalVideos,
        timestamp,
      },
      {
        name: 'midwest_tv_watchdog_healthy_videos',
        type: MetricType.GAUGE,
        help: 'Number of healthy videos',
        value: watchdogStats.healthyVideos,
        timestamp,
      },
      {
        name: 'midwest_tv_watchdog_stalled_videos',
        type: MetricType.GAUGE,
        help: 'Number of stalled videos',
        value: watchdogStats.stalledVideos,
        timestamp,
      },
      {
        name: 'midwest_tv_watchdog_total_stalls',
        type: MetricType.COUNTER,
        help: 'Total number of stalls detected',
        value: watchdogStats.totalStalls,
        timestamp,
      },
      {
        name: 'midwest_tv_watchdog_total_errors',
        type: MetricType.COUNTER,
        help: 'Total number of errors detected',
        value: watchdogStats.totalErrors,
        timestamp,
      },
      {
        name: 'midwest_tv_watchdog_total_recoveries',
        type: MetricType.COUNTER,
        help: 'Total number of recoveries triggered',
        value: watchdogStats.totalRecoveries,
        timestamp,
      },
      {
        name: 'midwest_tv_watchdog_average_recovery_attempts',
        type: MetricType.GAUGE,
        help: 'Average number of recovery attempts per video',
        value: watchdogStats.averageRecoveryAttempts,
        timestamp,
      },
      {
        name: 'midwest_tv_watchdog_health_status',
        type: MetricType.GAUGE,
        help: 'Watchdog health status (0=healthy, 1=warning, 2=critical)',
        value: watchdogHealth === 'healthy' ? 0 : watchdogHealth === 'warning' ? 1 : 2,
        timestamp,
      }
    );
    
    // System metrics
    const systemUptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    metrics.push(
      {
        name: 'midwest_tv_system_uptime_seconds',
        type: MetricType.GAUGE,
        help: 'System uptime in seconds',
        value: systemUptime,
        timestamp,
      },
      {
        name: 'midwest_tv_system_memory_rss_bytes',
        type: MetricType.GAUGE,
        help: 'Resident Set Size memory usage in bytes',
        value: memoryUsage.rss,
        timestamp,
      },
      {
        name: 'midwest_tv_system_memory_heap_used_bytes',
        type: MetricType.GAUGE,
        help: 'Heap memory used in bytes',
        value: memoryUsage.heapUsed,
        timestamp,
      },
      {
        name: 'midwest_tv_system_memory_heap_total_bytes',
        type: MetricType.GAUGE,
        help: 'Total heap memory in bytes',
        value: memoryUsage.heapTotal,
        timestamp,
      },
      {
        name: 'midwest_tv_system_memory_external_bytes',
        type: MetricType.GAUGE,
        help: 'External memory usage in bytes',
        value: memoryUsage.external,
        timestamp,
      }
    );
    
    // Build Prometheus format response
    const prometheusResponse = metrics.map(formatMetric).join('');
    
    return new NextResponse(prometheusResponse, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
    
  } catch (error: any) {
    console.error('Prometheus metrics error:', error);
    return NextResponse.json(
      { error: "prometheus_metrics_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}