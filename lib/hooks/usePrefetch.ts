import { useEffect, useRef, useCallback } from 'react';

// Prefetch configuration
interface PrefetchConfig {
  enabled: boolean;
  interval: number; // How often to check for prefetch opportunities (ms)
  lookAheadSeconds: number; // How far ahead to look for next item
}

// Default configuration
const DEFAULT_CONFIG: PrefetchConfig = {
  enabled: true,
  interval: 5000, // Check every 5 seconds
  lookAheadSeconds: 30, // Look 30 seconds ahead
};

// Prefetch hook
export function usePrefetch(config: PrefetchConfig = DEFAULT_CONFIG) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPrefetchRef = useRef<number>(0);
  const isActiveRef = useRef<boolean>(false);

  // Trigger prefetch
  const triggerPrefetch = useCallback(async () => {
    if (!config.enabled || isActiveRef.current) return;
    
    try {
      isActiveRef.current = true;
      const response = await fetch('/api/prefetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.count > 0) {
          console.log(`🚀 Prefetched ${result.count} manifest(s)`);
        }
      }
    } catch (error) {
      console.warn('Prefetch failed:', error);
    } finally {
      isActiveRef.current = false;
    }
  }, [config.enabled]);

  // Start prefetch monitoring
  const startPrefetch = useCallback(() => {
    if (!config.enabled || intervalRef.current) return;
    
    console.log('🚀 Starting prefetch monitoring');
    
    // Initial prefetch
    triggerPrefetch();
    
    // Set up interval
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      
      // Only prefetch if enough time has passed since last attempt
      if (now - lastPrefetchRef.current > config.interval) {
        lastPrefetchRef.current = now;
        triggerPrefetch();
      }
    }, config.interval);
  }, [config.enabled, config.interval, triggerPrefetch]);

  // Stop prefetch monitoring
  const stopPrefetch = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('🚀 Stopped prefetch monitoring');
    }
  }, []);

  // Manual prefetch trigger
  const manualPrefetch = useCallback(() => {
    if (config.enabled) {
      triggerPrefetch();
    }
  }, [config.enabled, triggerPrefetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPrefetch();
    };
  }, [stopPrefetch]);

  return {
    startPrefetch,
    stopPrefetch,
    manualPrefetch,
    isActive: isActiveRef.current,
  };
}

// Hook for seamless transitions
export function useSeamlessTransitions() {
  const transitionStartRef = useRef<number>(0);
  const transitionEndRef = useRef<number>(0);

  // Start transition timing
  const startTransition = useCallback(() => {
    transitionStartRef.current = performance.now();
  }, []);

  // End transition timing and log metrics
  const endTransition = useCallback((videoId: string) => {
    transitionEndRef.current = performance.now();
    const transitionTime = transitionEndRef.current - transitionStartRef.current;
    
    console.log(`🔄 Transition completed in ${transitionTime.toFixed(1)}ms`, { videoId });
    
    // Send transition metrics to telemetry
    if (typeof window !== 'undefined' && window.navigator) {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'transition_metrics',
          videoId,
          transitionTime,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {}); // Silently fail
    }
  }, []);

  return {
    startTransition,
    endTransition,
  };
}