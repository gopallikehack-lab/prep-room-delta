const VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: unknown,
  remoteIp?: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("turnstile: TURNSTILE_SECRET_KEY is not set");
    return false;
  }
  if (typeof token !== "string" || token.length === 0) {
    return false;
  }

  try {
    const body = new URLSearchParams();
    body.append("secret", secret);
    body.append("response", token);
    if (remoteIp) body.append("remoteip", remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
    });

    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("turnstile: verify request failed", err);
    return false;
  }
}

export function getClientIp(req: Request): string | undefined {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    undefined
  );
}
