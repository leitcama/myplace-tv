export const metadata = { title: "Midwest Scene TV", description: "Deterministic, view-only TV channel" };

import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Permissions-Policy" content="autoplay=(self)" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
        
        {/* Preconnect hints for common CDN hosts */}
        <link rel="dns-prefetch" href="//*.googlevideo.com" />
        <link rel="dns-prefetch" href="//*.ytimg.com" />
        <link rel="preconnect" href="https://*.googlevideo.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://*.ytimg.com" crossOrigin="anonymous" />
        
        {/* Preconnect for Piped fallback endpoints */}
        <link rel="dns-prefetch" href="//piped.video" />
        <link rel="dns-prefetch" href="//pipedapi.kavin.rocks" />
        <link rel="preconnect" href="https://piped.video" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://pipedapi.kavin.rocks" crossOrigin="anonymous" />
        
        {/* Preconnect for Invidious fallback endpoints */}
        <link rel="dns-prefetch" href="//invidious.projectsegfau.lt" />
        <link rel="dns-prefetch" href="//invidious.slipfox.xyz" />
        <link rel="dns-prefetch" href="//invidious.privacydev.net" />
        <link rel="preconnect" href="https://invidious.projectsegfau.lt" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://invidious.slipfox.xyz" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://invidious.privacydev.net" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
