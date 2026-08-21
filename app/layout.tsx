import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grinding Progress",
  description: "Track and document your Learning or Projects Progress"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
