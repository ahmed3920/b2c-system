# Fix: mentor's Quality tab shows no data

## What's wrong

The Quality reports look up a tutor's mentor in the wrong place. They read the mentor from the tutor list, but in the iSchool system a mentor is a staff record, not a tutor record.

Verified against the live iSchool data:
- Doha Ahmed Morsy Mohammed exists as staff (mentor) and has 13 tutors assigned to her.
- Those tutors have 87 quality reviews.
- Looking her up the current way returns 0 tutors and 0 reviews — which is exactly the empty screen she sees.

## What to change

In the Quality report queries (`supabase/functions/ischool-replica-query/queries.ts`):

- Replace the mentor join `left join public.tutors m on m.id = t.mentor_id` with `left join public.admins ma on ma.id = t.mentor_id` everywhere it appears (list, session details, comments, comments-grouped-by-mentor, filter options, cycle comparison).
- Update every mentor expression from `m.name_i18n->>'en'` to `ma.name`, including the mentor filter clause, the `mentor_name` output columns, and the mentor grouping.
- The grouped-by-mentor query currently outputs `m.t_id` as `mentor_tid`; the staff table has no `t_id`, so return the staff id (or drop that column and key the grouping by mentor name).
- Trim whitespace on the mentor name when matching, since staff names in the source data can have trailing spaces.

No frontend changes are needed: the mentor filter, mentor scope lock, and Mentor Comments tab all already pass and display a mentor name.

## Verification

After the change, signing in as the mentor should show her 13 tutors and 87 reviews across Reviews, Session Details, Mentor Comments, Summary and Cycle Comparison, and the admin Mentor filter should list real mentor names.
