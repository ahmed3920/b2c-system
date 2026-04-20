import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Target } from "lucide-react";

const members = [
  { id: "T001", name: "Aisha Hassan", quality: 92 },
  { id: "T002", name: "Omar Khaled", quality: 78 },
  { id: "T003", name: "Lina Saeed", quality: 85 },
];

export default function TeamDetail() {
  const { id } = useParams();
  return (
    <AppLayout title={`Team · ${id}`} allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/teams"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Teams</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/action-plans"><Target className="h-4 w-4 mr-1" /> Team Action Plans</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { l: "Tutors", v: members.length },
            { l: "Avg. Quality", v: "85%" },
            { l: "Open Flags", v: 3 },
          ].map((s) => (
            <Card key={s.l}>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{s.l}</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{s.v}</div></CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Members</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Quality</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.id}</TableCell>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{m.quality}%</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/tutors/${m.id}`}>View</Link>
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
