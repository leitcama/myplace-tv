// Client-side Real User Monitoring (RUM) system
export interface RUMConfig {
  enabled: boolean;
  sampleRate: number; // 0.0 to 1.0
  batchSize: number;
  flushIntervalMs: number;
  maxQueueSize: number;
  endpoint: string;
  includeUserAgent: boolean;
  includeNetworkInfo: boolean;
  includeDeviceInfo: boolean;
}

// RUM event types
export enum RUMEventType {
  TTFF = 'ttff',
  STARTUP_METRICS = 'startup_metrics',
  STALL = 'stall',
  QUALITY_SWITCH = 'quality_switch',
  ERROR = 'error',
  TRANSITION = 'transition',
  MANIFEST_REFRESH = 'manifest_refresh',
  MID_STREAM_UPDATE = 'mid_stream_update',
  WATCHDOG_EVENT = 'watchdog_event',
  PERFORMANCE = 'performance',
}

// RUM event base interface
export interface RUMEvent {
  type: RUMEventType;
  timestamp: string;
  videoId: string;
  sessionId: string;
  correlationId?: string;
  userAgent?: string;
  networkType?: string;
  deviceInfo?: DeviceInfo;
  metadata?: Record<string, any>;
}

// Device information
export interface DeviceInfo {
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  pixelRatio: number;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

// TTFF event
export interface TTFFEvent extends RUMEvent {
  type: RUMEventType.TTFF;
  ttff: number; // Time to first frame in milliseconds
  resolveTime: number;
  playerBootTime: number;
  firstFrameTime: number;
  totalStartupTime: number;
}

// Startup metrics event
export interface StartupMetricsEvent extends RUMEvent {
  type: RUMEventType.STARTUP_METRICS;
  ttff: number;
  resolveTime: number;
  playerBootTime: number;
  firstFrameTime: number;
  totalStartupTime: number;
  qualityLevel: string;
  bufferLength: number;
}

// Stall event
export interface StallEvent extends RUMEvent {
  type: RUMEventType.STALL;
  stallDuration: number;
  stallCount: number;
  currentTime: number;
  bufferLength: number;
  qualityLevel: string;
  networkType: string;
}

// Quality switch event
export interface QualitySwitchEvent extends RUMEvent {
  type: RUMEventType.QUALITY_SWITCH;
  fromQuality: string;
  toQuality: string;
  reason: string;
  currentTime: number;
  bufferLength: number;
  networkType: string;
}

// Error event
export interface ErrorEvent extends RUMEvent {
  type: RUMEventType.ERROR;
  errorType: string;
  errorCode: string;
  errorMessage: string;
  severity: string;
  recoveryAction?: string;
  retryCount: number;
  currentTime: number;
  qualityLevel: string;
}

// Transition event
export interface TransitionEvent extends RUMEvent {
  type: RUMEventType.TRANSITION;
  fromVideoId: string;
  toVideoId: string;
  transitionTime: number;
  transitionType: string;
  qualityLevel: string;
}

// Performance event
export interface PerformanceEvent extends RUMEvent {
  type: RUMEventType.PERFORMANCE;
  metric: string;
  value: number;
  unit: string;
  context?: Record<string, any>;
}

// RUM state
interface RUMState {
  sessionId: string;
  queue: RUMEvent[];
  isFlushing: boolean;
  lastFlush: number;
  config: RUMConfig;
  deviceInfo?: DeviceInfo;
  networkInfo?: any;
}

// Default RUM configuration
export const DEFAULT_RUM_CONFIG: RUMConfig = {
  enabled: true,
  sampleRate: 1.0, // 100% sampling
  batchSize: 10,
  flushIntervalMs: 5000, // 5 seconds
  maxQueueSize: 100,
  endpoint: '/api/telemetry',
  includeUserAgent: true,
  includeNetworkInfo: true,
  includeDeviceInfo: true,
};

// RUM state storage
let rumState: RUMState | null = null;
let flushInterval: NodeJS.Timeout | null = null;

// Initialize RUM system
export function initializeRUM(config: Partial<RUMConfig> = {}): void {
  if (typeof window === 'undefined') return;
  
  const finalConfig = { ...DEFAULT_RUM_CONFIG, ...config };
  
  // Generate session ID
  const sessionId = generateSessionId();
  
  // Get device information
  const deviceInfo = getDeviceInfo();
  
  // Get network information
  const networkInfo = getNetworkInfo();
  
  rumState = {
    sessionId,
    queue: [],
    isFlushing: false,
    lastFlush: Date.now(),
    config: finalConfig,
    deviceInfo,
    networkInfo,
  };
  
  // Start flush interval
  if (finalConfig.enabled) {
    flushInterval = setInterval(() => {
      flushRUMEvents();
    }, finalConfig.flushIntervalMs);
  }
  
  console.log('📊 RUM system initialized', {
    sessionId,
    config: finalConfig,
    deviceInfo,
    networkInfo,
  });
}

// Generate session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get device information
function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') return {} as DeviceInfo;
  
