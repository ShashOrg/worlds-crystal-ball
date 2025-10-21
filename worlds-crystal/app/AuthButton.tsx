"use client";

import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") return <div>Loading…</div>;

  if (!session) {
    return (
      <button
        onClick={() => signIn("github")}
        className="border-base rounded px-3 py-1 bg-card text-sm transition-colors hover:bg-card/90"
      >
        Sign in with GitHub
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {session.user?.image && (
        <Image
          src={session.user.image}
          alt={session.user.name ?? "User"}
          width={24}
          height={24}
          className="h-6 w-6 rounded-full"
        />
      )}
      <span className="text-sm">{session.user?.name ?? "User"}</span>
      <button
        onClick={() => signOut()}
        className="border-base rounded px-3 py-1 bg-card text-sm transition-colors hover:bg-card/90"
      >
        Sign out
      </button>
    </div>
  );
}
