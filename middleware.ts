import { NextResponse, NextRequest } from "next/server";

// ── In-memory rate limiter (swap for Upstash Redis in prod) ──
const RATE_LIMIT = new Map<string, number[]>();
const MAX_REQUESTS = 60;
const WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (RATE_LIMIT.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  RATE_LIMIT.set(ip, hits);
  return hits.length > MAX_REQUESTS;
}

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "media-src 'self' blob:",
    "connect-src 'self' https://challenges.cloudflare.com https://*.supabase.co wss://*.supabase.co",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(self), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export function middleware(req: NextRequest) {
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";

  if (isRateLimited(ip)) {
    return new NextResponse("Too many requests. Please slow down.", {
      status: 429,
      headers: SECURITY_HEADERS,
    });
  }

  const BAD_PATHS = [/\.(php|asp|aspx|jsp)$/i, /wp-admin/i, /\.env/i, /\.git/i];
  if (BAD_PATHS.some((re) => re.test(req.nextUrl.pathname))) {
    return new NextResponse("Not found.", { status: 403, headers: SECURITY_HEADERS });
  }

  const res = NextResponse.next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
