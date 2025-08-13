// Synthetic monitoring system for automated health checks
export interface SyntheticConfig {
  enabled: boolean;
  testIntervalMs: number;
  regions: string[];
  testVideos: string[];
  timeoutMs: number;
  maxRetries: number;
  alertThreshold: number; // Percentage of failures before alerting
  endpoints: string[];
}

// Synthetic test result
export interface SyntheticTestResult {
  id: string;
  timestamp: string;
  region: string;
  endpoint: string;
  videoId: string;
  success: boolean;
  duration: number;
  statusCode?: number;
  error?: string;
  ttff?: number;
  resolveTime?: number;
  playerBootTime?: number;
  firstFrameTime?: number;
  metadata?: Record<string, any>;
}

// Synthetic test run
export interface SyntheticTestRun {
  id: string;
  timestamp: string;
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  successRate: number;
  averageDuration: number;
  averageTTFF: number;
  results: SyntheticTestResult[];
  alerts: string[];
}

// Synthetic monitoring state
interface SyntheticState {
  config: SyntheticConfig;
  lastRun?: SyntheticTestRun;
  consecutiveFailures: number;
  alertHistory: string[];
  isRunning: boolean;
  nextRunTime: number;
}

// Default synthetic configuration
export const DEFAULT_SYNTHETIC_CONFIG: SyntheticConfig = {
  enabled: true,
  testIntervalMs: 5 * 60 * 1000, // 5 minutes
  regions: ['US', 'EU', 'ASIA'],
  testVideos: ['dQw4w9WgXcQ', '9bZkp7q19f0', 'kJQP7kiw5Fk'], // Popular videos
  timeoutMs: 30000, // 30 seconds
  maxRetries: 2,
  alertThreshold: 80, // Alert if less than 80% success rate
  endpoints: [
    '/api/video/playback/resolve',
    '/api/metrics',
    '/api/telemetry',
    '/api/canary',
    '/api/prefetch',
    '/api/expiry',
    '/api/errors',
  ],
};

// Synthetic monitoring state storage
let syntheticState: SyntheticState | null = null;
let syntheticInterval: NodeJS.Timeout | null = null;

// Initialize synthetic monitoring
export function initializeSyntheticMonitoring(config: Partial<SyntheticConfig> = {}): void {
  const finalConfig = { ...DEFAULT_SYNTHETIC_CONFIG, ...config };
  
  syntheticState = {
    config: finalConfig,
    consecutiveFailures: 0,
    alertHistory: [],
    isRunning: false,
    nextRunTime: Date.now() + finalConfig.testIntervalMs,
  };
  
  // Start synthetic monitoring if enabled
  if (finalConfig.enabled) {
    syntheticInterval = setInterval(() => {
      runSyntheticTests();
    }, finalConfig.testIntervalMs);
  }
  
  console.log('🔍 Synthetic monitoring initialized', {
    config: finalConfig,
    nextRunTime: new Date(syntheticState.nextRunTime).toISOString(),
  });
}

