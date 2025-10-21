"use client";

import { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

const buttonClassName =
  "inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 " +
  "shadow-sm hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 active:bg-neutral-200 " +
  "disabled:cursor-not-allowed disabled:opacity-70 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800";

export default function SignInWithGitHubButton() {
  const { data: session, status } = useSession();
  const [busy, setBusy] = useState(false);

  if (status === "loading") {
    return (
      <button type="button" className={buttonClassName} disabled>
        Loading…
      </button>
    );
  }

  if (session?.user) {
    return (
      <button
        type="button"
        onClick={async () => {
          setBusy(true);
          try {
            await signOut({ callbackUrl: "/" });
          } finally {
            setBusy(false);
          }
        }}
        className={buttonClassName}
        disabled={busy}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        setBusy(true);
        try {
          await signIn("github", { callbackUrl: "/" });
        } finally {
          setBusy(false);
        }
      }}
      className={buttonClassName}
      disabled={busy}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4">
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
        />
      </svg>
      {busy ? "Signing in…" : "Sign in with GitHub"}
    </button>
  );
}
