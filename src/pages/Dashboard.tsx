import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Smile, Flag, Users, ArrowUpRight, ClipboardList, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { AnnouncementsSection } from "@/components/announcements/AnnouncementsSection";

const kpis = [
  { label: "Quality Score", value: "87.3%", delta: "+2.1%", icon: Award, tone: "text-success" },
  { label: "Satisfaction Rate", value: "4.6 / 5", delta: "+0.2", icon: Smile, tone: "text-info" },
  { label: "Active Flags", value: "12", delta: "-3", icon: Flag, tone: "text-destructive" },
  { label: "Tutors Count", value: "248", delta: "+14", icon: Users, tone: "text-primary" },
];

const recentActivity = [
  { who: "Sarah K.", what: "Quality review completed", when: "2h ago" },
  { who: "Team A", what: "3 new flags raised", when: "5h ago" },
  { who: "Mohammed R.", what: "Action plan resolved", when: "1d ago" },
  { who: "Team C", what: "Training session logged", when: "1d ago" },
];

export default function Dashboard() {
  return (
    <AppLayout title="Dashboard" allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <Card key={k.label} className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
                <k.icon className={`h-4 w-4 ${k.tone}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{k.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className={k.tone}>{k.delta}</span> vs last month
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <AnnouncementsSection />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {recentActivity.map((a, i) => (
                  <li key={i} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{a.who}</p>
                      <p className="text-xs text-muted-foreground">{a.what}</p>
                    </div>
                    <Badge variant="secondary">{a.when}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
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
      </div>
    </AppLayout>
  );
}
