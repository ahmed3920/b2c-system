-- ===== tutor_emails =====
CREATE TABLE public.tutor_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_external_id TEXT NOT NULL UNIQUE,
  tutor_name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes TEXT,
  team_leader TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tutor_emails_status ON public.tutor_emails(status);
CREATE INDEX idx_tutor_emails_tutor ON public.tutor_emails(tutor_external_id);

ALTER TABLE public.tutor_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tutor_emails"
ON public.tutor_emails FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view tutor_emails"
ON public.tutor_emails FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Team leaders insert tutor_emails for their team"
ON public.tutor_emails FOR INSERT TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'team_leader'::app_role) OR has_role(auth.uid(), 'super_team_leader'::app_role))
  AND (team_leader IS NULL OR team_leader_name_matches(team_leader, get_current_user_mentor_name()))
);

CREATE POLICY "Team leaders update tutor_emails for their team"
ON public.tutor_emails FOR UPDATE TO authenticated
USING (
  (has_role(auth.uid(), 'team_leader'::app_role) OR has_role(auth.uid(), 'super_team_leader'::app_role))
  AND (team_leader IS NULL OR team_leader_name_matches(team_leader, get_current_user_mentor_name()))
)
WITH CHECK (
  (has_role(auth.uid(), 'team_leader'::app_role) OR has_role(auth.uid(), 'super_team_leader'::app_role))
  AND (team_leader IS NULL OR team_leader_name_matches(team_leader, get_current_user_mentor_name()))
);

CREATE TRIGGER trg_tutor_emails_updated_at
BEFORE UPDATE ON public.tutor_emails
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== email_templates =====
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  action_plan_category action_plan_category,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email_templates"
ON public.email_templates FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view active email_templates"
ON public.email_templates FOR SELECT TO authenticated
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== email_logs =====
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_external_id TEXT,
  tutor_name TEXT,
  recipient_email TEXT NOT NULL,
  cc_emails TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','draft')),
  related_plan_id UUID,
  template_id UUID,
  sent_by UUID,
  sent_by_name TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_logs_tutor ON public.email_logs(tutor_external_id);
CREATE INDEX idx_email_logs_plan ON public.email_logs(related_plan_id);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all email_logs"
ON public.email_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Senders view their own email_logs"
ON public.email_logs FOR SELECT TO authenticated
USING (sent_by = auth.uid());

CREATE POLICY "Authenticated insert email_logs"
ON public.email_logs FOR INSERT TO authenticated
WITH CHECK (sent_by = auth.uid());

CREATE POLICY "Admins delete email_logs"
ON public.email_logs FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== Seed default templates =====
INSERT INTO public.email_templates (template_name, action_plan_category, subject, body) VALUES
('Quality Warning', 'quality',
  'Quality Performance Notice - {{tutor_name}}',
  'Dear {{tutor_name}},

This is a formal notice regarding your recent quality performance. Following our quality review (Action Plan opened on {{start_date}}), we have identified areas requiring immediate improvement.

Action Plan Summary:
{{summary}}

Target resolution date: {{due_date}}

Please ensure you address the highlighted points. We are here to support you throughout this improvement plan.

Best regards,
{{team_leader}}'),
('Emergency Abuse Warning', 'emergency_abuse',
  'Important Notice: Emergency Leave Usage - {{tutor_name}}',
  'Dear {{tutor_name}},

We have observed a pattern in your emergency leave usage that requires our attention. An action plan has been opened on {{start_date}} to address this matter.

Details:
{{summary}}

Please reply with your understanding and any context you would like us to consider. Target review date: {{due_date}}.

Best regards,
{{team_leader}}'),
('No Show Warning', 'no_show_abuse',
  'No-Show Notice - {{tutor_name}}',
  'Dear {{tutor_name}},

This email serves as an official notice regarding recent no-shows on your scheduled sessions. An action plan ({{start_date}}) has been initiated to monitor and resolve this issue.

Summary:
{{summary}}

Please confirm receipt and your commitment to attendance. Resolution target: {{due_date}}.

Best regards,
{{team_leader}}'),
('Communication Notice', 'communication',
  'Communication Standards Reminder - {{tutor_name}}',
  'Dear {{tutor_name}},

We would like to bring to your attention some recent communication issues that require improvement. Please review the action plan opened on {{start_date}}.

Details:
{{summary}}

Please align with our communication standards going forward. Target follow-up: {{due_date}}.

Best regards,
{{team_leader}}'),
('CS Complaint Notice', 'cs_complaints',
  'CS Complaint Follow-up - {{tutor_name}}',
  'Dear {{tutor_name}},

We received a customer complaint that requires your attention. An action plan has been created on {{start_date}} to track resolution.

Complaint summary:
{{summary}}

Please respond with your perspective and corrective actions. Target close date: {{due_date}}.

Best regards,
{{team_leader}}');