export const LIMITS = {
  // User fields (kept in sync with validation.ts)
  DISPLAY_NAME: 50,
  EMAIL: 255,
  USERNAME: 30,
  PASSWORD_MAX: 72,

  // Project
  PROJECT_NAME: 100,
  PROJECT_SLUG: 100,
  PROJECT_DESCRIPTION: 2000,
  PROJECT_SHORT_DESCRIPTION: 200,
  PROJECT_INDUSTRY: 100,
  PROJECT_ROLE: 100,
  PROJECT_TEAM_SIZE: 20,
  PROJECT_DOMAIN: 255,
  PROJECT_HOST: 100,
  PROJECT_LIVE_URL: 500,
  PROJECT_GITHUB_URL: 500,
  CATEGORY_PREVIEW_URL: 500,
  PROJECT_IMAGE_BG: 500,
  PROJECT_VIDEO_BG: 500,
  PROJECT_COVER_IMAGE_ALT: 200,

  // Category
  CATEGORY_NAME: 100,
  CATEGORY_SLUG: 100,
  CATEGORY_DESCRIPTION: 500,

  // API Key
  API_KEY_NAME: 100,

  // Entry field values by type
  ENTRY_TEXT: 500,
  ENTRY_TEXTAREA: 5000,
  ENTRY_URL: 500,
  ENTRY_EMAIL: 255,
} as const;

/** Returns an error string if value exceeds max, otherwise null. */
export function maxLen(value: unknown, max: number, label: string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > max) return `${label} must be ${max} characters or fewer.`;
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates entry values against their category field types. Returns first error or null. */
export function validateEntryValues(
  values: Record<string, unknown> | null | undefined,
  fields: Array<{ name: string; type: string; options?: string[] }>,
): string | null {
  if (!values || !Array.isArray(fields)) return null;
  for (const field of fields) {
    if (field.type === "relation") continue;
    const v = values[field.name];
    if (typeof v !== "string") continue;
    if (field.type === "enum" && v && Array.isArray(field.options) && field.options.length > 0) {
      if (!field.options.includes(v)) {
        return `"${field.name}" must be one of: ${field.options.join(", ")}.`;
      }
    }
    if (field.type === "email" && v.trim() && !EMAIL_RE.test(v.trim())) {
      return `"${field.name}" must be a valid email address.`;
    }
    const limits: Record<string, number> = {
      text: LIMITS.ENTRY_TEXT,
      textarea: LIMITS.ENTRY_TEXTAREA,
      url: LIMITS.ENTRY_URL,
      email: LIMITS.ENTRY_EMAIL,
    };
    const max = limits[field.type];
    if (max !== undefined && v.length > max) {
      return `"${field.name}" must be ${max} characters or fewer.`;
    }
  }
  return null;
}
