'use client';

import { useState, useEffect } from 'react';

interface SLOData {
  timestamp: string;
  ttff?: {
    count: number;
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  };
  startup?: {
    total: number;
    ttff: {
      p50: number;
      p95: number;
      avg: number;
    };
    resolveTime: {
      p50: number;
      p95: number;
      avg: number;
    };
  };
  errors?: {
    total: number;
    successRate: string;
  };
  recovery?: {
    total: number;
    successRate: string;
    averageDuration: number;
  };
  synthetic?: {
    total: number;
    recent: number;
    averageSuccessRate: string;
    averageTTFF: number;
    averageDuration: number;
  };
}

interface HealthStatus {
  cache: string;
  invidious: string;
  decipher: string;
  canary: string;
  prefetch: string;
  expiry: string;
  errors: string;
  recovery: string;
  watchdog: string;
  synthetic: string;
}

export default function SLODashboard() {
  const [sloData, setSloData] = useState<SLOData | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch telemetry data
        const telemetryRes = await fetch('/api/telemetry');
        const telemetryData = await telemetryRes.json();
        
        // Fetch metrics data
        const metricsRes = await fetch('/api/metrics');
        const metricsData = await metricsRes.json();
        
        setSloData(telemetryData);
        
        // Extract health status from metrics
        setHealthStatus({
          cache: 'healthy', // Cache is always healthy in this implementation
          invidious: metricsData.invidious?.availabilityRate === '100.0%' ? 'healthy' : 'warning',
          decipher: metricsData.decipher?.totalBaseJsHashes > 0 ? 'healthy' : 'warning',
          canary: metricsData.canary?.health || 'healthy',
          prefetch: metricsData.prefetch?.health || 'healthy',
          expiry: metricsData.expiry?.health || 'healthy',
          errors: metricsData.errors?.health || 'healthy',
          recovery: metricsData.recovery?.health || 'healthy',
          watchdog: metricsData.watchdog?.health || 'healthy',
          synthetic: metricsData.synthetic?.health || 'healthy',
        });
        
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '❌';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error loading SLO dashboard: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">SLO Dashboard</h1>
        
        {/* Health Status Overview */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">System Health</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {healthStatus && Object.entries(healthStatus).map(([system, status]) => (
              <div
                key={system}
                className={`p-4 rounded-lg border ${getHealthColor(status)}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">
                    {system}
                  </span>
                  <span className="text-lg">{getHealthIcon(status)}</span>
                </div>
                <div className="mt-2 text-xs capitalize">
                  {status}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* TTFF Metrics */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Time to First Frame (TTFF)</h3>
            {sloData?.ttff ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">P50</div>
                    <div className="text-2xl font-bold text-blue-600">{sloData.ttff.p50}ms</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">P95</div>
                    <div className="text-2xl font-bold text-blue-600">{sloData.ttff.p95}ms</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">P99</div>
                    <div className="text-xl font-semibold text-blue-600">{sloData.ttff.p99}ms</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Average</div>
                    <div className="text-xl font-semibold text-blue-600">{sloData.ttff.avg}ms</div>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <div className="text-sm text-gray-600">Total Measurements</div>
                  <div className="text-lg font-semibold text-gray-800">{sloData.ttff.count}</div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No TTFF data available</div>
            )}
          </div>

          {/* Startup Metrics */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Startup Performance</h3>
            {sloData?.startup ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-600">Resolve Time (P95)</div>
                  <div className="text-xl font-semibold text-green-600">{sloData.startup.resolveTime.p95}ms</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Player Boot Time (P95)</div>
                  <div className="text-xl font-semibold text-green-600">{sloData.startup.ttff.p95}ms</div>
                </div>
                <div className="pt-2 border-t">
                  <div className="text-sm text-gray-600">Total Startup Events</div>
                  <div className="text-lg font-semibold text-gray-800">{sloData.startup.total}</div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No startup data available</div>
            )}
          </div>

          {/* Error & Recovery Metrics */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Error & Recovery</h3>
            <div className="space-y-4">
              {sloData?.errors && (
                <div>
                  <div className="text-sm text-gray-600">Error Success Rate</div>
                  <div className="text-xl font-semibold text-orange-600">{sloData.errors.successRate}</div>
                  <div className="text-xs text-gray-500">Total: {sloData.errors.total}</div>
                </div>
              )}
              {sloData?.recovery && (
                <div>
                  <div className="text-sm text-gray-600">Recovery Success Rate</div>
                  <div className="text-xl font-semibold text-purple-600">{sloData.recovery.successRate}</div>
                  <div className="text-xs text-gray-500">
                    Avg Duration: {sloData.recovery.averageDuration}ms
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Synthetic Monitoring */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Synthetic Monitoring</h3>
            {sloData?.synthetic ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-600">Success Rate</div>
                  <div className="text-xl font-semibold text-indigo-600">{sloData.synthetic.averageSuccessRate}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Average TTFF</div>
                  <div className="text-lg font-semibold text-indigo-600">{sloData.synthetic.averageTTFF}ms</div>
                </div>
                <div className="pt-2 border-t">
                  <div className="text-sm text-gray-600">Recent Test Runs</div>
                  <div className="text-lg font-semibold text-gray-800">{sloData.synthetic.recent}</div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No synthetic monitoring data available</div>
            )}
          </div>
        </div>

        {/* SLO Targets */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">SLO Targets</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">≤ 1.2s</div>
              <div className="text-sm text-gray-600">TTFF P50 (Cable/Fiber)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">≤ 2.5s</div>
              <div className="text-sm text-gray-600">TTFF P95 (Cable/Fiber)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">≥ 99.5%</div>
              <div className="text-sm text-gray-600">Resolver Success Rate</div>
            </div>
          </div>
        </div>

        {/* Last Updated */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Last updated: {sloData?.timestamp ? new Date(sloData.timestamp).toLocaleString() : 'Never'}
        </div>
      </div>
    </div>
  );
}