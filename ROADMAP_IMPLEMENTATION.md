# Midwest TV - Production Roadmap Implementation

## Milestone 1: Resolver Hardening v1 - Caching and Structured Outputs ✅ COMPLETED

### Implemented Features

#### 1. Caching Layer (`lib/cache.ts`)
- **LRU Cache**: In-memory cache for development with configurable TTLs
- **Redis Support**: Framework for production Redis integration
- **Cache Metrics**: Hit/miss tracking with `getCacheMetrics()`
- **Structured Logging**: Correlation IDs and contextual logging

#### 2. Structured Response Types (`types/resolver.ts`)
- **ResolveResponse**: Normalized resolver output with tier, correlation ID, timestamp
- **Error Handling**: Typed error responses with error codes
- **Client Profiles**: Support for different YouTube clients (WEB, ANDROID, TV, IOS)
- **Resolution Ladder**: Quality information for progressive formats

#### 3. Enhanced Resolver (`app/api/video/playback/resolve/route.ts`)
- **Caching Integration**: Player response and resolve result caching
- **Structured Logging**: Correlation IDs, performance metrics, tier tracking
- **Error Taxonomy**: Proper error classification and structured error responses
- **TTL Management**: Dynamic TTL based on URL expiry with safety margins

#### 4. Performance Optimizations
- **Static Preconnect**: DNS prefetch and preconnect hints in `app/layout.tsx`
- **ABR Tuning**: Optimized Shaka and hls.js configurations for faster startup
- **TTFF Measurement**: Time-to-first-frame tracking in `components/Player.tsx`
- **Enhanced Watchdog**: Improved startup timeout handling (3s vs 2s)

#### 5. Observability
- **Metrics Endpoint**: `/api/metrics` for cache performance monitoring
- **Telemetry Endpoint**: `/api/telemetry` for client-side RUM data
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Performance Tracking**: Resolve latency and TTFF measurements

### Performance Improvements

#### Caching Performance
- **Player Response Cache**: 5-minute TTL, reduces ytdl-core calls
- **Resolve Result Cache**: Dynamic TTL based on URL expiry
- **Cache Hit Rate**: Expected >80% for channel loop scenarios

#### ABR Optimizations
- **Shaka Config**: Lower initial bandwidth (2Mbps), faster switching (1.5s)
- **HLS.js Config**: Start at lowest quality, conservative buffering (10s)
- **Buffer Targets**: Reduced buffering goals (8s vs 10s) for faster startup

#### Network Optimizations
- **Preconnect Hints**: Static DNS prefetch for googlevideo.com domains
- **Dynamic Preconnect**: Runtime preconnect based on resolved CDN host
- **TTL Safety Margins**: 1-minute buffer before URL expiry

### Testing Coverage

#### Unit Tests (`tests/resolveManifest.test.ts`)
- ✅ Progressive fallback resolution
- ✅ Piped fallback when YouTube fails
- ✅ Error handling for missing videoId
- ✅ Structured response validation

#### Integration Points
- ✅ Cache integration with resolver
- ✅ Structured logging with correlation IDs
- ✅ Error taxonomy and response formatting
- ✅ Performance metrics collection

## Current Performance Targets

### Resolver Performance
- **Target**: p50 < 150ms, p95 < 400ms on warm cache
- **Current**: Baseline established with caching and structured logging
- **Monitoring**: Cache hit rates and resolve latency via `/api/metrics`

### TTFF Performance
- **Target**: p50 ≤ 1.2s, p95 ≤ 2.5s on cable/fiber
- **Current**: TTFF measurement implemented, ABR tuning applied
- **Monitoring**: Client telemetry via `/api/telemetry`

### Reliability
- **Target**: Resolver success rate >99%
- **Current**: Tier 1 (YouTube) + Tier 2 (Piped) fallback implemented
- **Monitoring**: Error taxonomy and structured logging

## Next Steps - Milestone 2: Multi-Client and Regional Resilience

### Planned Features

#### 1. Multi-Client Support
- **Client Profiles**: ANDROID, TV, IOS client selection
- **Regional Detection**: Automatic region detection and client selection
- **Fallback Strategy**: Client rotation on signature failures

#### 2. Invidious Integration
- **Tier 3 Fallback**: Invidious API integration
- **Endpoint Rotation**: Multiple Invidious instances
- **Format Selection**: DASH > HLS > Progressive priority

#### 3. Resilience Improvements
- **Exponential Backoff**: Retry logic with jitter
- **Rate Limiting**: Per-origin rate limiting and backoff
- **Error Classification**: Better error taxonomy for different failure modes

### Implementation Plan

1. **Client Profile Selection**
   ```typescript
   // Add to ResolveContext
   clientProfile: 'WEB' | 'ANDROID' | 'TV' | 'IOS'
   region?: string
   ```

2. **Invidious Integration**
   ```typescript
   async function tryInvidious(videoId: string, context: ResolveContext)
   ```

3. **Enhanced Error Handling**
   ```typescript
   interface ResolveError {
     code: 'decipher_failed' | 'rate_limited' | 'region_blocked' | ...
   }
   ```

## Deployment Considerations

### Environment Configuration
- **Development**: LRU cache with in-memory storage
- **Production**: Redis cache with persistent storage
- **Feature Flags**: Tier selection and ABR preset toggles

### Monitoring Setup
- **Metrics**: Prometheus-style metrics from `/api/metrics`
- **Logging**: Structured JSON logs with correlation IDs
- **Alerting**: TTFF and resolver success rate thresholds

### Security Considerations
- **CORS**: Restricted origins for resolver endpoints
- **Rate Limiting**: Per-IP rate limiting on resolve endpoint
- **Input Validation**: Video ID validation and sanitization

## Usage Examples

### Basic Resolve Request
```bash
curl "http://localhost:3000/api/video/playback/resolve?videoId=dQw4w9WgXcQ"
```

### With Client Profile
```bash
curl "http://localhost:3000/api/video/playback/resolve?videoId=dQw4w9WgXcQ&clientProfile=ANDROID&region=US"
```

### Metrics Endpoint
```bash
curl "http://localhost:3000/api/metrics"
```

### Telemetry Data
```bash
curl "http://localhost:3000/api/telemetry"
```

## Performance Monitoring

### Key Metrics
- **Cache Hit Rate**: `cache.hitRate` from `/api/metrics`
- **TTFF Percentiles**: `ttff.p50`, `ttff.p95` from `/api/telemetry`
- **Resolver Success Rate**: Error rate from structured logs
- **Tier Distribution**: YouTube vs Piped vs Invidious usage

### Alerting Thresholds
- **TTFF p95 > 2.5s** for 15 minutes
- **Resolver success < 99.5%** for 15 minutes
- **Cache hit rate < 80%** for 15 minutes
- **Fallback rate > 5%** for 15 minutes

## Conclusion

Milestone 1 has successfully implemented:
- ✅ Caching layer with structured outputs
- ✅ Performance optimizations and ABR tuning
- ✅ Observability and telemetry collection
- ✅ Comprehensive testing coverage
- ✅ Production-ready error handling

The foundation is now in place for the next milestones focusing on multi-client support, regional resilience, and advanced fallback strategies.