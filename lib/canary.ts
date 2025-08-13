import { decipherVideo, DecipherErrorType, getDecipherStats } from './decipher';
import { ResolveContext } from '@/types/resolver';

// Canary test configuration
export interface CanaryConfig {
  testVideos: string[];
  testInterval: number; // milliseconds
  failureThreshold: number; // percentage
  alertThreshold: number; // consecutive failures
  clientProfiles: string[];
  regions: string[];
}

// Canary test result
export interface CanaryResult {
  timestamp: string;
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  successRate: number;
  errorDistribution: Record<DecipherErrorType, number>;
  problematicBaseJsHashes: string[];
  alerts: string[];
  duration: number;
}

// Canary test state
interface CanaryState {
  lastRun: string;
  consecutiveFailures: number;
  alertHistory: string[];
  baseJsHashFailures: Map<string, number>;
}

const canaryState: CanaryState = {
  lastRun: '',
  consecutiveFailures: 0,
  alertHistory: [],
  baseJsHashFailures: new Map(),
};

// Default canary configuration
export const DEFAULT_CANARY_CONFIG: CanaryConfig = {
  testVideos: [
    'dQw4w9WgXcQ', // Rick Roll (likely restricted)
    'jNQXAC9IVRw', // Me at the zoo (first YouTube video)
    'kJQP7kiw5Fk', // Despacito
    '9bZkp7q19f0', // Gangnam Style
    'y6120QOlsfU', // Sandstorm
    'ZZ5LpwO-An4', // What Is Love
    'kOkQ4T5WO9E', // Baby Shark (more recent)
    'dQw4w9WgXcQ', // Rick Roll (duplicate for consistency)
  ],
  testInterval: 24 * 60 * 60 * 1000, // 24 hours
  failureThreshold: 80, // 80% failure rate triggers alert
  alertThreshold: 3, // 3 consecutive failures trigger alert
  clientProfiles: ['WEB', 'ANDROID'],
  regions: ['US', 'CN'],
};

