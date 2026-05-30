import crypto from "crypto";

export function hashApiKey(key: string): string {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET!)
    .update(key)
    .digest("hex");
}
