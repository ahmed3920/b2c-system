import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Target } from "lucide-react";

const ranking = [
  { rank: 1, name: "Mona Tarek", score: 95 },
  { rank: 2, name: "Aisha Hassan", score: 92 },
  { rank: 3, name: "Lina Saeed", score: 85 },
  { rank: 4, name: "Omar Khaled", score: 78 },
];

const trainings = [
  { name: "Onboarding", enrolled: 32, completed: 28 },
  { name: "Advanced Tutoring", enrolled: 18, completed: 9 },
  { name: "CS Handling", enrolled: 25, completed: 20 },
];

export default function Growth() {
  return (
    <AppLayout title="Growth" allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <Tabs defaultValue="ranking">
          <TabsList>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
          </TabsList>

          <TabsContent value="ranking">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Top Performers</CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/action-plans"><Target className="h-4 w-4 mr-1" /> Action Plans</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Rank</TableHead><TableHead>Name</TableHead><TableHead>Score</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {ranking.map((r) => (
                      <TableRow key={r.rank}>
                        <TableCell><Badge>{r.rank}</Badge></TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.score}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="training">
            <Card>
              <CardHeader><CardTitle>Training Programs</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Program</TableHead><TableHead>Enrolled</TableHead><TableHead>Completed</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {trainings.map((t) => (
                      <TableRow key={t.name}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>{t.enrolled}</TableCell>
                        <TableCell>{t.completed}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
