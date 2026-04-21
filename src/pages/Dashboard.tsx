import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flag, ArrowUpRight, ClipboardList, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { AnnouncementsSection } from "@/components/announcements/AnnouncementsSection";
import { ProductUpdatesSection } from "@/components/feature-plans/ProductUpdatesSection";

export default function Dashboard() {
  return (
    <AppLayout title="Dashboard" allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <AnnouncementsSection />

        <ProductUpdatesSection />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button variant="outline" className="justify-between" asChild>
              <Link to="/action-plans">
                <span className="flex items-center gap-2"><Target className="h-4 w-4" />Action Plans</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="justify-between" asChild>
              <Link to="/tasks">
                <span className="flex items-center gap-2"><ClipboardList className="h-4 w-4" />Task Tracker</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="justify-between" asChild>
              <Link to="/risk-control">
                <span className="flex items-center gap-2"><Flag className="h-4 w-4" />Risk Control</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
