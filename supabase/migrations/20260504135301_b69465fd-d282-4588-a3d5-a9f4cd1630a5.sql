-- Add column to remember previous urgency
ALTER TABLE public.vision_board_plans
  ADD COLUMN IF NOT EXISTS previous_urgency public.vision_plan_urgency;

CREATE OR REPLACE FUNCTION public.sync_vision_plan_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' AND NEW.urgency <> 'completed' THEN
      NEW.previous_urgency := NEW.urgency;
      NEW.urgency := 'completed';
    ELSIF NEW.urgency = 'completed' AND NEW.status <> 'completed' THEN
      NEW.status := 'completed';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    IF OLD.urgency <> 'completed' THEN
      NEW.previous_urgency := OLD.urgency;
    END IF;
    NEW.urgency := 'completed';
  ELSIF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
    IF NEW.urgency = 'completed' OR NEW.urgency IS NOT DISTINCT FROM OLD.urgency THEN
      NEW.urgency := COALESCE(OLD.previous_urgency, 'medium'::public.vision_plan_urgency);
    END IF;
    NEW.previous_urgency := NULL;
  ELSIF NEW.urgency = 'completed' AND OLD.urgency <> 'completed' THEN
    NEW.previous_urgency := OLD.urgency;
    NEW.status := 'completed';
  ELSIF OLD.urgency = 'completed' AND NEW.urgency <> 'completed' THEN
    IF NEW.status = 'completed' THEN
      NEW.status := 'in_progress';
    END IF;
    NEW.previous_urgency := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_vision_plan_completed_trg ON public.vision_board_plans;
CREATE TRIGGER sync_vision_plan_completed_trg
BEFORE INSERT OR UPDATE ON public.vision_board_plans
FOR EACH ROW
EXECUTE FUNCTION public.sync_vision_plan_completed();

-- Backfill: move existing completed plans into the Completed column
UPDATE public.vision_board_plans
SET previous_urgency = urgency, urgency = 'completed'::public.vision_plan_urgency
WHERE status = 'completed' AND urgency <> 'completed';