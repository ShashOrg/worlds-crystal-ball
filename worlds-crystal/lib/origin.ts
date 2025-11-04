import { headers as getHeaders } from "next/headers";

// minimal shape shared by Headers/ReadonlyHeaders
type HeaderGetter = { get(name: string): string | null | undefined };

/**
 * Resolve origin from request headers.
 * - If headers are passed, use them.
 * - Otherwise, await next/headers() (Next 15 returns a Promise).
 */
export async function getRequestOrigin(init?: { headers?: Headers | HeaderGetter }) {
    const h: HeaderGetter = (init?.headers as HeaderGetter) ?? (await getHeaders());

    const proto =
        h.get("x-forwarded-proto") ??
        h.get("x-forwarded-protocol") ??
        "https";

    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) throw new Error("Host header missing");

    return `${proto}://${host}`;
}

/**
 * Convenience for route handlers
 */
export async function getRequestOriginFromRequest(req: Request) {
    return getRequestOrigin({ headers: req.headers });
}

/**
 * Builds a URL that stays on the same origin as the incoming request.
 */
export async function sameOrigin(path: string, init?: { headers?: Headers | HeaderGetter }) {
    const origin = await getRequestOrigin(init);
    return new URL(path, origin);
}
