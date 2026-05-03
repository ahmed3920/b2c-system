import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IncidentForm, type IncidentFormValues } from "./IncidentForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}

export function IncidentFormDialog({ open, onOpenChange, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (v: IncidentFormValues) => {
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;
      const { data: profile } = userId
        ? await supabase.from("profiles").select("full_name, mentor_name").eq("user_id", userId).maybeSingle()
        : { data: null as any };
      const submittedByName = profile?.full_name || profile?.mentor_name || null;

      const { error } = await supabase.from("session_incidents").insert({
        student_id: v.student_id || null,
        student_name: v.student_name || null,
        student_grade: v.student_grade || null,
        tutor_external_id: v.tutor_external_id.trim(),
        tutor_name: v.tutor_name,
        team_leader: v.team_leader,
        assigned_mentor_name: v.assigned_mentor_name || null,
        session_date: v.session_date || null,
        session_number: v.session_number || null,
        case_category: v.case_category,
        case_description: v.case_description || null,
        supporting_link: v.supporting_link || null,
        source: "staff",
        submitted_by: userId,
        submitted_by_name: submittedByName,
        validation_status: "approved", // Staff-created incidents are auto-validated
        validated_by: userId,
        validated_by_name: submittedByName,
        validated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: "Incident logged" });
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Session Incident</DialogTitle>
        </DialogHeader>
        <IncidentForm onSubmit={handleSubmit} submitting={submitting} submitLabel="Create Incident" />
      </DialogContent>
    </Dialog>
  );
}
