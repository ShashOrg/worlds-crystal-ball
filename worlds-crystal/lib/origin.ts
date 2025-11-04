import { headers } from "next/headers";

/**
 * Gets the current request origin reliably in App Router.
 * Use ONLY on the server (route handlers, server actions, RSC).
 */
export function getRequestOrigin() {
    const h = headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) throw new Error("Host header missing");
    return `${proto}://${host}`;
}

/**
 * Builds a URL that stays on the same origin as the incoming request.
 */
export function sameOrigin(path: string) {
    const origin = getRequestOrigin();
    return new URL(path, origin);
}
