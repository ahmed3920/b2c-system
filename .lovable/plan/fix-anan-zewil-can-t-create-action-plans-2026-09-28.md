# Fix: Anan Zewil can't create action plans

## What's wrong
Anan's account is a Team Leader named **"Anan Zewil"**. Most of her tutors (118) are listed in the tutor list under her full name, **"Anan Mohammed Mohammed Zewil"**. Only 32 tutors use the short name.

The security rule on action plans allows a Team Leader to save a plan only when the plan's team leader name is *exactly* her own name. When she picks a tutor listed under the full name, the plan is saved with the full name, the names don't match, and the save is blocked. For the same reason she also can't see her 18 existing plans filed under the full name.

This can happen to any Team Leader whose name is written differently in the tutor list and on their account.

## Fix
Replace the exact-name check in the Team Leader and Super Team Leader rules for action plans with the existing flexible name matcher that other areas already use. It ignores case, punctuation and extra middle names, so "Anan Zewil" matches "Anan Mohammed Mohammed Zewil".

- Anan can create plans for all of her tutors.
- She will see and manage the 18 plans filed under her full name.
- Admin rules stay the same. No data is changed.

## Technical details
One migration that drops and recreates two policies on `public.action_plans`:
- "Team leaders manage their action plans"
- "Super team leaders manage their action plans"

New USING / WITH CHECK:
`has_role(auth.uid(), '<role>'::app_role) AND team_leader_name_matches(team_leader, get_current_user_mentor_name())`

Also check that `action_plan_steps` and `action_plan_step_edits` policies (which reach the plan through its team leader) use the same matcher, and update them the same way if they use exact equality.
