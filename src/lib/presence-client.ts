// Pure client-safe utilities — no server dependencies

const COLORS = ["#3B82F6","#10B981","#8B5CF6","#EF4444","#F59E0B","#06B6D4","#EC4899","#F97316"];

export function presenceColor(userId: string): string {
  let h = 0;
  for (const c of userId) h = ((h * 31) + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function presenceInitials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}
