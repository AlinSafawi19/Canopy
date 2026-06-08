import { prisma } from "@/lib/prisma";

interface Field {
  name: string;
  type: string;
}

function isEmptyValue(v: unknown): boolean {
  if (Array.isArray(v)) return v.length === 0;
  return v === undefined || v === null || v === "";
}

function clamp100(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function gradeFromScore(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

export interface ProblematicField {
  categoryName: string;
  fieldName: string;
  fillRate: number; // 0–1
}

export interface EmptyCategory {
  id: string;
  name: string;
}

export interface HealthReport {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  completeness: {
    score: number;
    filledSlots: number;
    totalSlots: number;
  };
  freshness: {
    score: number;
    freshEntries: number;
    staleEntries: number;
    totalEntries: number;
  };
  coverage: {
    score: number;
    coveredCategories: number;
    totalCategories: number;
    emptyCategories: EmptyCategory[];
  };
  schemaHealth: {
    score: number;
    healthyFields: number;
    totalFields: number;
    problematicFields: ProblematicField[];
  };
}

const STALE_DAYS = 90;
const FILL_RATE_THRESHOLD = 0.3; // fields below this are "consistently skipped"
const MIN_ENTRIES_FOR_SCHEMA_CHECK = 2;

export async function computeProjectHealth(projectId: string): Promise<HealthReport | null> {
  const categories = await prisma.contentCategory.findMany({
    where: { projectId, archivedAt: null },
    select: {
      id: true,
      name: true,
      fields: true,
      entries: {
        where: { archivedAt: null },
        select: { values: true, updatedAt: true },
      },
    },
  });

  if (categories.length === 0) return null;

  const staleThreshold = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  let filledSlots = 0, totalSlots = 0;
  let freshEntries = 0, staleEntries = 0;
  let coveredCategories = 0;
  const emptyCategories: EmptyCategory[] = [];
  let totalSchemaFields = 0, healthySchemaFields = 0;
  const problematicFields: ProblematicField[] = [];

  for (const cat of categories) {
    const fields = (Array.isArray(cat.fields) ? cat.fields : []) as unknown as Field[];
    const scorable = fields.filter((f) => f.type !== "count");
    const entries = cat.entries;

    // ── Coverage ──────────────────────────────────────────────
    if (entries.length > 0) coveredCategories++;
    else emptyCategories.push({ id: cat.id, name: cat.name });

    // ── Freshness + Completeness ───────────────────────────────
    for (const entry of entries) {
      (entry.updatedAt as Date) >= staleThreshold ? freshEntries++ : staleEntries++;

      const vals = (entry.values ?? {}) as Record<string, unknown>;
      for (const f of scorable) {
        totalSlots++;
        if (!isEmptyValue(vals[f.name])) filledSlots++;
      }
    }

    // ── Schema Health (only categories with enough entries) ─────
    if (entries.length >= MIN_ENTRIES_FOR_SCHEMA_CHECK) {
      for (const f of scorable) {
        totalSchemaFields++;
        const filled = entries.filter((e) => {
          const v = ((e.values ?? {}) as Record<string, unknown>)[f.name];
          return !isEmptyValue(v);
        }).length;
        const rate = filled / entries.length;
        if (rate >= FILL_RATE_THRESHOLD) {
          healthySchemaFields++;
        } else {
          problematicFields.push({ categoryName: cat.name, fieldName: f.name, fillRate: rate });
        }
      }
    }
  }

  const totalEntries = freshEntries + staleEntries;

  const completenessScore = totalSlots === 0 ? 100 : clamp100((filledSlots / totalSlots) * 100);
  const freshnessScore    = totalEntries === 0 ? 100 : clamp100((freshEntries / totalEntries) * 100);
  const coverageScore     = clamp100((coveredCategories / categories.length) * 100);
  const schemaHealthScore = totalSchemaFields === 0 ? 100 : clamp100((healthySchemaFields / totalSchemaFields) * 100);

  const score = clamp100((completenessScore + freshnessScore + coverageScore + schemaHealthScore) / 4);

  return {
    score,
    grade: gradeFromScore(score),
    completeness: { score: completenessScore, filledSlots, totalSlots },
    freshness:    { score: freshnessScore, freshEntries, staleEntries, totalEntries },
    coverage:     { score: coverageScore, coveredCategories, totalCategories: categories.length, emptyCategories },
    schemaHealth: { score: schemaHealthScore, healthyFields: healthySchemaFields, totalFields: totalSchemaFields, problematicFields },
  };
}
