import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// In-memory storage for telemetry (in production, this would go to a database/analytics service)
const telemetryData: any[] = [];

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
    
    if (ttffData.length === 0) {
      return NextResponse.json({ message: "No telemetry data available" });
    }
    
    const ttffValues = ttffData.map(d => d.ttff).filter(t => typeof t === 'number');
    
    if (ttffValues.length === 0) {
      return NextResponse.json({ message: "No valid TTFF data available" });
    }
    
    // Calculate statistics
    const sorted = ttffValues.sort((a, b) => a - b);
    const count = sorted.length;
    const p50 = sorted[Math.floor(count * 0.5)];
    const p95 = sorted[Math.floor(count * 0.95)];
    const p99 = sorted[Math.floor(count * 0.99)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = sorted.reduce((a, b) => a + b, 0) / count;
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      ttff: {
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
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "metrics_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}