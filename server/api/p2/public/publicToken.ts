export function base64urlEncode(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function base64urlDecode(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64").toString("utf8");
}

export function makeResumeToken(payload: { v: 1; cartId: string; accessToken: string }) {
  return base64urlEncode(JSON.stringify(payload));
}

export function parseResumeToken(token: string): { v: number; cartId: string; accessToken: string } | null {
  try {
    const raw = base64urlDecode(token);
    const obj = JSON.parse(raw);
    if (!obj || obj.v !== 1 || !obj.cartId || !obj.accessToken) return null;
    return obj;
  } catch {
    return null;
  }
}
