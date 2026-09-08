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
// session_type, status, min_score, max_score.
const QUALITY_JOINS = `from public.quality_reviews qr
          join public.tutors t on t.id = qr.tutor_id
          left join public.admins a on a.id = t.team_lead_id
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
            and ($8::numeric is null or qr.score <= $8::numeric)`;

const QUALITY_FROM = `${QUALITY_JOINS}
          ${QUALITY_WHERE}`;


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
                 qr.has_flags,
                 qr.remarkable_session,
                 qr.needs_coaching,
                 qr.needs_immediate_action,
                 qr.has_pending_objections,
                 qr.quality_objections_count,
                 t.t_id as tutor_tid,
                 (t.name_i18n->>'en') as tutor_name,
                 a.name as team_leader,
                 (l.name_i18n->>'en') as lesson_name
          ${QUALITY_FROM}
          order by coalesce(qr.session_start_at, qr.created_at) desc
          limit coalesce($9::int, 100) offset coalesce($10::int, 0)`,
    params: [
      "date_from",
      "date_to",
      "team_lead",
      "tutor",
      "session_type",
      "status",
      "min_score",
      "max_score",
      "limit",
      "offset",
    ],
    limit: 2000,
  },

  quality_reviews_count: {
    sql: `select count(*)::int as total,
                 round(avg(qr.score)::numeric, 2) as avg_score,
                 count(*) filter (where qr.needs_coaching)::int as needs_coaching,
                 count(*) filter (where qr.needs_immediate_action)::int as needs_immediate_action,
                 count(*) filter (where qr.remarkable_session)::int as remarkable,
                 count(distinct t.id)::int as tutors
          ${QUALITY_FROM}`,
    params: [
      "date_from",
      "date_to",
      "team_lead",
      "tutor",
      "session_type",
      "status",
      "min_score",
      "max_score",
    ],
    limit: 1,
  },

  quality_category_averages: {
    sql: `select coalesce(parent.name_i18n->>'en', qc.name_i18n->>'en') as category,
                 round(avg(qe.score)::numeric, 2) as avg_score,
                 count(*)::int as evaluations
          ${QUALITY_FROM}
            and true
          join public.quality_evaluations qe on qe.quality_review_id = qr.id
          join public.quality_criteria qc on qc.id = qe.quality_criterion_id
          left join public.quality_criteria parent on parent.id = qc.parent_id
          group by 1
          order by 1`,
    params: [
      "date_from",
      "date_to",
      "team_lead",
      "tutor",
      "session_type",
      "status",
      "min_score",
      "max_score",
    ],
    limit: 50,
  },

  quality_by_team_leader: {
    sql: `select coalesce(a.name, 'Unassigned') as team_leader,
                 count(*)::int as reviews,
                 round(avg(qr.score)::numeric, 2) as avg_score
          ${QUALITY_FROM}
          group by 1
          order by avg_score desc nulls last`,
    params: [
      "date_from",
      "date_to",
      "team_lead",
      "tutor",
      "session_type",
      "status",
      "min_score",
      "max_score",
    ],
    limit: 100,
  },

  quality_by_tutor: {
    sql: `select t.t_id as tutor_tid,
                 (t.name_i18n->>'en') as tutor_name,
                 coalesce(a.name, 'Unassigned') as team_leader,
                 count(*)::int as reviews,
                 round(avg(qr.score)::numeric, 2) as avg_score,
                 count(*) filter (where qr.needs_coaching)::int as needs_coaching
          ${QUALITY_FROM}
          group by 1, 2, 3
          order by avg_score asc nulls last`,
    params: [
      "date_from",
      "date_to",
      "team_lead",
      "tutor",
      "session_type",
      "status",
      "min_score",
      "max_score",
    ],
    limit: 1000,
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
                 a.name as team_leader,
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
                and qr.created_at > now() - interval '180 days') as statuses`,
    params: [],
    limit: 1,
  },
};

