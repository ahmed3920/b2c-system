// Registry of approved read-only queries against the iSchool production replica.
// The browser can only ask for a query by key — never raw SQL.
//
// Each entry declares:
//   sql    — a parameterized statement using $1, $2, ... placeholders
//   params — ordered param names read from the request body (missing = null)
//   limit  — max rows returned (a hard LIMIT is appended if not present)

export type ReplicaQuery = {
  sql: string;
  params: string[];
  limit?: number;
};

// Shared join + filter blocks for the quality review reports.
// Filter params, in order: date_from, date_to, team_lead, tutor,
// session_type, status, min_score, max_score, review_cycle, tutor_status.
const QUALITY_PARAMS = [
  "date_from",
  "date_to",
  "team_lead",
  "tutor",
  "session_type",
  "status",
  "min_score",
  "max_score",
  "review_cycle",
  "tutor_status",
];

const QUALITY_JOINS = `from public.quality_reviews qr
          join public.tutors t on t.id = qr.tutor_id
          left join public.admins a on a.id = t.team_lead_id
          left join public.tutors m on m.id = t.mentor_id
          left join public.sessions s on s.id = qr.session_id
          left join public.lessons l on l.id = s.lesson_id`;

const QUALITY_WHERE = `where qr.type = 'QualityReview'
            and ($1::timestamptz is null or coalesce(qr.session_start_at, qr.created_at) >= $1::timestamptz)
            and ($2::timestamptz is null or coalesce(qr.session_start_at, qr.created_at) < ($2::timestamptz + interval '1 day'))
            and ($3::text is null or a.name ilike '%' || $3::text || '%')
            and ($4::text is null or t.t_id ilike '%' || $4::text || '%' or (t.name_i18n->>'en') ilike '%' || $4::text || '%')
            and ($5::text is null or qr.session_type::text = $5::text)
            and ($6::text is null or qr.status::text = $6::text)
            and ($7::numeric is null or qr.score >= $7::numeric)
            and ($8::numeric is null or qr.score <= $8::numeric)
            and ($9::text is null or qr.review_cycle::text = $9::text)
            and ($10::int is null or t.status::int = $10::int)`;

const QUALITY_FROM = `${QUALITY_JOINS}
          ${QUALITY_WHERE}`;

// Written comments: criterion-level notes typed by the reviewer plus
// tagged (positive / negative) comments attached to the review.
const QUALITY_COMMENTS_UNION = `(
            select qe.quality_review_id,
                   'evaluation'::text as source,
                   qe.comments as body,
                   null::int as comment_type,
                   (qc.name_i18n->>'en') as criterion_name,
                   coalesce(parent.name_i18n->>'en', qc.name_i18n->>'en') as parent_name,
                   qe.score as criterion_score
              from public.quality_evaluations qe
              join public.quality_criteria qc on qc.id = qe.quality_criterion_id
              left join public.quality_criteria parent on parent.id = qc.parent_id
             where nullif(btrim(qe.comments), '') is not null
            union all
            select qrc.quality_review_id,
                   'tag'::text as source,
                   coalesce(qrc.body_i18n->>'en', qcm.body_i18n->>'en') as body,
                   coalesce(qrc.comment_type, qcm.comment_type) as comment_type,
                   (qc.name_i18n->>'en') as criterion_name,
                   coalesce(parent.name_i18n->>'en', qc.name_i18n->>'en') as parent_name,
                   null::numeric as criterion_score
              from public.quality_review_comments qrc
              left join public.quality_comments qcm on qcm.id = qrc.quality_comment_id
              left join public.quality_criteria qc
                on qc.id = coalesce(qrc.quality_criterion_id, qcm.quality_criterion_id)
              left join public.quality_criteria parent on parent.id = qc.parent_id
             where qrc.deleted_at is null
          ) c`;

