import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Eye, Users } from "lucide-react";

const teams = [
  { id: "team-a", name: "Team A", leader: "Ahmed Salah", tutors: 24, quality: 88 },
  { id: "team-b", name: "Team B", leader: "Mariam Fouad", tutors: 19, quality: 81 },
  { id: "team-c", name: "Team C", leader: "Youssef Adel", tutors: 31, quality: 76 },
  { id: "team-d", name: "Team D", leader: "Salma Nabil", tutors: 22, quality: 90 },
];

export default function Teams() {
  return (
    <AppLayout title="Teams" allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t) => (
            <Card key={t.id} className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{t.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Leader: {t.leader}</p>
                </div>
                <Users className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tutors</span>
                  <Badge variant="secondary">{t.tutors}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Avg. Quality</span>
                  <span className="font-semibold">{t.quality}%</span>
                </div>
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <Link to={`/teams/${t.id}`}><Eye className="h-4 w-4 mr-1" /> View Team</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
