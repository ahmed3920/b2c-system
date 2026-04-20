import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Eye } from "lucide-react";
import { Link } from "react-router-dom";

const mockTutors = [
  { id: "T001", name: "Aisha Hassan", team: "Team A", quality: 92, status: "Active" },
  { id: "T002", name: "Omar Khaled", team: "Team B", quality: 78, status: "Active" },
  { id: "T003", name: "Lina Saeed", team: "Team A", quality: 85, status: "On Leave" },
  { id: "T004", name: "Yousef Adel", team: "Team C", quality: 67, status: "Flagged" },
  { id: "T005", name: "Mona Tarek", team: "Team B", quality: 95, status: "Active" },
  { id: "T006", name: "Khalid Nour", team: "Team C", quality: 71, status: "Active" },
];

const statusVariant = (s: string) =>
  s === "Active" ? "default" : s === "Flagged" ? "destructive" : "secondary";

export default function Tutors() {
  return (
    <AppLayout title="Tutors" allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
            <CardTitle>All Tutors</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search tutors…" className="pl-8" />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockTutors.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.id}</TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.team}</TableCell>
                    <TableCell>{t.quality}%</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(t.status) as any}>{t.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/tutors/${t.id}`}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
