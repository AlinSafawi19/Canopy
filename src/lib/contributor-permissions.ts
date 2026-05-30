export const DEFAULT_CONTRIBUTOR_PERMISSIONS = {
  canViewContent: true,
  canCreateEntries: false,
  canEditEntries: false,
  canDeleteEntries: false,
};

export type ContributorPermissions = typeof DEFAULT_CONTRIBUTOR_PERMISSIONS;

export const PERMISSION_LABELS: Record<keyof ContributorPermissions, string> = {
  canViewContent: "View Content",
  canCreateEntries: "Create Entries",
  canEditEntries: "Edit Entries",
  canDeleteEntries: "Delete Entries",
};

export function parsePermissions(raw: unknown): ContributorPermissions {
  const base: ContributorPermissions =
    typeof raw === "object" && raw !== null
      ? { ...DEFAULT_CONTRIBUTOR_PERMISSIONS, ...(raw as Partial<ContributorPermissions>) }
      : { ...DEFAULT_CONTRIBUTOR_PERMISSIONS };
  base.canViewContent = true;
  return base;
}
