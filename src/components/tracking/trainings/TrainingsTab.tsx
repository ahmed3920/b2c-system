import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Edit,
  FileText,
  Film,
  Filter,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useTrainings, type Training } from "@/hooks/useTrainings";
import { AddTrainingDialog } from "./AddTrainingDialog";
import { TrainingDetailsDialog } from "./TrainingDetailsDialog";
import { TrainingsInsights } from "./TrainingsInsights";

export function TrainingsTab() {
  const { isAdmin, isTeamLeader } = useUserRole();
  const { items, isLoading, remove } = useTrainings();
  const canManage = isAdmin || isTeamLeader;

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Training | null>(null);
  const [viewing, setViewing] = useState<Training | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [creatorTypeF, setCreatorTypeF] = useState<string>("all");
  const [subTeamF, setSubTeamF] = useState<string>("all");
  const [conductedByF, setConductedByF] = useState<string>("all");
  const [hasMaterial, setHasMaterial] = useState<string>("all");
  const [hasRecord, setHasRecord] = useState<string>("all");
  const [search, setSearch] = useState("");

  const allSubTeams = useMemo(() => {
    const s = new Set<string>();
    items.forEach((t) => t.sub_teams?.forEach((x) => s.add(x)));
    return Array.from(s).sort();
  }, [items]);

  const allConductors = useMemo(() => {
    const s = new Map<string, string>();
    items.forEach((t) => t.conducted_by?.forEach((p) => s.set(p.id, p.name)));
    return Array.from(s.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (from && t.training_date < format(from, "yyyy-MM-dd")) return false;
      if (to && t.training_date > format(to, "yyyy-MM-dd")) return false;
      if (creatorTypeF !== "all" && t.creator_type !== creatorTypeF) return false;
      if (subTeamF !== "all" && !(t.sub_teams ?? []).includes(subTeamF)) return false;
      if (conductedByF !== "all" && !(t.conducted_by ?? []).find((p) => p.id === conductedByF)) return false;
      const hasMat = (t.material_urls?.length ?? 0) > 0;
      const hasRec = (t.record_urls?.length ?? 0) > 0;
      if (hasMaterial === "yes" && !hasMat) return false;
      if (hasMaterial === "no" && hasMat) return false;
      if (hasRecord === "yes" && !hasRec) return false;
      if (hasRecord === "no" && hasRec) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inText =
          t.title.toLowerCase().includes(q) ||
          t.creator_name.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q) ||
          (t.conducted_by ?? []).some((p) => p.name.toLowerCase().includes(q));
        if (!inText) return false;
      }
      return true;
    });
  }, [items, from, to, creatorTypeF, subTeamF, conductedByF, hasMaterial, hasRecord, search]);

  function clearFilters() {
    setFrom(undefined);
    setTo(undefined);
    setCreatorTypeF("all");
    setSubTeamF("all");
    setConductedByF("all");
    setHasMaterial("all");
    setHasRecord("all");
    setSearch("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInsights((v) => !v)}
          >
            {showInsights ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            Insights
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-4 w-4 mr-1" /> Filters
          </Button>
        </div>
        {canManage && (
          <Button onClick={() => { setEditing(null); setShowAdd(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Training
          </Button>
        )}
      </div>

      {showInsights && <TrainingsInsights items={filtered} />}

      {showFilters && (
        <Card>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">From date</Label>
              <DatePickerField value={from} onChange={setFrom} />
            </div>
            <div>
              <Label className="text-xs">To date</Label>
              <DatePickerField value={to} onChange={setTo} />
            </div>
            <div>
              <Label className="text-xs">Sub-Team</Label>
              <Select value={subTeamF} onValueChange={setSubTeamF}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All</SelectItem>
                  {allSubTeams.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Conducted By</Label>
              <Select value={conductedByF} onValueChange={setConductedByF}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All</SelectItem>
                  {allConductors.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Creator Type</Label>
              <Select value={creatorTypeF} onValueChange={setCreatorTypeF}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="team_leader">Team Leader</SelectItem>
                  <SelectItem value="mentor">Mentor</SelectItem>
                  <SelectItem value="tutor">Tutor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Has Material</Label>
              <Select value={hasMaterial} onValueChange={setHasMaterial}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Has Record</Label>
              <Select value={hasRecord} onValueChange={setHasRecord}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="p-3 border-b">
            <Input
              placeholder="Search title, trainer, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Conducted By</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Sub-Team</TableHead>
                  <TableHead>Files</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={canManage ? 7 : 6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={canManage ? 7 : 6} className="text-center text-muted-foreground py-8">No trainings found.</TableCell></TableRow>
                ) : (
                  filtered.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setViewing(t)}
                    >
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(parseISO(t.training_date), "MMM d, yyyy")}
                        <span className="text-xs text-muted-foreground ml-1">
                          {t.training_time?.slice(0, 5)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {t.conducted_by.slice(0, 2).map((p) => (
                            <Badge key={p.id} variant="secondary" className="text-[10px]">{p.name}</Badge>
                          ))}
                          {t.conducted_by.length > 2 && (
                            <Badge variant="outline" className="text-[10px]">+{t.conducted_by.length - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {t.creator_type.replace("_", " ")}
                        </Badge>
                        <div className="text-xs text-muted-foreground">{t.creator_name}</div>
                      </TableCell>
                      <TableCell>
                        {t.sub_teams.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Whole team</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {t.sub_teams.slice(0, 2).map((s) => (
                              <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                            ))}
                            {t.sub_teams.length > 2 && (
                              <Badge variant="outline" className="text-[10px]">+{t.sub_teams.length - 2}</Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          {(t.material_urls?.length ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5 text-xs"><FileText className="h-3.5 w-3.5" /> {t.material_urls.length}</span>
                          )}
                          {(t.record_urls?.length ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5 text-xs"><Film className="h-3.5 w-3.5" /> {t.record_urls.length}</span>
                          )}
                          {!(t.material_urls?.length ?? 0) && !(t.record_urls?.length ?? 0) && (
                            <span className="text-xs">—</span>
                          )}
                        </div>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setShowAdd(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AddTrainingDialog open={showAdd} onOpenChange={setShowAdd} editing={editing} />
      <TrainingDetailsDialog training={viewing} open={!!viewing} onOpenChange={(o) => !o && setViewing(null)} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete training?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteId) await remove(deleteId);
                setDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DatePickerField({ value, onChange }: { value?: Date; onChange: (d?: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("w-full justify-start font-normal", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="h-4 w-4 mr-2" />
          {value ? format(value, "PP") : "Any"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className={cn("p-3 pointer-events-auto")} />
      </PopoverContent>
    </Popover>
  );
}
