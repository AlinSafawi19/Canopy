const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateUsername(value: unknown): string | null {
  if (typeof value !== "string" || !value) return "Username is required.";
  if (!USERNAME_RE.test(value))
    return "Username must be 3–30 characters: lowercase letters, numbers, and underscores only.";
  return null;
}

export function validatePassword(value: unknown): string | null {
  if (typeof value !== "string" || !value) return "Password is required.";
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (value.length > 72) return "Password must be no more than 72 characters.";
  return null;
}

export function validateEmail(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return "Email is required.";
  if (value.trim().length > 255) return "Email must be 255 characters or fewer.";
  if (!EMAIL_RE.test(value.trim())) return "Invalid email address.";
  return null;
}

export function validateDisplayName(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return "Display name is required.";
  if (value.trim().length < 2) return "Display name must be at least 2 characters.";
  if (value.trim().length > 50) return "Display name must be no more than 50 characters.";
  return null;
}

export function firstError(...errors: (string | null)[]): string | null {
  return errors.find((e) => e !== null) ?? null;
}