// Run synthetic tests
export async function runSyntheticTests(): Promise<SyntheticTestRun> {
  if (!syntheticState || syntheticState.isRunning) {
    throw new Error('Synthetic monitoring not initialized or already running');
  }
  
  syntheticState.isRunning = true;
  const startTime = Date.now();
  const runId = `synthetic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🔍 Starting synthetic test run: ${runId}`);
  
  const results: SyntheticTestResult[] = [];
  const alerts: string[] = [];
  
  try {
    // Test each region
    for (const region of syntheticState.config.regions) {
      // Test each video
      for (const videoId of syntheticState.config.testVideos) {
        // Test resolver endpoint
        const resolverResult = await testResolverEndpoint(runId, region, videoId);
        results.push(resolverResult);
        
        // Test metrics endpoint
        const metricsResult = await testMetricsEndpoint(runId, region);
        results.push(metricsResult);
        
        // Test telemetry endpoint
        const telemetryResult = await testTelemetryEndpoint(runId, region);
        results.push(telemetryResult);
      }
    }
    
    // Calculate statistics
    const totalTests = results.length;
    const successfulTests = results.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    const successRate = totalTests > 0 ? (successfulTests / totalTests) * 100 : 0;
    const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
    const averageTTFF = results
      .filter(r => r.ttff !== undefined)
      .reduce((sum, r) => sum + (r.ttff || 0), 0) / results.filter(r => r.ttff !== undefined).length;
    
    // Check for alerts
    if (successRate < syntheticState.config.alertThreshold) {
      const alert = `Synthetic test success rate ${successRate.toFixed(1)}% below threshold ${syntheticState.config.alertThreshold}%`;
      alerts.push(alert);
      syntheticState.consecutiveFailures++;
    } else {
      syntheticState.consecutiveFailures = 0;
    }
    
    // Create test run
    const testRun: SyntheticTestRun = {
      id: runId,
      timestamp: new Date().toISOString(),
      totalTests,
      successfulTests,
      failedTests,
      successRate,
      averageDuration,
      averageTTFF,
      results,
      alerts,
    };
    
    // Update state
    syntheticState.lastRun = testRun;
    syntheticState.nextRunTime = Date.now() + syntheticState.config.testIntervalMs;
    
    // Log results
    console.log(`🔍 Synthetic test run completed: ${runId}`, {
      totalTests,
      successfulTests,
      failedTests,
      successRate: `${successRate.toFixed(1)}%`,
      averageDuration: `${averageDuration.toFixed(0)}ms`,
      averageTTFF: `${averageTTFF.toFixed(0)}ms`,
      alerts: alerts.length,
    });
    
    // Send telemetry
    await sendSyntheticTelemetry(testRun);
    
    return testRun;
    
  } catch (error: any) {
    console.error('🔍 Synthetic test run failed:', error);
    
    const failedRun: SyntheticTestRun = {
      id: runId,
      timestamp: new Date().toISOString(),
      totalTests: 0,
      successfulTests: 0,
      failedTests: 1,
      successRate: 0,
      averageDuration: 0,
      averageTTFF: 0,
      results: [],
      alerts: [`Synthetic test run failed: ${error.message}`],
    };
    
    syntheticState.lastRun = failedRun;
    syntheticState.consecutiveFailures++;
    
    return failedRun;
    
  } finally {
    syntheticState.isRunning = false;
  }
}

// Test resolver endpoint
async function testResolverEndpoint(
  runId: string,
  region: string,
  videoId: string
): Promise<SyntheticTestResult> {
  const testId = `${runId}_resolver_${region}_${videoId}`;
  const startTime = Date.now();
  
  try {
    const response = await fetch(`/api/video/playback/resolve?videoId=${videoId}&clientProfile=WEB&region=${region}`, {
      method: 'GET',
      headers: {
        'X-Synthetic-Test': 'true',
        'X-Test-Region': region,
      },
    });
    
    const duration = Date.now() - startTime;
    const success = response.ok;
    
    let ttff: number | undefined;
    let resolveTime: number | undefined;
    let playerBootTime: number | undefined;
    let firstFrameTime: number | undefined;
    
    if (success) {
      try {
        const data = await response.json();
        // Extract timing information if available
        if (data.metadata?.timing) {
          resolveTime = data.metadata.timing.resolveTime;
          playerBootTime = data.metadata.timing.playerBootTime;
          firstFrameTime = data.metadata.timing.firstFrameTime;
          ttff = firstFrameTime || duration;
        }
      } catch (e) {
        // Ignore JSON parsing errors for synthetic tests
      }
    }
    
    return {
      id: testId,
      timestamp: new Date().toISOString(),
      region,
      endpoint: '/api/video/playback/resolve',
      videoId,
      success,
      duration,
      statusCode: response.status,
      error: success ? undefined : `HTTP ${response.status}`,
      ttff,
      resolveTime,
      playerBootTime,
      firstFrameTime,
      metadata: {
        clientProfile: 'WEB',
        region,
      },
    };
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    return {
      id: testId,
      timestamp: new Date().toISOString(),
      region,
      endpoint: '/api/video/playback/resolve',
      videoId,
      success: false,
      duration,
      error: error.message,
      metadata: {
        clientProfile: 'WEB',
        region,
      },
    };
  }
}

