import type { Metadata } from "next";
import "./globals.css";

import Header from "@/components/Header";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Worlds Crystal Ball",
  description: "Predictions, picks, and insights for Worlds.",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-bg text-text antialiased">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-[95rem] p-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
