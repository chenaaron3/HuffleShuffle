export const DASHBOARD_PAGE_SIZE = 25;

export const DASHBOARD_TABS = ["waitlist", "players", "hands"] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export function parseDashboardTab(value: string | string[] | undefined): DashboardTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && DASHBOARD_TABS.includes(raw as DashboardTab)) {
    return raw as DashboardTab;
  }
  return "waitlist";
}
