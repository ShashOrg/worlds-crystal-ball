import { headers as getHeaders } from "next/headers";

/**
 * Resolve origin from request headers.
 * - If headers are passed, use them.
 * - Otherwise, await next/headers() (Next 15 returns a Promise).
 */
export async function getRequestOrigin(init?: { headers?: Headers | ReadonlyHeaders }) {
    const h = init?.headers ?? await getHeaders();

    const proto =
        h.get("x-forwarded-proto") ??
        h.get("x-forwarded-protocol") ??
        "https";

    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) throw new Error("Host header missing");

    return `${proto}://${host}`;
}

/**
 * Builds a URL that stays on the same origin as the incoming request.
 */
export async function sameOrigin(path: string, init?: { headers?: Headers | ReadonlyHeaders }) {
    const origin = await getRequestOrigin(init);
    return new URL(path, origin);
}