  const screen = window.screen;
  const connection = (navigator as any).connection;
  
  return {
    screenWidth: screen.width,
    screenHeight: screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
    connectionType: connection?.type,
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
    rtt: connection?.rtt,
    saveData: connection?.saveData,
  };
}

// Get network information
function getNetworkInfo(): any | undefined {
  if (typeof window === 'undefined') return undefined;
  
  return (navigator as any).connection;
}

// Track TTFF event
export function trackTTFF(
  videoId: string,
  ttff: number,
  resolveTime: number,
  playerBootTime: number,
  firstFrameTime: number,
  correlationId?: string
): void {
  const event: TTFFEvent = {
    type: RUMEventType.TTFF,
    timestamp: new Date().toISOString(),
    videoId,
    sessionId: rumState?.sessionId || 'unknown',
    correlationId,
    ttff,
    resolveTime,
    playerBootTime,
    firstFrameTime,
    totalStartupTime: ttff,
  };
  
  addRUMEvent(event);
}

// Track startup metrics
export function trackStartupMetrics(
  videoId: string,
  ttff: number,
  resolveTime: number,
  playerBootTime: number,
  firstFrameTime: number,
  qualityLevel: string,
  bufferLength: number,
  correlationId?: string
): void {
  const event: StartupMetricsEvent = {
    type: RUMEventType.STARTUP_METRICS,
    timestamp: new Date().toISOString(),
    videoId,
    sessionId: rumState?.sessionId || 'unknown',
    correlationId,
    ttff,
    resolveTime,
    playerBootTime,
    firstFrameTime,
    totalStartupTime: ttff,
    qualityLevel,
    bufferLength,
  };
  
  addRUMEvent(event);
}

// Track stall event
export function trackStall(
  videoId: string,
  stallDuration: number,
  stallCount: number,
  currentTime: number,
  bufferLength: number,
  qualityLevel: string,
  correlationId?: string
): void {
  const event: StallEvent = {
    type: RUMEventType.STALL,
    timestamp: new Date().toISOString(),
    videoId,
    sessionId: rumState?.sessionId || 'unknown',
    correlationId,
    networkType: rumState?.networkInfo?.effectiveType || 'unknown',
    stallDuration,
    stallCount,
    currentTime,
    bufferLength,
    qualityLevel,
  };
  
  addRUMEvent(event);
}

// Track quality switch
export function trackQualitySwitch(
  videoId: string,
  fromQuality: string,
  toQuality: string,
  reason: string,
  currentTime: number,
  bufferLength: number,
  correlationId?: string
): void {
  const event: QualitySwitchEvent = {
    type: RUMEventType.QUALITY_SWITCH,
    timestamp: new Date().toISOString(),
    videoId,
    sessionId: rumState?.sessionId || 'unknown',
    correlationId,
    networkType: rumState?.networkInfo?.effectiveType || 'unknown',
    fromQuality,
    toQuality,
    reason,
    currentTime,
    bufferLength,
  };
  
  addRUMEvent(event);
}

// Track error event
export function trackError(
  videoId: string,
  errorType: string,
  errorCode: string,
  errorMessage: string,
  severity: string,
  recoveryAction: string | undefined,
  retryCount: number,
  currentTime: number,
  qualityLevel: string,
  correlationId?: string
): void {
  const event: ErrorEvent = {
    type: RUMEventType.ERROR,
    timestamp: new Date().toISOString(),
    videoId,
    sessionId: rumState?.sessionId || 'unknown',
    correlationId,
    networkType: rumState?.networkInfo?.effectiveType || 'unknown',
    errorType,
    errorCode,
    errorMessage,
    severity,
    recoveryAction,
    retryCount,
    currentTime,
    qualityLevel,
  };
  
  addRUMEvent(event);
}

