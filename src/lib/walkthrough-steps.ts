import { type SessionRole } from "@/lib/auth";

export interface WalkthroughStep {
  id: string;
  page: string;
  target?: string; // CSS selector matching data-wt attribute
  title: string;
  description: string;
}

const ownerSteps: WalkthroughStep[] = [
  {
    id: "owner-dashboard",
    page: "/owner/dashboard",
    target: "[data-wt='stat-cards']",
    title: "Your command center",
    description:
      "These stats give you a live snapshot of the entire platform — every admin workspace, project, client, and contributor in one place.",
  },
  {
    id: "owner-create-admin",
    page: "/owner/admins",
    target: "[data-wt='create-admin-btn']",
    title: "Create your first admin workspace",
    description:
      "Each admin gets their own fully isolated workspace — with their own projects, clients, contributors, and API keys. Click 'New Admin' to create one.",
  },
  {
    id: "owner-settings",
    page: "/owner/settings/profile",
    target: "[data-wt='settings-nav']",
    title: "Your account settings",
    description:
      "Update your profile, change your password, verify your email, enable two-factor authentication, and adjust the app appearance — all from here.",
  },
];

const adminSteps: WalkthroughStep[] = [
  {
    id: "admin-dashboard",
    page: "/admin/dashboard",
    target: "[data-wt='stat-cards']",
    title: "Your workspace at a glance",
    description:
      "Track your projects, clients, and contributors from this dashboard. Everything in your workspace lives here.",
  },
  {
    id: "admin-create-project",
    page: "/admin/projects",
    target: "[data-wt='create-project-btn']",
    title: "Create your first project",
    description:
      "Projects are the top-level containers for your content. Inside each project you define categories that structure the entries your contributors create.",
  },
  {
    id: "admin-settings",
    page: "/admin/settings/profile",
    target: "[data-wt='settings-nav']",
    title: "Your account settings",
    description:
      "Update your profile, change your password, verify your email, enable two-factor authentication, and adjust the app appearance — all from here.",
  },
];

const clientSteps: WalkthroughStep[] = [
  {
    id: "client-dashboard",
    page: "/client/dashboard",
    target: "[data-wt='stat-cards']",
    title: "Your project portal",
    description:
      "This is your workspace. Browse your assigned projects, review content your contributors are building, and pull it via API.",
  },
  {
    id: "client-settings",
    page: "/client/settings/profile",
    target: "[data-wt='settings-nav']",
    title: "Your account settings",
    description:
      "Update your profile, change your password, verify your email, enable two-factor authentication, and adjust the app appearance — all from here.",
  },
];

const contributorSteps: WalkthroughStep[] = [
  {
    id: "contributor-dashboard",
    page: "/contributor/dashboard",
    target: "[data-wt='stat-cards']",
    title: "Your assignments",
    description:
      "You've been assigned to one or more projects. Navigate to a project to start creating and managing content entries.",
  },
  {
    id: "contributor-settings",
    page: "/contributor/settings/profile",
    target: "[data-wt='settings-nav']",
    title: "Your account settings",
    description:
      "Update your profile, change your password, verify your email, enable two-factor authentication, and adjust the app appearance — all from here.",
  },
];

export function getWalkthroughSteps(role: SessionRole): WalkthroughStep[] {
  switch (role) {
    case "owner": return ownerSteps;
    case "admin": return adminSteps;
    case "client": return clientSteps;
    case "contributor": return contributorSteps;
  }
}
