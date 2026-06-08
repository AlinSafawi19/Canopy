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

export interface FieldStat {
  categoryId: string;
  categoryName: string;
  fieldName: string;
  filled: number;
  total: number;
  fillRate: number; // 0–1
}

export interface CategoryStaleness {
  categoryId: string;
  categoryName: string;
  staleCount: number;
  totalCount: number;
}

export interface EmptyCategory {
  id: string;
  name: string;
}

export interface ProblematicField {
  categoryId: string;
  categoryName: string;
  fieldName: string;
  fillRate: number; // 0–1
}

export interface HealthReport {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  completeness: {
    score: number;
    filledSlots: number;
    totalSlots: number;
    /** All fields with fill rate <1, sorted worst-first */
    partialFields: FieldStat[];
  };
  freshness: {
    score: number;
    freshEntries: number;
    staleEntries: number;
    totalEntries: number;
    staleByCategory: CategoryStaleness[];
  };
  coverage: {
    score: number;
    coveredCategories: number;
    totalCategories: number;
    emptyCategories: EmptyCategory[];
  };
  schemaHealth: {
    score: number;
    /** True when no category has ≥2 entries — score excluded from overall */
    insufficient: boolean;
    healthyFields: number;
    totalFields: number;
    problematicFields: ProblematicField[];
  };
}

const STALE_DAYS = 90;
const FILL_RATE_THRESHOLD = 0.3;
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
  const staleByCategory: CategoryStaleness[] = [];
  let totalSchemaFields = 0, healthySchemaFields = 0;
  const problematicFields: ProblematicField[] = [];
  const fieldFillMap = new Map<string, FieldStat>();

  for (const cat of categories) {
    const fields = (Array.isArray(cat.fields) ? cat.fields : []) as unknown as Field[];
    const scorable = fields.filter((f) => f.type !== "count");
    const entries = cat.entries;

    // ── Coverage ─────────────────────────────────────────────
    if (entries.length > 0) coveredCategories++;
    else emptyCategories.push({ id: cat.id, name: cat.name });

    // ── Freshness ────────────────────────────────────────────
    let catStale = 0;
    for (const entry of entries) {
      if ((entry.updatedAt as Date) >= staleThreshold) freshEntries++;
      else { staleEntries++; catStale++; }
    }
    if (catStale > 0) {
      staleByCategory.push({ categoryId: cat.id, categoryName: cat.name, staleCount: catStale, totalCount: entries.length });
    }

    // ── Completeness (per field) ─────────────────────────────
    for (const f of scorable) {
      const key = `${cat.id}|${f.name}`;
      let stat = fieldFillMap.get(key);
      if (!stat) {
        stat = { categoryId: cat.id, categoryName: cat.name, fieldName: f.name, filled: 0, total: 0, fillRate: 0 };
        fieldFillMap.set(key, stat);
      }
      for (const entry of entries) {
        const vals = (entry.values ?? {}) as Record<string, unknown>;
        totalSlots++;
        stat.total++;
        if (!isEmptyValue(vals[f.name])) { filledSlots++; stat.filled++; }
      }
      stat.fillRate = stat.total === 0 ? 1 : stat.filled / stat.total;
    }

    // ── Schema Health (cats with ≥2 entries) ─────────────────
    if (entries.length >= MIN_ENTRIES_FOR_SCHEMA_CHECK) {
      for (const f of scorable) {
        totalSchemaFields++;
        const filled = entries.filter((e) => {
          const v = ((e.values ?? {}) as Record<string, unknown>)[f.name];
          return !isEmptyValue(v);
        }).length;
        const rate = filled / entries.length;
        if (rate >= FILL_RATE_THRESHOLD) healthySchemaFields++;
        else problematicFields.push({ categoryId: cat.id, categoryName: cat.name, fieldName: f.name, fillRate: rate });
      }
    }
  }

  const totalEntries = freshEntries + staleEntries;
  const completenessScore = totalSlots === 0 ? 100 : clamp100((filledSlots / totalSlots) * 100);
  const freshnessScore    = totalEntries === 0 ? 100 : clamp100((freshEntries / totalEntries) * 100);
  const coverageScore     = clamp100((coveredCategories / categories.length) * 100);
  const schemaInsufficient = totalSchemaFields === 0;
  const schemaHealthScore  = schemaInsufficient ? 0 : clamp100((healthySchemaFields / totalSchemaFields) * 100);

  const scoreComponents = [completenessScore, freshnessScore, coverageScore];
  if (!schemaInsufficient) scoreComponents.push(schemaHealthScore);
  const score = clamp100(scoreComponents.reduce((a, b) => a + b, 0) / scoreComponents.length);

  const partialFields = [...fieldFillMap.values()]
    .filter((s) => s.fillRate < 1)
    .sort((a, b) => a.fillRate - b.fillRate);

  return {
    score,
    grade: gradeFromScore(score),
    completeness: { score: completenessScore, filledSlots, totalSlots, partialFields },
    freshness:    { score: freshnessScore, freshEntries, staleEntries, totalEntries, staleByCategory },
    coverage:     { score: coverageScore, coveredCategories, totalCategories: categories.length, emptyCategories },
    schemaHealth: {
      score: schemaHealthScore,
      insufficient: schemaInsufficient,
      healthyFields: healthySchemaFields,
      totalFields: totalSchemaFields,
      problematicFields: problematicFields.sort((a, b) => a.fillRate - b.fillRate),
    },
  };
}
