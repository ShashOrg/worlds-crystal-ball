import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import AuthButton from "@/app/AuthButton"; // make sure this file has "use client" at the top

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
        <body className="min-h-screen bg-white text-gray-900">
        <Providers>
            <header className="border-b">
                <nav className="mx-auto flex w-full max-w-screen-2xl items-center justify-between p-4 text-sm">
                    <div className="flex gap-6">
                        <Link href="/" className="font-semibold">Worlds Crystal Ball</Link>
                        <Link href="/crystal-ball" className="hover:underline">Crystal Ball</Link>
                        <Link href="/admin/import" className="hover:underline">Admin Import</Link>
                        <Link href="/picks" className="hover:underline">My Picks</Link>
                    </div>
                    <AuthButton />
                </nav>
            </header>
            <main className="mx-auto w-full max-w-screen-2xl p-6">{children}</main>
        </Providers>
        </body>
        </html>
    );
}
