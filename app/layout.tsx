export const metadata = { title: "Midwest Scene TV", description: "Deterministic, view-only TV channel" };

import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
