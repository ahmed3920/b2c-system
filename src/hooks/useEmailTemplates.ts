import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ActionPlanCategory } from "@/hooks/useActionPlans";

export interface EmailTemplate {
  id: string;
  template_name: string;
  action_plan_category: ActionPlanCategory | null;
  subject: string;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("email_templates")
      .select("*")
      .order("template_name");
    if (data) setTemplates(data as EmailTemplate[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { templates, isLoading, refetch: fetch };
}

export function fillTemplate(
  tpl: { subject: string; body: string },
  vars: Record<string, string>,
): { subject: string; body: string } {
  const replace = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
  return { subject: replace(tpl.subject), body: replace(tpl.body) };
}
