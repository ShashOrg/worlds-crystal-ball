import Link from "next/link";

import ThemeToggleButton from "@/components/ThemeToggleButton";
import SignInWithGitHubButton from "@/components/auth/SignInWithGitHubButton";

export default function Header() {
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
          <ThemeToggleButton />
          <SignInWithGitHubButton />
        </div>
      </nav>
    </header>
  );
}
