-- Add mentor validation field for valid/invalid evaluation outcome
ALTER TABLE public.cs_tickets
ADD COLUMN IF NOT EXISTS mentor_validation text;

-- Update mentor update guard to also allow editing mentor_validation
CREATE OR REPLACE FUNCTION public.cs_ticket_mentor_update_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_team_leader'::app_role)
     OR public.has_role(auth.uid(), 'team_leader'::app_role) THEN
    RETURN NEW;
  END IF;

  IF OLD.assigned_mentor_id = auth.uid() THEN
    IF NEW.ticket_number IS DISTINCT FROM OLD.ticket_number
       OR NEW.ticket_date IS DISTINCT FROM OLD.ticket_date
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.cs_category IS DISTINCT FROM OLD.cs_category
       OR NEW.edu_category IS DISTINCT FROM OLD.edu_category
       OR NEW.tutor_external_id IS DISTINCT FROM OLD.tutor_external_id
       OR NEW.tutor_name IS DISTINCT FROM OLD.tutor_name
       OR NEW.team_leader IS DISTINCT FROM OLD.team_leader
       OR NEW.case_details IS DISTINCT FROM OLD.case_details
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.session_num_or_date IS DISTINCT FROM OLD.session_num_or_date
       OR NEW.need_response_deadline IS DISTINCT FROM OLD.need_response_deadline
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.team_leader_response IS DISTINCT FROM OLD.team_leader_response
       OR NEW.assigned_mentor_id IS DISTINCT FROM OLD.assigned_mentor_id
    THEN
      RAISE EXCEPTION 'Mentors can only update evaluation, recommendation, validation and recordings';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;