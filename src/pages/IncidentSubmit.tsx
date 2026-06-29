import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";
import { IncidentForm, type IncidentFormValues } from "@/components/session-incidents/IncidentForm";
import { tutorRoster } from "@/data/tutorRoster";
import { getMergedTutorById, setRosterOverrides, type RosterOverrideRow } from "@/data/rosterCache";


const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-session-incident`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Public page: uses a separate non-persistent supabase client below for token
// reads so it never touches the global authenticated session. We intentionally
// do NOT purge stored auth here — doing so at module scope would log out any
// signed-in user whenever this module is imported by the app bundle.


export default function IncidentSubmit() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [tokenInfo, setTokenInfo] = useState<{ tutor_external_id: string; tutor_name: string; team_leader: string } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(!!token);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Ensure merged roster (static + DB overrides for newly added tutors) is
    // loaded before lookups happen.
    bootstrapRosterCache();
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        // Public form: do NOT persist or refresh auth — avoids "JWT issued at future"
        // errors when a stale/skewed session exists in localStorage from another login.
        const sb = createClient(import.meta.env.VITE_SUPABASE_URL, ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        const { data } = await sb.from("session_incident_tokens").select("tutor_external_id,tutor_name,team_leader,is_active").eq("token", token).maybeSingle();
        if (!data || !data.is_active) {
          setTokenError("This link is invalid or has been disabled.");
        } else {
          setTokenInfo(data);
        }
      } catch (e: any) {
        setTokenError(e.message);
      } finally {
        setLoadingToken(false);
      }
    })();
  }, [token]);

  const handleSubmit = async (v: IncidentFormValues) => {
    setSubmitting(true);
    try {
      let tutorName = v.tutor_name;
      let teamLeader = v.team_leader;
      let mentor = v.assigned_mentor_name;
      // Always consult the merged roster (static + DB overrides) so newly
      // added tutors and overridden mentor/TL assignments are honored.
      const id = v.tutor_external_id.trim().toUpperCase();
      const merged = getMergedTutorById(id)
        ?? tutorRoster.find((x) => x.id.toUpperCase() === id);
      if (!token && !merged) throw new Error("Tutor ID not found in roster.");
      if (merged) {
        if (!tutorName) tutorName = merged.name;
        if (!teamLeader) teamLeader = merged.team_leader;
        if (!mentor) mentor = merged.mentor;
      }

      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({
          token: token || undefined,
          tutor_external_id: v.tutor_external_id,
          tutor_name: tutorName,
          team_leader: teamLeader,
          assigned_mentor_name: mentor,
          student_id: v.student_id,
          student_name: v.student_name,
          student_grade: v.student_grade,
          session_date: v.session_date,
          session_number: v.session_number,
          case_category: v.case_category,
          case_description: v.case_description,
          supporting_link: v.supporting_link,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Submission failed");
      setDone(true);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <p className="text-destructive">{tokenError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-lg font-semibold">Submission received</h2>
            <p className="text-sm text-muted-foreground">Your incident has been logged. Your Team Leader and Mentor will review it shortly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Report a Session Incident</CardTitle>
          <p className="text-sm text-muted-foreground">
            Fill in the details so your Team Leader and Mentor can review the case.
          </p>
        </CardHeader>
        <CardContent>
          <IncidentForm
            initial={tokenInfo ? {
              tutor_external_id: tokenInfo.tutor_external_id,
              tutor_name: tokenInfo.tutor_name,
              team_leader: tokenInfo.team_leader,
            } : undefined}
            lockTutor={!!tokenInfo}
            onSubmit={handleSubmit}
            submitting={submitting}
            submitLabel="Submit Incident"
          />
        </CardContent>
      </Card>
    </div>
  );
}
