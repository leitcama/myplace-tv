export const metadata = { title: "Midwest Scene TV", description: "Deterministic, view-only TV channel" };

import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://www.youtube-nocookie.com" crossOrigin="anonymous"/>
        <link rel="preconnect" href="https://i.ytimg.com" crossOrigin="anonymous"/>
        <link rel="preconnect" href="https://www.youtube.com" crossOrigin="anonymous"/>
        <link rel="preconnect" href="https://s.ytimg.com" crossOrigin="anonymous"/>
        <link rel="dns-prefetch" href="//www.youtube-nocookie.com"/>
        <link rel="dns-prefetch" href="//i.ytimg.com"/>
        <link rel="dns-prefetch" href="//s.ytimg.com"/>
      </head>
      <body>{children}</body>
    </html>
  );
}
