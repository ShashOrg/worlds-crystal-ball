"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthButton() {
    const { data: session, status } = useSession();

    if (status === "loading") return <div>Loading…</div>;

    if (!session) {
        return (
            <button
                onClick={() => signIn("github")}
                className="border rounded px-3 py-1 hover:bg-gray-50"
            >
                Sign in with GitHub
            </button>
        );
    }

    return (
        <div className="flex items-center gap-2">
            {session.user?.image && (
                <img
                    src={session.user.image}
                    alt={session.user.name ?? "User"}
                    className="w-6 h-6 rounded-full"
                />
            )}
            <span className="text-sm">{session.user?.name ?? "User"}</span>
            <button
                onClick={() => signOut()}
                className="border rounded px-3 py-1 hover:bg-gray-50"
            >
                Sign out
            </button>
        </div>
    );
}
