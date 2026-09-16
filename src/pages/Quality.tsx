import { AppLayout } from "@/components/layout/AppLayout";
import { QualitySection } from "@/components/tracking/quality/QualitySection";

export default function Quality() {
  return (
    <AppLayout title="Quality" allowedRoles={["admin", "team_leader", "mentor", "community_moderator", "quality_team"]}>
      <div className="p-6 max-w-[1600px] mx-auto">
        <QualitySection />
      </div>
    </AppLayout>
  );
}
