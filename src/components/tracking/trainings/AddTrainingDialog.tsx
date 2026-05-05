import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { tutorRoster } from "@/data/tutorRoster";
import { teamLeaderMatches } from "@/lib/teamLeaderMatch";
import { useInactiveTutorIds } from "@/hooks/useInactiveTutorIds";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentTeamLeader } from "@/hooks/useCurrentTeamLeader";
import {
  useTrainings,
  type Training,
  type TrainingAttachment,
  type TrainingCreatorType,
  type TrainingPerson,
} from "@/hooks/useTrainings";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Training | null;
}

export function AddTrainingDialog({ open, onOpenChange, editing }: Props) {
  const { isAdmin } = useUserRole();
  const { teamLeader: myTeamLeader } = useCurrentTeamLeader();
  const { inactiveIds } = useInactiveTutorIds();
  const { create, update, uploadFile } = useTrainings();

  const allTeamLeaders = useMemo(
    () =>
      Array.from(
        new Set(
          tutorRoster
            .map((t) => t.team_leader)
            .filter((x): x is string => Boolean(x?.trim())),
        ),
      ).sort(),
    [],
  );

  // Form state
  const [teamLeader, setTeamLeader] = useState<string>("");
  const [creatorType, setCreatorType] = useState<TrainingCreatorType | "">("");
  const [creatorPersonId, setCreatorPersonId] = useState<string>("");
  const [creatorMentorIds, setCreatorMentorIds] = useState<string[]>([]);
  const [conductedBy, setConductedBy] = useState<TrainingPerson[]>([]);
  const [trainingDate, setTrainingDate] = useState<Date | undefined>();
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [title, setTitle] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [subTeams, setSubTeams] = useState<string[]>([]);
  const [materials, setMaterials] = useState<TrainingAttachment[]>([]);
  const [records, setRecords] = useState<TrainingAttachment[]>([]);
  const [materialLink, setMaterialLink] = useState("");
  const [recordLink, setRecordLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Initialize / reset on open
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTeamLeader(editing.team_leader);
      setCreatorType(editing.creator_type);
      setCreatorPersonId(editing.creator_external_id ?? "");
      setCreatorMentorIds(
        editing.creator_type === "mentor" && editing.creator_external_id
          ? editing.creator_external_id.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      );
      setConductedBy(editing.conducted_by ?? []);
      setTrainingDate(new Date(editing.training_date));
      setDurationMinutes(editing.duration_minutes ?? 60);
      setTitle(editing.title);
      setNotes(editing.notes ?? "");
      setSubTeams(editing.sub_teams ?? []);
      setMaterials(editing.material_urls ?? []);
      setRecords(editing.record_urls ?? []);
    } else {
      setTeamLeader(isAdmin ? "" : myTeamLeader ?? "");
      setCreatorType("");
      setCreatorPersonId("");
      setCreatorMentorIds([]);
      setConductedBy([]);
      setTrainingDate(new Date());
      setDurationMinutes(60);
      setTitle("");
      setNotes("");
      setSubTeams([]);
      setMaterials([]);
      setRecords([]);
      setMaterialLink("");
      setRecordLink("");
    }
  }, [open, editing, isAdmin, myTeamLeader]);

  // Roster scoped to current team
  const teamRoster = useMemo(
    () =>
      teamLeader
        ? tutorRoster.filter(
            (t) => teamLeaderMatches(t.team_leader, teamLeader) && !inactiveIds.has(t.id),
          )
        : [],
    [teamLeader, inactiveIds],
  );
  const teamMentors = useMemo(() => teamRoster.filter((t) => t.role === "Mentor"), [teamRoster]);
  const teamTutors = useMemo(() => teamRoster.filter((t) => t.role === "Tutor"), [teamRoster]);

  const subTeamOptions = useMemo(() => {
    // Sub-teams = distinct mentor names whose `team_leader` matches exactly the selected TL
    const mentors = new Set(
      teamRoster
        .filter((t) => t.team_leader === teamLeader)
        .map((t) => t.mentor)
        .filter((m): m is string => Boolean(m?.trim())),
    );
    return Array.from(mentors).sort();
  }, [teamRoster, teamLeader]);

  // Conducted-by options depend on creator type
  const conductedOptions: TrainingPerson[] = useMemo(() => {
    const opts: TrainingPerson[] = [];
    const labelOf = (p: { id: string; name: string }) => `${p.id} - ${p.name}`;
    if (creatorType === "team_leader") {
      if (teamLeader) opts.push({ id: `tl:${teamLeader}`, name: `${teamLeader} (Team Leader)`, role: "team_leader" });
      teamMentors.forEach((m) => opts.push({ id: m.id, name: labelOf(m), role: "mentor" }));
    } else if (creatorType === "mentor") {
      teamMentors.forEach((m) => opts.push({ id: m.id, name: labelOf(m), role: "mentor" }));
    } else if (creatorType === "tutor") {
      teamTutors.forEach((t) => opts.push({ id: t.id, name: labelOf(t), role: "tutor" }));
    }
    return opts;
  }, [creatorType, teamLeader, teamMentors, teamTutors]);

  function toggleConducted(p: TrainingPerson) {
    setConductedBy((prev) =>
      prev.find((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p],
    );
  }

  function toggleSubTeam(name: string) {
    setSubTeams((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, target: "material" | "record") {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    for (const f of files) {
      if (f.size > 25 * 1024 * 1024) {
        toast.error(`${f.name} exceeds 25MB limit`);
        continue;
      }
      const att = await uploadFile(f);
      if (att) {
        if (target === "material") setMaterials((m) => [...m, att]);
        else setRecords((m) => [...m, att]);
      }
    }
    setUploading(false);
    e.target.value = "";
  }

  function addLink(target: "material" | "record") {
    const link = (target === "material" ? materialLink : recordLink).trim();
    if (!link) return;
    try {
      new URL(link);
    } catch {
      toast.error("Invalid URL");
      return;
    }
    const att: TrainingAttachment = { name: link, url: link, type: "link" };
    if (target === "material") {
      setMaterials((m) => [...m, att]);
      setMaterialLink("");
    } else {
      setRecords((m) => [...m, att]);
      setRecordLink("");
    }
  }

  function removeAttachment(target: "material" | "record", idx: number) {
    if (target === "material") setMaterials((m) => m.filter((_, i) => i !== idx));
    else setRecords((m) => m.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    // Validation
    if (!teamLeader) return toast.error("Select a team");
    if (!creatorType) return toast.error("Select training creator type");
    if (!trainingDate) return toast.error("Select a date");
    if (!durationMinutes || durationMinutes <= 0) return toast.error("Enter a valid duration");
    if (!title.trim()) return toast.error("Enter a title");
    if (conductedBy.length === 0) return toast.error("Select at least one person who conducted the training");

    let creatorName = "";
    let creatorExternalId: string | null = null;
    if (creatorType === "team_leader") {
      creatorName = teamLeader;
    } else {
      const pool = creatorType === "mentor" ? teamMentors : teamTutors;
      const found = pool.find((p) => p.id === creatorPersonId);
      if (!found) return toast.error("Select the creator from the list");
      creatorName = `${found.id} - ${found.name}`;
      creatorExternalId = found.id;
    }

    setSubmitting(true);
    const payload = {
      team_leader: teamLeader,
      creator_type: creatorType,
      creator_name: creatorName,
      creator_external_id: creatorExternalId,
      conducted_by: conductedBy,
      training_date: format(trainingDate, "yyyy-MM-dd"),
      training_time: null,
      duration_minutes: durationMinutes,
      title: title.trim(),
      notes: notes.trim() || null,
      sub_teams: subTeams,
      material_urls: materials,
      record_urls: records,
    };
    const ok = editing ? await update(editing.id, payload) : await create(payload);
    setSubmitting(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Training" : "Add Training"}</DialogTitle>
          <DialogDescription>
            Record a training session conducted within your team.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-5 py-2">
            {isAdmin && (
              <div>
                <Label>Team *</Label>
                <Select value={teamLeader || undefined} onValueChange={setTeamLeader}>
                  <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {allTeamLeaders.map((tl) => (
                      <SelectItem key={tl} value={tl}>{tl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Training Creator *</Label>
                <Select
                  value={creatorType || undefined}
                  onValueChange={(v) => {
                    setCreatorType(v as TrainingCreatorType);
                    setCreatorPersonId("");
                    setCreatorMentorIds([]);
                    setConductedBy([]);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Who created it?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team_leader">Team Leader</SelectItem>
                    <SelectItem value="mentor">Mentor</SelectItem>
                    <SelectItem value="tutor">Tutor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {creatorType === "tutor" && (
                <div>
                  <Label>Tutor *</Label>
                  <Select value={creatorPersonId || undefined} onValueChange={setCreatorPersonId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tutor" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {teamTutors.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.id} - {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {creatorType === "mentor" && (
                <div>
                  <Label>Mentor(s) * <span className="text-xs text-muted-foreground">(multi-select)</span></Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start font-normal">
                        {creatorMentorIds.length === 0
                          ? "Select mentor(s)..."
                          : `${creatorMentorIds.length} selected`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[380px] p-0" align="start">
                      <ScrollArea className="h-60">
                        <div className="p-2 space-y-1">
                          {teamMentors.length === 0 && (
                            <p className="text-sm text-muted-foreground p-2">No mentors available</p>
                          )}
                          {teamMentors.map((m) => {
                            const checked = creatorMentorIds.includes(m.id);
                            return (
                              <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() =>
                                    setCreatorMentorIds((prev) =>
                                      prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id],
                                    )
                                  }
                                />
                                <span className="text-sm">{m.id} - {m.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  {creatorMentorIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {creatorMentorIds.map((mid) => {
                        const m = teamMentors.find((x) => x.id === mid);
                        if (!m) return null;
                        return (
                          <Badge key={mid} variant="secondary" className="gap-1">
                            {m.id} - {m.name}
                            <button
                              type="button"
                              onClick={() => setCreatorMentorIds((prev) => prev.filter((x) => x !== mid))}
                              className="hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label>Conducted By * <span className="text-xs text-muted-foreground">(multi-select)</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    {conductedBy.length === 0
                      ? "Select people..."
                      : `${conductedBy.length} selected`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[380px] p-0" align="start">
                  <ScrollArea className="h-72">
                    <div className="p-2 space-y-1">
                      {conductedOptions.length === 0 && (
                        <p className="text-sm text-muted-foreground p-2">
                          {!teamLeader ? "Select a team first" : !creatorType ? "Select training creator first" : "No people available"}
                        </p>
                      )}
                      {conductedOptions.map((p) => {
                        const checked = !!conductedBy.find((x) => x.id === p.id);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                          >
                            <Checkbox checked={checked} onCheckedChange={() => toggleConducted(p)} />
                            <span className="text-sm flex-1">{p.name}</span>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {p.role.replace("_", " ")}
                            </Badge>
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              {conductedBy.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {conductedBy.map((p) => (
                    <Badge key={p.id} variant="secondary" className="gap-1">
                      {p.name}
                      <button
                        type="button"
                        onClick={() => toggleConducted(p)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Training Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start font-normal",
                        !trainingDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {trainingDate ? format(trainingDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={trainingDate}
                      onSelect={setTrainingDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Training Duration *</Label>
                <Select
                  value={String(durationMinutes)}
                  onValueChange={(v) => setDurationMinutes(Number(v))}
                >
                  <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240].map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m < 60 ? `${m} mins` : m % 60 === 0 ? `${m / 60} hour${m === 60 ? "" : "s"}` : `${Math.floor(m / 60)}h ${m % 60}m`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Training Title / Topic *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Handling difficult students"
                maxLength={200}
              />
            </div>

            {teamLeader && (
              <div className="space-y-2">
                <Label>Audience</Label>
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="audience"
                      checked={subTeams.length === 0}
                      onChange={() => setSubTeams([])}
                    />
                    Entire Team
                  </label>
                  <label className={cn("flex items-center gap-2", subTeamOptions.length === 0 ? "opacity-50" : "cursor-pointer")}>
                    <input
                      type="radio"
                      name="audience"
                      disabled={subTeamOptions.length === 0}
                      checked={subTeams.length > 0}
                      onChange={() => subTeamOptions[0] && setSubTeams([subTeamOptions[0]])}
                    />
                    Specific Sub-Teams
                  </label>
                </div>
                {subTeams.length > 0 && subTeamOptions.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start font-normal">
                        {subTeams.length} sub-team{subTeams.length === 1 ? "" : "s"} selected
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[380px] p-0" align="start">
                      <ScrollArea className="h-60">
                        <div className="p-2 space-y-1">
                          {subTeamOptions.map((m) => (
                            <label
                              key={m}
                              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                            >
                              <Checkbox
                                checked={subTeams.includes(m)}
                                onCheckedChange={() => toggleSubTeam(m)}
                              />
                              <span className="text-sm">{m}</span>
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                )}
                {subTeams.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {subTeams.map((s) => (
                      <Badge key={s} variant="outline" className="gap-1">
                        {s}
                        <button type="button" onClick={() => toggleSubTeam(s)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <AttachmentField
              label="Training Material (optional)"
              attachments={materials}
              link={materialLink}
              setLink={setMaterialLink}
              onUpload={(e) => handleFileUpload(e, "material")}
              onAddLink={() => addLink("material")}
              onRemove={(i) => removeAttachment("material", i)}
              uploading={uploading}
            />

            <AttachmentField
              label="Training Record (if available)"
              attachments={records}
              link={recordLink}
              setLink={setRecordLink}
              onUpload={(e) => handleFileUpload(e, "record")}
              onAddLink={() => addLink("record")}
              onRemove={(i) => removeAttachment("record", i)}
              uploading={uploading}
            />

            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional context..."
                rows={3}
                maxLength={2000}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || uploading}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editing ? "Save Changes" : "Add Training"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentField({
  label,
  attachments,
  link,
  setLink,
  onUpload,
  onAddLink,
  onRemove,
  uploading,
}: {
  label: string;
  attachments: TrainingAttachment[];
  link: string;
  setLink: (s: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddLink: () => void;
  onRemove: (i: number) => void;
  uploading: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" disabled={uploading}>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-1" />
              Upload files
              <input
                type="file"
                multiple
                className="hidden"
                onChange={onUpload}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.mp4,.mp3,.webm,.txt,.csv,.xlsx"
              />
            </label>
          </Button>
          <Input
            placeholder="or paste URL"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="flex-1"
          />
          <Button type="button" variant="secondary" size="sm" onClick={onAddLink}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {attachments.length > 0 && (
          <ul className="space-y-1">
            {attachments.map((a, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-sm rounded border px-2 py-1"
              >
                <Badge variant="outline" className="text-[10px]">
                  {a.type}
                </Badge>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 truncate text-primary hover:underline"
                >
                  {a.name}
                </a>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
