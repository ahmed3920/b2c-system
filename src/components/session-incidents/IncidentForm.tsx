import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useMergedRoster } from "@/hooks/useMergedRoster";
import { useSessionIncidentCategories, useIncidentFieldConfig } from "@/hooks/useSessionIncidentConfig";

export interface IncidentFormValues {
  student_id: string;
  student_name: string;
  student_grade: string;
  tutor_external_id: string;
  tutor_name: string;
  team_leader: string;
  assigned_mentor_name: string;
  session_date: string;
  session_number: string;
  case_category: string;
  case_description: string;
  supporting_link: string;
}

const empty: IncidentFormValues = {
  student_id: "", student_name: "", student_grade: "",
  tutor_external_id: "", tutor_name: "", team_leader: "", assigned_mentor_name: "",
  session_date: "", session_number: "",
  case_category: "", case_description: "", supporting_link: "",
};

interface Props {
  initial?: Partial<IncidentFormValues>;
  /** Lock tutor identity (e.g. token submission). */
  lockTutor?: boolean;
  onSubmit: (v: IncidentFormValues) => Promise<void> | void;
  submitting?: boolean;
  submitLabel?: string;
}

export function IncidentForm({ initial, lockTutor, onSubmit, submitting, submitLabel = "Submit" }: Props) {
  const { items: categories } = useSessionIncidentCategories();
  const { items: fields, byName } = useIncidentFieldConfig();
  const [values, setValues] = useState<IncidentFormValues>({ ...empty, ...initial });
  const [error, setError] = useState<string | null>(null);

  // Auto-fill tutor info from roster when tutor_external_id changes
  useEffect(() => {
    if (lockTutor) return;
    const t = tutorRoster.find((x) => x.id.toUpperCase() === values.tutor_external_id.trim().toUpperCase());
    if (t) {
      setValues((v) => ({ ...v, tutor_name: t.name, team_leader: t.team_leader, assigned_mentor_name: t.mentor }));
    } else if (values.tutor_external_id) {
      setValues((v) => ({ ...v, tutor_name: "", team_leader: "", assigned_mentor_name: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.tutor_external_id, lockTutor]);

  const set = (k: keyof IncidentFormValues, v: string) => setValues((cur) => ({ ...cur, [k]: v }));
  const cfg = (name: string) => byName(name);
  const visible = (name: string) => cfg(name)?.is_visible ?? true;
  const required = (name: string) => cfg(name)?.is_required ?? false;
  const star = (name: string) => required(name) ? " *" : "";

  const handleSubmit = async () => {
    setError(null);
    if (!values.tutor_external_id.trim()) { setError("Tutor ID is required"); return; }
    if (!values.case_category) { setError("Case Category is required"); return; }
    for (const f of fields) {
      if (!f.is_visible || !f.is_required) continue;
      const val = (values as any)[f.field_name];
      if (!val || (typeof val === "string" && !val.trim())) {
        setError(`${f.field_label} is required`);
        return;
      }
    }
    if (!values.tutor_name && !lockTutor) { setError("Tutor not found in roster"); return; }
    await onSubmit(values);
  };

  const sessionDate = values.session_date ? new Date(values.session_date) : undefined;

  return (
    <div className="space-y-4">
      {/* Tutor */}
      {visible("tutor_external_id") && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Tutor ID{star("tutor_external_id")}</Label>
            <Input
              value={values.tutor_external_id}
              onChange={(e) => set("tutor_external_id", e.target.value)}
              placeholder="e.g. T-12345"
              readOnly={lockTutor}
              className={lockTutor ? "bg-muted" : ""}
            />
          </div>
          <div className="space-y-2">
            <Label>Tutor Name</Label>
            <Input value={values.tutor_name} readOnly className="bg-muted" placeholder="Auto-filled" />
          </div>
          <div className="space-y-2">
            <Label>Team Leader</Label>
            <Input value={values.team_leader} readOnly className="bg-muted" placeholder="Auto-filled" />
          </div>
        </div>
      )}

      {/* Student */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {visible("student_id") && (
          <div className="space-y-2">
            <Label>Student ID{star("student_id")}</Label>
            <Input value={values.student_id} onChange={(e) => set("student_id", e.target.value)} />
          </div>
        )}
        {visible("student_name") && (
          <div className="space-y-2">
            <Label>Student Name{star("student_name")}</Label>
            <Input value={values.student_name} onChange={(e) => set("student_name", e.target.value)} />
          </div>
        )}
        {visible("student_grade") && (
          <div className="space-y-2">
            <Label>Student Grade{star("student_grade")}</Label>
            <Input value={values.student_grade} onChange={(e) => set("student_grade", e.target.value)} placeholder="e.g. Grade 5, M2" />
          </div>
        )}
      </div>

      {/* Session */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visible("session_date") && (
          <div className="space-y-2">
            <Label>Session Date{star("session_date")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {sessionDate ? format(sessionDate, "PP") : <span className="text-muted-foreground">Pick date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={sessionDate}
                  onSelect={(d) => set("session_date", d ? format(d, "yyyy-MM-dd") : "")}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
        {visible("session_number") && (
          <div className="space-y-2">
            <Label>Session Number{star("session_number")}</Label>
            <Input value={values.session_number} onChange={(e) => set("session_number", e.target.value)} placeholder='e.g. "Session 11" or "General"' />
          </div>
        )}
      </div>

      {/* Case */}
      {visible("case_category") && (
        <div className="space-y-2">
          <Label>Case Category{star("case_category")}</Label>
          <Select value={values.case_category} onValueChange={(v) => set("case_category", v)}>
            <SelectTrigger><SelectValue placeholder="Select case category" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {visible("case_description") && (
        <div className="space-y-2">
          <Label>Case Description{star("case_description")}</Label>
          <Textarea
            value={values.case_description}
            onChange={(e) => set("case_description", e.target.value)}
            rows={4}
            placeholder="Describe what happened..."
          />
        </div>
      )}

      {visible("supporting_link") && (
        <div className="space-y-2">
          <Label>Supporting Document Link{star("supporting_link")}</Label>
          <Input
            type="url"
            value={values.supporting_link}
            onChange={(e) => set("supporting_link", e.target.value)}
            placeholder="https://drive.google.com/..."
          />
        </div>
      )}

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="flex justify-end pt-2">
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Submitting..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}
