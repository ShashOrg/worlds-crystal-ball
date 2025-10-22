"use client";

import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/Button";

export function ProviderButtons() {
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="primary"
        onClick={() => signIn("github")}
        aria-label="Sign in with GitHub"
        className="gap-2"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4">
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
          />
        </svg>
        Continue with GitHub
      </Button>

      <Button
        variant="secondary"
        onClick={() => signIn("google")}
        aria-label="Sign in with Google"
        className="gap-2"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            fill="currentColor"
            d="M21.35 11.1h-9.18v2.98h5.27c-.23 1.33-1.59 3.9-5.27 3.9a6.09 6.09 0 1 1 0-12.18 5.29 5.29 0 0 1 3.73 1.46l2.55-2.46A8.9 8.9 0 0 0 12.17 2a10.09 10.09 0 1 0 0 20.18c5.81 0 9.64-4.09 9.64-9.85 0-.66-.07-1.15-.16-1.64Z"
          />
        </svg>
        Continue with Google
      </Button>
    </div>
  );
}
