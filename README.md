# Midwest TV

## Quick start

```bash
npm i
npm run dev
```

Open http(s)://localhost:3000

## Production-like mobile test

Deploy to Vercel for a close-to-prod experience:

1. Ensure Node.js runtime for the resolve route is set (already done via `export const runtime = "nodejs"`).
2. Push to a repo and import in Vercel.
3. Set the following settings in Vercel project (if needed):
   - Build command: `npm run build`
   - Output: `.next`
   - Node version: 18+
4. Visit the generated preview URL on mobile.

Alternatively, run on a VM with a public IP:

```bash
# On your VM
npm i --production
PORT=3000 npm run start
# Expose via nginx or Caddy reverse proxy with TLS
```

## Notes
- The player uses DASH/HLS via direct YouTube CDN URLs (ytdl-core resolve) with a Piped fallback.
- No YouTube UI is used; playback is pure HTML5 video via Shaka/hls.js.