// Test metrics endpoint
async function testMetricsEndpoint(runId: string, region: string): Promise<SyntheticTestResult> {
  const testId = `${runId}_metrics_${region}`;
  const startTime = Date.now();
  
  try {
    const response = await fetch('/api/metrics', {
      method: 'GET',
      headers: {
        'X-Synthetic-Test': 'true',
        'X-Test-Region': region,
      },
    });
    
    const duration = Date.now() - startTime;
    const success = response.ok;
    
    let metricsData: any = undefined;
    if (success) {
      try {
        metricsData = await response.json();
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }
    
    return {
      id: testId,
      timestamp: new Date().toISOString(),
      region,
      endpoint: '/api/metrics',
      videoId: 'N/A',
      success,
      duration,
      statusCode: response.status,
      error: success ? undefined : `HTTP ${response.status}`,
      metadata: {
        region,
        hasMetrics: !!metricsData,
      },
    };
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    return {
      id: testId,
      timestamp: new Date().toISOString(),
      region,
      endpoint: '/api/metrics',
      videoId: 'N/A',
      success: false,
      duration,
      error: error.message,
      metadata: {
        region,
      },
    };
  }
}

// Test telemetry endpoint
async function testTelemetryEndpoint(runId: string, region: string): Promise<SyntheticTestResult> {
  const testId = `${runId}_telemetry_${region}`;
  const startTime = Date.now();
  
  try {
    const response = await fetch('/api/telemetry', {
      method: 'GET',
      headers: {
        'X-Synthetic-Test': 'true',
        'X-Test-Region': region,
      },
    });
    
    const duration = Date.now() - startTime;
    const success = response.ok;
    
    let telemetryData: any = undefined;
    if (success) {
      try {
        telemetryData = await response.json();
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }
    
    return {
      id: testId,
      timestamp: new Date().toISOString(),
      region,
      endpoint: '/api/telemetry',
      videoId: 'N/A',
      success,
      duration,
      statusCode: response.status,
      error: success ? undefined : `HTTP ${response.status}`,
      metadata: {
        region,
        hasTelemetry: !!telemetryData,
      },
    };
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    return {
      id: testId,
      timestamp: new Date().toISOString(),
      region,
      endpoint: '/api/telemetry',
      videoId: 'N/A',
      success: false,
      duration,
      error: error.message,
      metadata: {
        region,
      },
    };
  }
}

// Send synthetic telemetry
async function sendSyntheticTelemetry(testRun: SyntheticTestRun): Promise<void> {
  try {
    await fetch('/api/telemetry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'synthetic_test_run',
        ...testRun,
        userAgent: 'Synthetic-Monitoring/1.0',
      }),
    });
  } catch (error) {
    console.error('🔍 Failed to send synthetic telemetry:', error);
  }
}

// Get synthetic monitoring statistics
export function getSyntheticStats(): {
  config: SyntheticConfig;
  lastRun?: SyntheticTestRun;
  consecutiveFailures: number;
  alertHistory: string[];
  isRunning: boolean;
  nextRunTime: number;
  health: 'healthy' | 'warning' | 'critical';
} | null {
  if (!syntheticState) return null;
  
  let health: 'healthy' | 'warning' | 'critical' = 'healthy';
  
  if (syntheticState.consecutiveFailures > 3) {
    health = 'critical';
  } else if (syntheticState.consecutiveFailures > 1) {
    health = 'warning';
  }
  
  return {
    config: syntheticState.config,
    lastRun: syntheticState.lastRun,
    consecutiveFailures: syntheticState.consecutiveFailures,
    alertHistory: syntheticState.alertHistory.slice(-10), // Last 10 alerts
    isRunning: syntheticState.isRunning,
    nextRunTime: syntheticState.nextRunTime,
    health,
  };
}

// Get synthetic monitoring health
export function getSyntheticHealth(): 'healthy' | 'warning' | 'critical' {
  const stats = getSyntheticStats();
  return stats?.health || 'healthy';
}

// Force run synthetic tests
export function forceRunSyntheticTests(): Promise<SyntheticTestRun> {
  return runSyntheticTests();
}

// Shutdown synthetic monitoring
export function shutdownSyntheticMonitoring(): void {
  if (syntheticInterval) {
    clearInterval(syntheticInterval);
    syntheticInterval = null;
  }
  
  syntheticState = null;
  console.log('🔍 Synthetic monitoring shutdown');
}

// Auto-initialize synthetic monitoring
if (typeof window === 'undefined') {
  // Only initialize on server side
  initializeSyntheticMonitoring();
}