// Run canary test
export async function runCanaryTest(config: CanaryConfig = DEFAULT_CANARY_CONFIG): Promise<CanaryResult> {
  const startTime = Date.now();
  const results: Array<{ success: boolean; errorType?: DecipherErrorType; baseJsHash?: string }> = [];
  const errorDistribution: Record<DecipherErrorType, number> = {
    [DecipherErrorType.NETWORK_ERROR]: 0,
    [DecipherErrorType.SIGNATURE_DECODE_ERROR]: 0,
    [DecipherErrorType.BASE_JS_ERROR]: 0,
    [DecipherErrorType.RATE_LIMITED]: 0,
    [DecipherErrorType.AGE_RESTRICTED]: 0,
    [DecipherErrorType.PRIVATE_VIDEO]: 0,
    [DecipherErrorType.REGION_BLOCKED]: 0,
    [DecipherErrorType.UNKNOWN]: 0,
  };
  const alerts: string[] = [];
  
  console.log('🔍 Starting canary test...');
  
  // Test each video with different client profiles and regions
  for (const videoId of config.testVideos) {
    for (const clientProfile of config.clientProfiles) {
      for (const region of config.regions) {
        const context: ResolveContext = {
          videoId,
          clientProfile: clientProfile as any,
          region,
          correlationId: `canary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userAgent: 'canary-test/1.0',
          operation: 'canary',
        };
        
        try {
          const result = await decipherVideo(videoId, context);
          
          if (result.success) {
            results.push({ success: true, baseJsHash: result.baseJsHash });
          } else {
            results.push({ 
              success: false, 
              errorType: result.error?.type, 
              baseJsHash: result.baseJsHash 
            });
            
            if (result.error?.type) {
              errorDistribution[result.error.type]++;
            }
            
            // Track base.js hash failures
            if (result.baseJsHash) {
              const currentFailures = canaryState.baseJsHashFailures.get(result.baseJsHash) || 0;
              canaryState.baseJsHashFailures.set(result.baseJsHash, currentFailures + 1);
            }
          }
          
          // Small delay to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          results.push({ success: false, errorType: DecipherErrorType.UNKNOWN });
          errorDistribution[DecipherErrorType.UNKNOWN]++;
        }
      }
    }
  }
  
  // Calculate statistics
  const totalTests = results.length;
  const successfulTests = results.filter(r => r.success).length;
  const failedTests = totalTests - successfulTests;
  const successRate = totalTests > 0 ? (successfulTests / totalTests) * 100 : 0;
  
  // Check for alerts
  if (successRate < (100 - config.failureThreshold)) {
    canaryState.consecutiveFailures++;
    
    if (canaryState.consecutiveFailures >= config.alertThreshold) {
      const alert = `Canary test failure rate: ${successRate.toFixed(1)}% (${failedTests}/${totalTests} failed)`;
      alerts.push(alert);
      canaryState.alertHistory.push(`${new Date().toISOString()}: ${alert}`);
      
      // Keep alert history manageable
      if (canaryState.alertHistory.length > 50) {
        canaryState.alertHistory = canaryState.alertHistory.slice(-50);
      }
    }
  } else {
    canaryState.consecutiveFailures = 0;
  }
  
  // Check for problematic base.js hashes
  const problematicBaseJsHashes: string[] = [];
  Array.from(canaryState.baseJsHashFailures.entries()).forEach(([hash, failures]) => {
    if (failures >= 5) { // Consider problematic after 5 failures
      problematicBaseJsHashes.push(hash);
    }
  });
  
  // Update last run
  canaryState.lastRun = new Date().toISOString();
  
  const duration = Date.now() - startTime;
  
  console.log(`✅ Canary test completed: ${successRate.toFixed(1)}% success rate (${successfulTests}/${totalTests})`);
  
  return {
    timestamp: canaryState.lastRun,
    totalTests,
    successfulTests,
    failedTests,
    successRate,
    errorDistribution,
    problematicBaseJsHashes,
    alerts,
    duration,
  };
}

// Get canary statistics
export function getCanaryStats() {
  return {
    lastRun: canaryState.lastRun,
    consecutiveFailures: canaryState.consecutiveFailures,
    alertHistory: canaryState.alertHistory.slice(-10), // Last 10 alerts
    baseJsHashFailures: Object.fromEntries(canaryState.baseJsHashFailures),
  };
}

// Check if canary test is due
export function isCanaryTestDue(config: CanaryConfig = DEFAULT_CANARY_CONFIG): boolean {
  if (!canaryState.lastRun) return true;
  
  const lastRunTime = new Date(canaryState.lastRun).getTime();
  const now = Date.now();
  const timeSinceLastRun = now - lastRunTime;
  
  return timeSinceLastRun >= config.testInterval;
}

// Get canary health status
export function getCanaryHealth(): 'healthy' | 'warning' | 'critical' {
  if (canaryState.consecutiveFailures === 0) return 'healthy';
  if (canaryState.consecutiveFailures < 3) return 'warning';
  return 'critical';
}

// Manual canary test trigger
export async function triggerCanaryTest(): Promise<CanaryResult> {
  console.log('🚨 Manual canary test triggered');
  return runCanaryTest();
}

// Scheduled canary test (for use with cron jobs)
export async function scheduledCanaryTest(): Promise<void> {
  if (isCanaryTestDue()) {
    console.log('⏰ Running scheduled canary test');
    const result = await runCanaryTest();
    
    // Log results
    console.log(`Canary test results: ${result.successRate.toFixed(1)}% success rate`);
    console.log(`Alerts: ${result.alerts.length}`);
    console.log(`Problematic base.js hashes: ${result.problematicBaseJsHashes.length}`);
    
    // In production, you'd send alerts here
    if (result.alerts.length > 0) {
      console.log('🚨 CANARY ALERTS:', result.alerts);
      // sendAlert(result.alerts);
    }
  } else {
    console.log('⏰ Canary test not due yet');
  }
}