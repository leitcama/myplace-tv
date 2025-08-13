import { useEffect, useRef, useCallback } from 'react';

// Manifest refresh configuration
interface ManifestRefreshConfig {
  enabled: boolean;
  checkIntervalMs: number; // How often to check for manifest updates
  refreshWindowMinutes: number; // Minutes before expiry to refresh
  maxRefreshAttempts: number;
}

// Default configuration
const DEFAULT_CONFIG: ManifestRefreshConfig = {
  enabled: true,
  checkIntervalMs: 30 * 1000, // Check every 30 seconds
  refreshWindowMinutes: 3, // Refresh 3 minutes before expiry
  maxRefreshAttempts: 3,
};

// Manifest refresh hook
export function useManifestRefresh(
  videoId: string,
  manifestUrl: string,
  expiresAt: string | undefined,
  config: ManifestRefreshConfig = DEFAULT_CONFIG
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshAttemptsRef = useRef<number>(0);
  const lastRefreshRef = useRef<number>(0);

  // Check if manifest needs refresh
  const checkManifestExpiry = useCallback(() => {
    if (!config.enabled || !expiresAt) return;

    const now = Date.now();
    const expiresAtTime = new Date(expiresAt).getTime();
    const timeUntilExpiry = expiresAtTime - now;
    const refreshWindowMs = config.refreshWindowMinutes * 60 * 1000;

    // Check if we're within refresh window and haven't exceeded max attempts
    if (timeUntilExpiry <= refreshWindowMs && timeUntilExpiry > 0 && refreshAttemptsRef.current < config.maxRefreshAttempts) {
      console.log(`🔄 Manifest expiring soon, triggering refresh`, {
        videoId,
        timeUntilExpiry: Math.round(timeUntilExpiry / 1000),
        refreshAttempts: refreshAttemptsRef.current,
      });

      refreshManifest();
    }
  }, [config, expiresAt, videoId]);

  // Refresh manifest
  const refreshManifest = useCallback(async () => {
    if (refreshAttemptsRef.current >= config.maxRefreshAttempts) {
      console.warn(`🔄 Max refresh attempts reached for ${videoId}`);
      return;
    }

    try {
      refreshAttemptsRef.current++;
      lastRefreshRef.current = Date.now();

      console.log(`🔄 Refreshing manifest for ${videoId} (attempt ${refreshAttemptsRef.current})`);

      // Trigger server-side refresh
      const response = await fetch(`/api/expiry?videoId=${encodeURIComponent(videoId)}`, {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log(`🔄 Manifest refresh successful for ${videoId}`, {
            timeUntilExpiry: Math.round(result.result.timeUntilExpiry / 1000),
            refreshAttempts: result.result.refreshAttempts,
          });

          // Send refresh metrics to telemetry
          if (typeof window !== 'undefined' && window.navigator) {
            fetch('/api/telemetry', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'manifest_refresh',
                videoId,
                success: true,
                refreshAttempts: result.result.refreshAttempts,
                timeUntilExpiry: result.result.timeUntilExpiry,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
              }),
            }).catch(() => {}); // Silently fail
          }
        } else {
          console.warn(`🔄 Manifest refresh failed for ${videoId}`, result.message);
        }
      } else {
        console.warn(`🔄 Manifest refresh request failed for ${videoId}`, response.status);
      }
    } catch (error) {
      console.error(`🔄 Manifest refresh error for ${videoId}`, error);
    }
  }, [videoId, config.maxRefreshAttempts]);

  // Manual refresh trigger
  const manualRefresh = useCallback(() => {
    if (config.enabled) {
      refreshManifest();
    }
  }, [config.enabled, refreshManifest]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (!config.enabled || intervalRef.current) return;

    console.log(`🔄 Starting manifest refresh monitoring for ${videoId}`);
    
    // Initial check
    checkManifestExpiry();
    
    // Set up interval
    intervalRef.current = setInterval(checkManifestExpiry, config.checkIntervalMs);
  }, [config.enabled, config.checkIntervalMs, checkManifestExpiry, videoId]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log(`🔄 Stopped manifest refresh monitoring for ${videoId}`);
    }
  }, [videoId]);

  // Reset refresh attempts
  const resetRefreshAttempts = useCallback(() => {
    refreshAttemptsRef.current = 0;
    lastRefreshRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    startMonitoring,
    stopMonitoring,
    manualRefresh,
    resetRefreshAttempts,
    refreshAttempts: refreshAttemptsRef.current,
    lastRefresh: lastRefreshRef.current,
  };
}

// Hook for mid-stream manifest updates
export function useMidStreamUpdates() {
  const updateStartRef = useRef<number>(0);
  const updateEndRef = useRef<number>(0);

  // Start update timing
  const startUpdate = useCallback(() => {
    updateStartRef.current = performance.now();
  }, []);

  // End update timing and log metrics
  const endUpdate = useCallback((videoId: string, success: boolean) => {
    updateEndRef.current = performance.now();
    const updateTime = updateEndRef.current - updateStartRef.current;
    
    console.log(`🔄 Mid-stream update ${success ? 'completed' : 'failed'} in ${updateTime.toFixed(1)}ms`, { videoId });
    
    // Send update metrics to telemetry
    if (typeof window !== 'undefined' && window.navigator) {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'mid_stream_update',
          videoId,
          success,
          updateTime,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {}); // Silently fail
    }
  }, []);

  return {
    startUpdate,
    endUpdate,
  };
}