import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Target, ClipboardList } from "lucide-react";

const abusers = [
  { id: "T009", name: "Hassan Ali", reason: "Repeated lateness", flags: 4 },
  { id: "T014", name: "Yara Mostafa", reason: "Leaves abuse", flags: 3 },
  { id: "T021", name: "Tarek Magdy", reason: "CS complaints", flags: 5 },
];

const flags = [
  { type: "Quality", count: 7, severity: "high" },
  { type: "Communication", count: 4, severity: "medium" },
  { type: "Leaves Abuse", count: 3, severity: "high" },
  { type: "No-show", count: 2, severity: "medium" },
];

export default function RiskControl() {
  return (
    <AppLayout title="Risk Control" allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <Tabs defaultValue="abusers">
          <TabsList>
            <TabsTrigger value="abusers">Abusers List</TabsTrigger>
            <TabsTrigger value="flags">Flags Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="abusers">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <CardTitle>Abusers</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/action-plans"><Target className="h-4 w-4 mr-1" /> Open Action Plans</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/tasks"><ClipboardList className="h-4 w-4 mr-1" /> Assign Task</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Reason</TableHead><TableHead>Flags</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {abusers.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.id}</TableCell>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell className="text-muted-foreground">{a.reason}</TableCell>
                        <TableCell><Badge variant="destructive">{a.flags}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" asChild>
                            <Link to={`/tutors/${a.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="flags">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {flags.map((f) => (
                <Card key={f.type}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">{f.type}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{f.count}</div>
                    <Badge variant={f.severity === "high" ? "destructive" : "secondary"} className="mt-2">
                      {f.severity}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
