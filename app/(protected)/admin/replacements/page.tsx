import { format, startOfWeek } from "date-fns";

import { ReplacementCensusAdminPanel } from "@/components/replacement-census/replacement-census-admin-panel";
import { getReplacementCensusAdminDashboard } from "@/services/replacement-census.service";

type AdminReplacementsPageProps = {
  searchParams?: Promise<{
    weekStart?: string;
  }>;
};

export default async function AdminReplacementsPage({
  searchParams
}: AdminReplacementsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedWeek = resolvedSearchParams?.weekStart
    ? new Date(`${resolvedSearchParams.weekStart}T12:00:00`)
    : new Date();
  const normalizedWeekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
  const dashboard = await getReplacementCensusAdminDashboard({
    weekStart: normalizedWeekStart
  });

  return (
    <ReplacementCensusAdminPanel
      selectedWeekStart={format(normalizedWeekStart, "yyyy-MM-dd")}
      availableWeeks={dashboard.availableWeeks.map((week) => ({
        id: week.id,
        label: week.label,
        startDate: week.startDate.toISOString().slice(0, 10)
      }))}
      census={dashboard.census}
      stats={dashboard.stats}
      responses={dashboard.responses}
    />
  );
}
