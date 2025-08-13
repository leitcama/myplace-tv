import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// In-memory storage for telemetry (in production, this would go to a database/analytics service)
const telemetryData: any[] = [];

// Enhanced startup metrics storage
const startupMetrics: Array<{
  ttff: number;
  resolveTime: number;
  playerBootTime: number;
  firstFrameTime: number;
  timestamp: string;
  videoId: string;
  userAgent: string;
}> = [];

// Error taxonomy events storage
const errorEvents: Array<{
  type: string;
  severity: string;
  message: string;
  videoId: string;
  timestamp: string;
  userAgent: string;
  retryCount: number;
  recoveryAction?: string;
  success: boolean;
  duration?: number;
}> = [];

// Recovery events storage
const recoveryEvents: Array<{
  action: string;
  videoId: string;
  timestamp: string;
  userAgent: string;
  success: boolean;
  duration: number;
  error?: string;
  newQualityLevel?: number;
}> = [];

// Watchdog events storage
const watchdogEvents: Array<{
  type: string;
  videoId: string;
  timestamp: string;
  userAgent: string;
  details: any;
  errorType?: string;
  recoveryAction?: string;
  duration?: number;
}> = [];

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    // Validate required fields
    if (!data.type || !data.timestamp) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Add server timestamp and IP
    const enrichedData = {
      ...data,
      serverTimestamp: new Date().toISOString(),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
    };
    
    // Store telemetry data (in production, this would be sent to analytics service)
    telemetryData.push(enrichedData);
    
    // Keep only last 1000 entries to prevent memory leaks
    if (telemetryData.length > 1000) {
      telemetryData.splice(0, telemetryData.length - 1000);
    }
    
    // Log important metrics
    if (data.type === 'ttff' && data.ttff) {
      console.log('TTFF telemetry:', {
        videoId: data.videoId,
        ttff: data.ttff,
        userAgent: data.userAgent?.substring(0, 100), // Truncate for logging
      });
    }
    
    // Handle enhanced startup metrics
    if (data.type === 'startup_metrics' && data.ttff) {
      startupMetrics.push({
        ttff: data.ttff,
        resolveTime: data.resolveTime || 0,
        playerBootTime: data.playerBootTime || 0,
        firstFrameTime: data.firstFrameTime || 0,
        timestamp: data.timestamp,
        videoId: data.videoId,
        userAgent: data.userAgent,
      });
      
      // Keep only last 500 startup metrics
      if (startupMetrics.length > 500) {
        startupMetrics.splice(0, startupMetrics.length - 500);
      }
      
      console.log('Enhanced startup metrics:', {
        videoId: data.videoId,
        ttff: data.ttff,
        resolveTime: data.resolveTime,
        playerBootTime: data.playerBootTime,
        firstFrameTime: data.firstFrameTime,
        userAgent: data.userAgent?.substring(0, 100),
      });
    }
    
    // Handle error taxonomy events
    if (data.type === 'error_event') {
      errorEvents.push({
        type: data.errorType,
        severity: data.severity,
        message: data.message,
        videoId: data.videoId,
        timestamp: data.timestamp,
        userAgent: data.userAgent,
        retryCount: data.retryCount || 0,
        recoveryAction: data.recoveryAction,
        success: data.success || false,
        duration: data.duration,
      });
      
      // Keep only last 200 error events
      if (errorEvents.length > 200) {
        errorEvents.splice(0, errorEvents.length - 200);
      }
      
      console.log('Error event tracked:', {
        videoId: data.videoId,
        type: data.errorType,
        severity: data.severity,
        message: data.message?.substring(0, 100),
        retryCount: data.retryCount,
        recoveryAction: data.recoveryAction,
        success: data.success,
      });
    }
    
    // Handle recovery events
    if (data.type === 'recovery_event') {
      recoveryEvents.push({
        action: data.action,
        videoId: data.videoId,
        timestamp: data.timestamp,
        userAgent: data.userAgent,
        success: data.success,
        duration: data.duration,
        error: data.error,
        newQualityLevel: data.newQualityLevel,
      });
      
      // Keep only last 200 recovery events
      if (recoveryEvents.length > 200) {
        recoveryEvents.splice(0, recoveryEvents.length - 200);
      }
      
      console.log('Recovery event tracked:', {
        videoId: data.videoId,
        action: data.action,
        success: data.success,
        duration: data.duration,
        newQualityLevel: data.newQualityLevel,
      });
    }
    
    // Handle watchdog events
    if (data.type === 'watchdog_event') {
      watchdogEvents.push({
        type: data.eventType,
        videoId: data.videoId,
        timestamp: data.timestamp,
        userAgent: data.userAgent,
        details: data.details,
        errorType: data.errorType,
        recoveryAction: data.recoveryAction,
        duration: data.duration,
      });
      
      // Keep only last 200 watchdog events
      if (watchdogEvents.length > 200) {
        watchdogEvents.splice(0, watchdogEvents.length - 200);
      }
      
      console.log('Watchdog event tracked:', {
        videoId: data.videoId,
        type: data.eventType,
        errorType: data.errorType,
        recoveryAction: data.recoveryAction,
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Telemetry error:', error);
    return NextResponse.json(
      { error: "telemetry_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Return aggregated telemetry data for monitoring
    const ttffData = telemetryData.filter(d => d.type === 'ttff');
    const startupData = startupMetrics;
    const errorData = errorEvents;
    const recoveryData = recoveryEvents;
    const watchdogData = watchdogEvents;
    
    const result: any = {
      timestamp: new Date().toISOString(),
    };
    
    // Basic TTFF metrics
    if (ttffData.length > 0) {
      const ttffValues = ttffData.map(d => d.ttff).filter(t => typeof t === 'number');
      
      if (ttffValues.length > 0) {
        const sorted = ttffValues.sort((a, b) => a - b);
        const count = sorted.length;
        const p50 = sorted[Math.floor(count * 0.5)];
        const p95 = sorted[Math.floor(count * 0.95)];
        const p99 = sorted[Math.floor(count * 0.99)];
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const avg = sorted.reduce((a, b) => a + b, 0) / count;
        
        result.ttff = {
          count,
          p50: Math.round(p50),
          p95: Math.round(p95),
          p99: Math.round(p99),
          min: Math.round(min),
          max: Math.round(max),
          avg: Math.round(avg),
          recent: ttffData.slice(-10).map(d => ({
            videoId: d.videoId,
            ttff: d.ttff,
            timestamp: d.timestamp,
          })),
        };
      }
    }
    
    // Enhanced startup metrics
    if (startupData.length > 0) {
      const calculateStats = (values: number[]) => {
        if (values.length === 0) return null;
        const sorted = values.sort((a, b) => a - b);
        const count = sorted.length;
        const p50 = sorted[Math.floor(count * 0.5)];
        const p95 = sorted[Math.floor(count * 0.95)];
        const p99 = sorted[Math.floor(count * 0.99)];
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const avg = sorted.reduce((a, b) => a + b, 0) / count;
        
        return {
          count,
          p50: Math.round(p50),
          p95: Math.round(p95),
          p99: Math.round(p99),
          min: Math.round(min),
          max: Math.round(max),
          avg: Math.round(avg),
        };
      };
      
      result.startup = {
        total: startupData.length,
        ttff: calculateStats(startupData.map(d => d.ttff)),
        resolveTime: calculateStats(startupData.map(d => d.resolveTime)),
        playerBootTime: calculateStats(startupData.map(d => d.playerBootTime)),
        firstFrameTime: calculateStats(startupData.map(d => d.firstFrameTime)),
        recent: startupData.slice(-10).map(d => ({
          videoId: d.videoId,
          ttff: d.ttff,
          resolveTime: d.resolveTime,
          playerBootTime: d.playerBootTime,
          firstFrameTime: d.firstFrameTime,
          timestamp: d.timestamp,
        })),
      };
    }
    
    // Error taxonomy metrics
    if (errorData.length > 0) {
      const errorTypeCounts = errorData.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const severityCounts = errorData.reduce((acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const successRate = errorData.filter(e => e.success).length / errorData.length;
      
      result.errors = {
        total: errorData.length,
        errorTypeCounts,
        severityCounts,
        successRate: `${(successRate * 100).toFixed(1)}%`,
        recent: errorData.slice(-10).map(d => ({
          videoId: d.videoId,
          type: d.type,
          severity: d.severity,
          message: d.message?.substring(0, 50),
          retryCount: d.retryCount,
          recoveryAction: d.recoveryAction,
          success: d.success,
          timestamp: d.timestamp,
        })),
      };
    }
    
    // Recovery metrics
    if (recoveryData.length > 0) {
      const actionCounts = recoveryData.reduce((acc, event) => {
        acc[event.action] = (acc[event.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const successRate = recoveryData.filter(e => e.success).length / recoveryData.length;
      const avgDuration = recoveryData.reduce((sum, e) => sum + e.duration, 0) / recoveryData.length;
      
      result.recovery = {
        total: recoveryData.length,
        actionCounts,
        successRate: `${(successRate * 100).toFixed(1)}%`,
        averageDuration: Math.round(avgDuration),
        recent: recoveryData.slice(-10).map(d => ({
          videoId: d.videoId,
          action: d.action,
          success: d.success,
          duration: d.duration,
          newQualityLevel: d.newQualityLevel,
          timestamp: d.timestamp,
        })),
      };
    }
    
    // Watchdog metrics
    if (watchdogData.length > 0) {
      const eventTypeCounts = watchdogData.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      result.watchdog = {
        total: watchdogData.length,
        eventTypeCounts,
        recent: watchdogData.slice(-10).map(d => ({
          videoId: d.videoId,
          type: d.type,
          errorType: d.errorType,
          recoveryAction: d.recoveryAction,
          timestamp: d.timestamp,
        })),
      };
    }
    
    if (Object.keys(result).length === 1) { // Only timestamp
      return NextResponse.json({ message: "No telemetry data available" });
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: "metrics_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}