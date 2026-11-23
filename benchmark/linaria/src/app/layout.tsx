import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CSS Benchmark",
  description: "Benchmark fixture",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
