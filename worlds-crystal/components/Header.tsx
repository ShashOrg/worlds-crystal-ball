"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

import ThemeToggle from "@/components/ThemeToggle";

export default function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-border bg-card">
      <nav className="mx-auto flex w-full max-w-[95rem] items-center justify-between gap-6 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <Link href="/" className="font-semibold text-text">
            Worlds Crystal Ball
          </Link>
          <Link href="/crystal-ball" className="transition-opacity hover:opacity-80">
            Crystal Ball
          </Link>
          <Link href="/admin/import" className="transition-opacity hover:opacity-80">
            Admin Import
          </Link>
          <Link href="/picks" className="transition-opacity hover:opacity-80">
            My Picks
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {status === "authenticated" ? (
              <>
                {session.user?.image && (
                  <Image
                    src={session.user.image}
                    alt={session.user?.name ?? "User avatar"}
                    width={28}
                    height={28}
                    className="rounded-full ring-1 ring-neutral-300 dark:ring-neutral-700"
                  />
                )}
                <span className="hidden sm:inline text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {session.user?.name ??
                    (session.user?.email
                      ? session.user.email.split("@")[0]
                      : "Signed in")}
                </span>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 active:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/signin"
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 active:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                Sign in
              </Link>
            )}
          </div>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