// Track transition event
export function trackTransition(
  fromVideoId: string,
  toVideoId: string,
  transitionTime: number,
  transitionType: string,
  qualityLevel: string,
  correlationId?: string
): void {
  const event: TransitionEvent = {
    type: RUMEventType.TRANSITION,
    timestamp: new Date().toISOString(),
    videoId: toVideoId,
    sessionId: rumState?.sessionId || 'unknown',
    correlationId,
    fromVideoId,
    toVideoId,
    transitionTime,
    transitionType,
    qualityLevel,
  };
  
  addRUMEvent(event);
}

// Track performance metric
export function trackPerformance(
  videoId: string,
  metric: string,
  value: number,
  unit: string,
  context?: Record<string, any>,
  correlationId?: string
): void {
  const event: PerformanceEvent = {
    type: RUMEventType.PERFORMANCE,
    timestamp: new Date().toISOString(),
    videoId,
    sessionId: rumState?.sessionId || 'unknown',
    correlationId,
    metric,
    value,
    unit,
    context,
  };
  
  addRUMEvent(event);
}

// Add RUM event to queue
function addRUMEvent(event: RUMEvent): void {
  if (!rumState || !rumState.config.enabled) return;
  
  // Apply sampling
  if (Math.random() > rumState.config.sampleRate) return;
  
  // Add metadata
  if (rumState.config.includeUserAgent) {
    event.userAgent = navigator.userAgent;
  }
  
  if (rumState.config.includeDeviceInfo && rumState.deviceInfo) {
    event.deviceInfo = rumState.deviceInfo;
  }
  
  // Add to queue
  rumState.queue.push(event);
  
  // Check if we need to flush
  if (rumState.queue.length >= rumState.config.batchSize) {
    flushRUMEvents();
  }
  
  // Check if queue is too large
  if (rumState.queue.length > rumState.config.maxQueueSize) {
    rumState.queue = rumState.queue.slice(-rumState.config.maxQueueSize);
  }
}

// Flush RUM events to server
async function flushRUMEvents(): Promise<void> {
  if (!rumState || rumState.isFlushing || rumState.queue.length === 0) return;
  
  rumState.isFlushing = true;
  
  try {
    const events = rumState.queue.splice(0, rumState.config.batchSize);
    
    // Send events to server
    const response = await fetch(rumState.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'rum_events',
        events,
        sessionId: rumState.sessionId,
        timestamp: new Date().toISOString(),
      }),
    });
    
    if (response.ok) {
      console.log(`📊 RUM events flushed: ${events.length} events`);
    } else {
      console.error('📊 RUM flush failed:', response.status);
      // Put events back in queue
      rumState.queue.unshift(...events);
    }
    
    rumState.lastFlush = Date.now();
    
  } catch (error) {
    console.error('📊 RUM flush error:', error);
    // Put events back in queue
    const events = rumState.queue.splice(0, rumState.config.batchSize);
    rumState.queue.unshift(...events);
  } finally {
    rumState.isFlushing = false;
  }
}

// Get RUM statistics
export function getRUMStats(): {
  sessionId: string;
  queueLength: number;
  isFlushing: boolean;
  lastFlush: number;
  config: RUMConfig;
  deviceInfo?: DeviceInfo;
} | null {
  if (!rumState) return null;
  
  return {
    sessionId: rumState.sessionId,
    queueLength: rumState.queue.length,
    isFlushing: rumState.isFlushing,
    lastFlush: rumState.lastFlush,
    config: rumState.config,
    deviceInfo: rumState.deviceInfo,
  };
}

// Force flush RUM events
export function forceFlushRUMEvents(): Promise<void> {
  return flushRUMEvents();
}

// Shutdown RUM system
export function shutdownRUM(): void {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
  
  // Flush remaining events
  flushRUMEvents().then(() => {
    rumState = null;
    console.log('📊 RUM system shutdown');
  });
}

// Auto-initialize RUM when module is loaded
if (typeof window !== 'undefined') {
  // Initialize RUM when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeRUM();
    });
  } else {
    initializeRUM();
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    forceFlushRUMEvents();
  });
}