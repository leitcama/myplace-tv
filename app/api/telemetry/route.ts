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