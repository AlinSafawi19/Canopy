import crypto from "crypto";

export function createRequestSignature(
  payload: Record<string, unknown>,
  secret: string
): string {
  const sorted = Object.keys(payload)
    .sort()
    .map((k) => `${k}=${JSON.stringify(payload[k])}`)
    .join("&");

  return crypto
    .createHmac("sha256", secret)
    .update(sorted)
    .digest("hex");
}

export function verifyRequestSignature(
  payload: Record<string, unknown>,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createRequestSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export function createTimestampedSignature(
  payload: Record<string, unknown>,
  secret: string,
  timestamp: number = Date.now()
): { signature: string; timestamp: number } {
  const payloadWithTimestamp = { ...payload, ts: timestamp };
  const signature = createRequestSignature(payloadWithTimestamp, secret);
  return { signature, timestamp };
}

export function verifyTimestampedSignature(
  payload: Record<string, unknown>,
  signature: string,
  secret: string,
  maxAgeMs: number = 5 * 60 * 1000 // 5 minutes default
): boolean {
  const timestamp = (payload.ts as number) || 0;
  const now = Date.now();

  // Check age
  if (now - timestamp > maxAgeMs) {
    return false;
  }

  // Verify signature
  return verifyRequestSignature(payload, signature, secret);
}
