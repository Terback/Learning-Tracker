import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learning Tracker",
  description: "A personal learning operating system for goals, milestones, progress logs, and resources."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