export const QUERIES: Record<string, ReplicaQuery> = {
  // --- Diagnostics -----------------------------------------------------
  connection_check: {
    sql: `select current_database() as database,
                 current_user as db_user,
                 version() as server_version,
                 now() as server_time`,
    params: [],
    limit: 1,
  },

  list_tables: {
    sql: `select table_schema, table_name
          from information_schema.tables
          where table_type = 'BASE TABLE'
            and table_schema not in ('pg_catalog', 'information_schema')
          order by table_schema, table_name`,
    params: [],
    limit: 2000,
  },

  list_columns: {
    sql: `select table_schema, table_name, column_name, data_type
          from information_schema.columns
          where table_schema not in ('pg_catalog', 'information_schema')
            and ($1::text is null or table_name ilike $1::text)
          order by table_schema, table_name, ordinal_position`,
    params: ["table"],
    limit: 5000,
  },

  // --- Quality ---------------------------------------------------------
  quality_reviews_list: {
    sql: `select qr.id,
                 qr.score,
                 qr.status::text as status,
                 qr.session_type::text as session_type,
                 qr.session_start_at,
                 qr.submission_date,
                 qr.duration,
                 qr.phase_number,
                 qr.review_cycle,
                 qr.has_flags,
                 qr.remarkable_session,
                 qr.needs_coaching,
                 qr.needs_immediate_action,
                 qr.has_pending_objections,
                 qr.quality_objections_count,
                 t.t_id as tutor_tid,
                 (t.name_i18n->>'en') as tutor_name,
                 t.status::int as tutor_status,
                 a.name as team_leader,
                 (m.name_i18n->>'en') as mentor_name,
                 (l.name_i18n->>'en') as lesson_name
          ${QUALITY_FROM}
          order by coalesce(qr.session_start_at, qr.created_at) desc
          limit coalesce($11::int, 100) offset coalesce($12::int, 0)`,
    params: [...QUALITY_PARAMS, "limit", "offset"],
    limit: 2000,
  },

  quality_reviews_count: {
    sql: `select count(*)::int as total,
                 round(avg(qr.score)::numeric, 2) as avg_score,
                 count(*) filter (where qr.needs_coaching)::int as needs_coaching,
                 count(*) filter (where qr.needs_immediate_action)::int as needs_immediate_action,
                 count(*) filter (where qr.remarkable_session)::int as remarkable,
                 count(*) filter (where qr.has_flags)::int as flagged,
                 count(*) filter (where qr.has_pending_objections)::int as pending_objections,
                 count(distinct t.id)::int as tutors,
                 count(distinct a.id)::int as team_leaders
          ${QUALITY_FROM}`,
    params: QUALITY_PARAMS,
    limit: 1,
  },

  quality_category_averages: {
    sql: `select coalesce(parent.name_i18n->>'en', qc.name_i18n->>'en') as category,
                 round(avg(qe.score)::numeric, 2) as avg_score,
                 count(*)::int as evaluations
          ${QUALITY_JOINS}
          join public.quality_evaluations qe on qe.quality_review_id = qr.id
          join public.quality_criteria qc on qc.id = qe.quality_criterion_id
          left join public.quality_criteria parent on parent.id = qc.parent_id
          ${QUALITY_WHERE}
          group by 1
          order by 1`,
    params: QUALITY_PARAMS,
    limit: 50,
  },

  quality_subcriteria_averages: {
    sql: `select coalesce(parent.name_i18n->>'en', qc.name_i18n->>'en') as category,
                 (qc.name_i18n->>'en') as criterion,
                 round(avg(qe.score)::numeric, 2) as avg_score,
                 count(*)::int as evaluations
          ${QUALITY_JOINS}
          join public.quality_evaluations qe on qe.quality_review_id = qr.id
          join public.quality_criteria qc on qc.id = qe.quality_criterion_id
          left join public.quality_criteria parent on parent.id = qc.parent_id
          ${QUALITY_WHERE}
          group by 1, 2
          order by 1, 3 asc`,
    params: QUALITY_PARAMS,
    limit: 200,
  },

  quality_by_team_leader: {
    sql: `select coalesce(a.name, 'Unassigned') as team_leader,
                 count(*)::int as reviews,
                 count(distinct t.id)::int as tutors,
                 round(avg(qr.score)::numeric, 2) as avg_score,
                 count(*) filter (where qr.needs_coaching)::int as needs_coaching,
                 count(*) filter (where qr.needs_immediate_action)::int as needs_immediate_action
          ${QUALITY_FROM}
          group by 1
          order by avg_score desc nulls last`,
    params: QUALITY_PARAMS,
    limit: 100,
  },

  quality_by_tutor: {
    sql: `select t.t_id as tutor_tid,
                 (t.name_i18n->>'en') as tutor_name,
                 t.status::int as tutor_status,
                 coalesce(a.name, 'Unassigned') as team_leader,
                 count(*)::int as reviews,
                 round(avg(qr.score)::numeric, 2) as avg_score,
                 count(*) filter (where qr.needs_coaching)::int as needs_coaching
          ${QUALITY_FROM}
          group by 1, 2, 3, 4
          order by avg_score asc nulls last`,
    params: QUALITY_PARAMS,
    limit: 1000,
  },

  quality_score_distribution: {
    sql: `select bucket, count(*)::int as reviews
          from (
            select case
                     when qr.score is null then 'No score'
                     when qr.score < 3 then '< 3.0'
                     when qr.score < 3.5 then '3.0 – 3.49'
                     when qr.score < 4 then '3.5 – 3.99'
                     when qr.score < 4.5 then '4.0 – 4.49'
                     else '4.5 – 5.0'
                   end as bucket
            ${QUALITY_FROM}
          ) b
          group by 1
          order by 1`,
    params: QUALITY_PARAMS,
    limit: 10,
  },

  quality_comment_tags: {
    sql: `select c.body,
                 c.comment_type,
                 c.parent_name,
                 count(*)::int as uses
          ${QUALITY_JOINS}
          join ${QUALITY_COMMENTS_UNION} on c.quality_review_id = qr.id
          ${QUALITY_WHERE}
            and c.source = 'tag'
            and c.body is not null
          group by 1, 2, 3
          order by uses desc`,
    params: QUALITY_PARAMS,
    limit: 40,
  },

  // Session details: one row per reviewed session, with attendance / student info.
  quality_session_details: {
    sql: `select qr.id,
                 qr.score,
                 qr.status::text as status,
                 qr.session_type::text as session_type,
                 qr.session_start_at,
                 qr.submission_date,
                 qr.duration,
                 qr.review_cycle,
                 qr.needs_coaching,
                 qr.needs_immediate_action,
                 qr.remarkable_session,
                 qr.has_flags,
                 t.t_id as tutor_tid,
                 (t.name_i18n->>'en') as tutor_name,
                 t.status::int as tutor_status,
                 a.name as team_leader,
                 (m.name_i18n->>'en') as mentor_name,
                 (l.name_i18n->>'en') as lesson_name,
                 l.position as lesson_position,
                 st.s_id as student_sid,
                 s.tutor_join_time,
                 s.student_join_time,
                 s.student_feedback,
                 s.student_feedback_comment,
                 s.is_student_absent
          ${QUALITY_JOINS}
          left join public.students st on st.id = s.student_id
          ${QUALITY_WHERE}
          order by coalesce(qr.session_start_at, qr.created_at) desc
          limit coalesce($11::int, 100) offset coalesce($12::int, 0)`,
    params: [...QUALITY_PARAMS, "limit", "offset"],
    limit: 2000,
  },

  // Reviewer's written comments (evaluation notes + tagged comments), one row per comment.
  quality_comments_list: {
    sql: `select qr.id as review_id,
                 qr.score,
                 qr.session_start_at,
                 qr.review_cycle,
                 t.t_id as tutor_tid,
                 (t.name_i18n->>'en') as tutor_name,
                 t.status::int as tutor_status,
                 a.name as team_leader,
                 (m.name_i18n->>'en') as mentor_name,
                 c.source,
                 c.body,
                 c.comment_type,
                 c.criterion_name,
                 c.parent_name,
                 c.criterion_score
          ${QUALITY_JOINS}
          join ${QUALITY_COMMENTS_UNION} on c.quality_review_id = qr.id
          ${QUALITY_WHERE}
            and ($11::text is null or c.parent_name = $11::text)
            and ($12::text is null or c.body ilike '%' || $12::text || '%')
            and ($13::int is null or c.comment_type = $13::int)
          order by coalesce(qr.session_start_at, qr.created_at) desc, qr.id desc, c.source, c.comment_type
          limit coalesce($14::int, 100) offset coalesce($15::int, 0)`,
    params: [...QUALITY_PARAMS, "criterion", "search", "comment_type", "limit", "offset"],
    limit: 2000,
  },

  quality_comments_count: {
    sql: `select count(*)::int as total,
                 count(*) filter (where c.comment_type = 0)::int as positive,
                 count(*) filter (where c.comment_type = 1)::int as negative,
                 count(*) filter (where c.source = 'evaluation')::int as written
          ${QUALITY_JOINS}
          join ${QUALITY_COMMENTS_UNION} on c.quality_review_id = qr.id
          ${QUALITY_WHERE}
            and ($11::text is null or c.parent_name = $11::text)
            and ($12::text is null or c.body ilike '%' || $12::text || '%')
            and ($13::int is null or c.comment_type = $13::int)`,
    params: [...QUALITY_PARAMS, "criterion", "search", "comment_type"],
    limit: 1,
  },

  // Comments grouped by the tutor's mentor.
  quality_comments_by_mentor: {
    sql: `select coalesce(m.name_i18n->>'en', 'No mentor') as mentor_name,
                 m.t_id as mentor_tid,
                 count(distinct t.id)::int as tutors,
                 count(distinct qr.id)::int as reviews,
                 round(avg(qr.score)::numeric, 2) as avg_score,
                 count(c.body) filter (where c.comment_type = 0)::int as positive,
                 count(c.body) filter (where c.comment_type = 1)::int as negative,
                 count(c.body) filter (where c.source = 'evaluation')::int as written
          ${QUALITY_JOINS}
          left join ${QUALITY_COMMENTS_UNION} on c.quality_review_id = qr.id
          ${QUALITY_WHERE}
          group by 1, 2
          order by negative desc, reviews desc`,
    params: QUALITY_PARAMS,
    limit: 500,
  },

  // Cycle comparison: overall + per criterion averages for the selected cycles.
  quality_cycle_criteria_matrix: {
    sql: `select qr.review_cycle::text as cycle,
                 coalesce(parent.name_i18n->>'en', qc.name_i18n->>'en') as category,
                 case when parent.id is null then null else (qc.name_i18n->>'en') end as criterion,
                 round(avg(qe.score)::numeric, 2) as avg_score,
                 count(*)::int as evaluations
          from public.quality_reviews qr
          join public.tutors t on t.id = qr.tutor_id
          left join public.admins a on a.id = t.team_lead_id
          join public.quality_evaluations qe on qe.quality_review_id = qr.id
          join public.quality_criteria qc on qc.id = qe.quality_criterion_id
          left join public.quality_criteria parent on parent.id = qc.parent_id
          where qr.type = 'QualityReview'
            and qr.review_cycle::text = any($1::text[])
            and ($2::text is null or a.name ilike '%' || $2::text || '%')
            and ($3::text is null or t.t_id ilike '%' || $3::text || '%' or (t.name_i18n->>'en') ilike '%' || $3::text || '%')
            and ($4::int is null or t.status::int = $4::int)
          group by 1, 2, 3
          order by 2, 3 nulls first, 1`,
    params: ["cycles", "team_lead", "tutor", "tutor_status"],
    limit: 2000,
  },

  quality_cycle_overall: {
    sql: `select qr.review_cycle::text as cycle,
                 count(*)::int as reviews,
                 count(distinct t.id)::int as tutors,
                 round(avg(qr.score)::numeric, 2) as avg_score,
                 count(*) filter (where qr.needs_coaching)::int as needs_coaching,
                 count(*) filter (where qr.needs_immediate_action)::int as needs_immediate_action,
                 count(*) filter (where qr.remarkable_session)::int as remarkable
          from public.quality_reviews qr
          join public.tutors t on t.id = qr.tutor_id
          left join public.admins a on a.id = t.team_lead_id
          where qr.type = 'QualityReview'
            and qr.review_cycle is not null
            and ($1::text[] is null or qr.review_cycle::text = any($1::text[]))
            and ($2::text is null or a.name ilike '%' || $2::text || '%')
            and ($3::text is null or t.t_id ilike '%' || $3::text || '%' or (t.name_i18n->>'en') ilike '%' || $3::text || '%')
            and ($4::int is null or t.status::int = $4::int)
          group by 1
          order by min(coalesce(qr.session_start_at, qr.created_at))`,
    params: ["cycles", "team_lead", "tutor", "tutor_status"],
    limit: 200,
  },

  quality_review_detail: {
    sql: `select qr.id,
                 qr.score,
                 qr.status::text as status,
                 qr.session_type::text as session_type,
                 qr.session_start_at,
                 qr.submission_date,
                 qr.due_date,
                 qr.deadline,
                 qr.duration,
                 qr.phase_number,
                 qr.review_cycle,
                 qr.has_flags,
                 qr.flags_stats,
                 qr.remarkable_session,
                 qr.needs_coaching,
                 qr.needs_immediate_action,
                 qr.immediate_action_reason,
                 qr.has_pending_objections,
                 qr.quality_objections_count,
                 qr.assurance_score,
                 qr.quality_assurance_status::text as quality_assurance_status,
                 t.t_id as tutor_tid,
                 (t.name_i18n->>'en') as tutor_name,
                 t.status::int as tutor_status,
                 a.name as team_leader,
                 (m.name_i18n->>'en') as mentor_name,
                 (l.name_i18n->>'en') as lesson_name,
                 l.position as lesson_position,
                 st.s_id as student_sid,
                 s.tutor_join_time,
                 s.student_join_time,
                 s.student_feedback,
                 s.student_feedback_comment,
                 s.is_student_absent
          from public.quality_reviews qr
          join public.tutors t on t.id = qr.tutor_id
          left join public.admins a on a.id = t.team_lead_id
          left join public.tutors m on m.id = t.mentor_id
          left join public.sessions s on s.id = qr.session_id
          left join public.students st on st.id = s.student_id
          left join public.lessons l on l.id = s.lesson_id
          where qr.id = $1::bigint`,
    params: ["review_id"],
    limit: 1,
  },

  quality_review_criteria: {
    sql: `select qe.id,
                 qe.score,
                 qc.id as criterion_id,
                 (qc.name_i18n->>'en') as criterion_name,
                 parent.id as parent_id,
                 (parent.name_i18n->>'en') as parent_name,
                 qe.comments
          from public.quality_evaluations qe
          join public.quality_criteria qc on qc.id = qe.quality_criterion_id
          left join public.quality_criteria parent on parent.id = qc.parent_id
          where qe.quality_review_id = $1::bigint
          order by coalesce(parent.name_i18n->>'en', qc.name_i18n->>'en'), qc.name_i18n->>'en'`,
    params: ["review_id"],
    limit: 200,
  },

  quality_review_comments: {
    sql: `select qrc.id,
                 coalesce(qrc.body_i18n->>'en', qcm.body_i18n->>'en') as body,
                 coalesce(qrc.comment_type, qcm.comment_type) as comment_type,
                 (qc.name_i18n->>'en') as criterion_name,
                 (parent.name_i18n->>'en') as parent_name,
                 qrc.source
          from public.quality_review_comments qrc
          left join public.quality_comments qcm on qcm.id = qrc.quality_comment_id
          left join public.quality_criteria qc
            on qc.id = coalesce(qrc.quality_criterion_id, qcm.quality_criterion_id)
          left join public.quality_criteria parent on parent.id = qc.parent_id
          where qrc.quality_review_id = $1::bigint
            and qrc.deleted_at is null
          order by coalesce(qrc.comment_type, qcm.comment_type), qrc.id`,
    params: ["review_id"],
    limit: 300,
  },

  quality_filter_options: {
    sql: `select
            (select array_agg(distinct a.name order by a.name)
               from public.tutors t join public.admins a on a.id = t.team_lead_id
              where t.active) as team_leaders,
            (select array_agg(distinct qr.session_type::text)
               from public.quality_reviews qr
              where qr.type = 'QualityReview'
                and qr.created_at > now() - interval '180 days') as session_types,
            (select array_agg(distinct qr.status::text)
               from public.quality_reviews qr
               where qr.type = 'QualityReview'
                 and qr.created_at > now() - interval '180 days') as statuses,
            (select array_agg(x order by first_at)
               from (select qr.review_cycle::text as x,
                            min(coalesce(qr.session_start_at, qr.created_at)) as first_at
                       from public.quality_reviews qr
                      where qr.type = 'QualityReview'
                        and qr.review_cycle is not null
                      group by 1) d) as review_cycles,
            (select array_agg(x order by x)
               from (select distinct coalesce(parent.name_i18n->>'en', qc.name_i18n->>'en') as x
                       from public.quality_criteria qc
                       left join public.quality_criteria parent on parent.id = qc.parent_id) d) as criteria`,
    params: [],
    limit: 1,
  },
};
