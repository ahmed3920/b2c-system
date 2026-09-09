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
  "organization",
  "flag",
  "mentor",
  "student",
];

const QUALITY_JOINS = `from public.quality_reviews qr
          join public.tutors t on t.id = qr.tutor_id
          left join public.admins a on a.id = t.team_lead_id
          left join public.admins m on m.id = t.mentor_id
          left join public.sessions s on s.id = qr.session_id
          left join public.students st on st.id = s.student_id
          left join public.lessons l on l.id = s.lesson_id`;

// Flags live in quality_review_flags: flag_type 1 = yellow, 2 = red.
const RED_FLAGS = `(select count(*)::int from public.quality_review_flags f
                     where f.quality_review_id = qr.id and f.deleted_at is null and f.flag_type = 2)`;
const YELLOW_FLAGS = `(select count(*)::int from public.quality_review_flags f
                        where f.quality_review_id = qr.id and f.deleted_at is null and f.flag_type = 1)`;
const FLAG_LEVEL = `(case when ${RED_FLAGS} > 0 then 'red'
                          when ${YELLOW_FLAGS} > 0 then 'yellow'
                          else 'none' end)`;

const QUALITY_CLAUSES: Record<string, string> = {
  date_from: `($1::timestamptz is null or coalesce(qr.session_start_at, qr.created_at) >= $1::timestamptz)`,
  date_to: `($2::timestamptz is null or coalesce(qr.session_start_at, qr.created_at) < ($2::timestamptz + interval '1 day'))`,
  team_lead: `($3::text is null or a.name ilike '%' || $3::text || '%')`,
  tutor: `($4::text is null or t.t_id ilike '%' || $4::text || '%' or (t.name_i18n->>'en') ilike '%' || $4::text || '%')`,
  session_type: `($5::text is null or qr.session_type::text = $5::text)`,
  status: `($6::text is null or qr.status::text = $6::text)`,
  min_score: `($7::numeric is null or qr.score >= $7::numeric)`,
  max_score: `($8::numeric is null or qr.score <= $8::numeric)`,
  review_cycle: `($9::text is null or qr.review_cycle::text = $9::text)`,
  tutor_status: `($10::int is null or t.status::int = $10::int)`,
  organization: `($11::text is null or exists (
              select 1 from public.tutor_organizations tor
              join public.organizations o on o.id = tor.organization_id
              where tor.tutor_id = t.id and o.name = $11::text))`,
  flag: `($12::text is null or case
              when $12::text = 'none' then ${FLAG_LEVEL} = 'none'
              when $12::text = 'any' then ${FLAG_LEVEL} <> 'none'
              else ${FLAG_LEVEL} = $12::text end)`,
  mentor: `($13::text is null or (btrim(m.name)) ilike '%' || $13::text || '%')`,
  student: `($14::text is null or st.s_id ilike '%' || $14::text || '%'
              or st.id::text = btrim($14::text)
              or st.name_en ilike '%' || $14::text || '%'
              or st.name ilike '%' || $14::text || '%')`,
};

/** Full WHERE, optionally leaving one filter out (used for dependent dropdowns). */
function qualityWhere(exclude?: string) {
  return `where qr.type = 'QualityReview'
            and ` + Object.entries(QUALITY_CLAUSES)
    .filter(([k]) => k !== exclude)
    .map(([, c]) => c)
    .join("\n            and ");
}

const QUALITY_WHERE = qualityWhere();

const TUTOR_ORGS = `(select string_agg(o.name, ', ' order by o.name)
                    from public.tutor_organizations tor
                    join public.organizations o on o.id = tor.organization_id
                   where tor.tutor_id = t.id)`;

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

// --- Coverage (tutors with / without a review in a cycle) ---------------
// $1 cycle, $2 team_lead, $3 tutor, $4 tutor_status, $5 mentor, $6 organization
const COVERAGE_PARAMS = ["cycle", "team_lead", "tutor", "tutor_status", "mentor", "organization"];

const COVERAGE_CTE = `with cyc as (
            select coalesce(
                     nullif($1::text, '')::date,
                     (select max(review_cycle)::date from public.quality_reviews
                       where type = 'QualityReview')
                   ) as d
          ),
          base as (
            select t.id,
                   t.t_id,
                   (t.name_i18n->>'en') as tutor_name,
                   t.status::int as tutor_status,
                   coalesce(a.name, 'Unassigned') as team_leader,
                   coalesce(btrim(m.name), 'No mentor') as mentor_name,
                   ${TUTOR_ORGS} as organizations,
                   (select (count(distinct s.group_session_id)
                              filter (where s.group_session_id is not null)
                            + count(*) filter (where s.group_session_id is null))::int
                      from public.sessions s
                     where s.tutor_id = t.id
                       and s.start_at >= (select d from cyc)
                       and s.start_at < (select d from cyc) + interval '1 month'
                       and coalesce(s.status, 0) <> 2) as sessions,
                   (select count(*)::int from public.sessions s
                     where s.tutor_id = t.id
                       and s.start_at >= (select d from cyc)
                       and s.start_at < (select d from cyc) + interval '1 month'
                       and coalesce(s.status, 0) <> 2) as student_sessions,
                   (select count(*)::int from public.quality_reviews qr
                     where qr.tutor_id = t.id
                       and qr.type = 'QualityReview'
                       and qr.review_cycle::date = (select d from cyc)) as reviews,
                   (select d from cyc) as cycle
              from public.tutors t
              left join public.admins a on a.id = t.team_lead_id
              left join public.admins m on m.id = t.mentor_id
             where ($2::text is null or a.name ilike '%' || $2::text || '%')
               and ($3::text is null or t.t_id ilike '%' || $3::text || '%'
                    or (t.name_i18n->>'en') ilike '%' || $3::text || '%')
               and ($4::int is null or t.status::int = $4::int)
               and ($5::text is null or (btrim(m.name)) ilike '%' || $5::text || '%')
               and ($6::text is null or exists (
                     select 1 from public.tutor_organizations tor
                     join public.organizations o on o.id = tor.organization_id
                     where tor.tutor_id = t.id and o.name = $6::text))
          ),
          classified as (
            select base.*,
                   case when reviews > 0 then 'reviewed'
                        when sessions > 0 then 'missing'
                        else 'no_sessions' end as coverage_state
              from base
          )`;

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
                 qr.review_cycle::text as review_cycle,
                 qr.has_flags,
                 ${RED_FLAGS} as red_flags,
                 ${YELLOW_FLAGS} as yellow_flags,
                 ${FLAG_LEVEL} as flag_level,
                 round((qr.score / 5.0 * 100)::numeric, 1) as score_pct,
                 qr.remarkable_session,
                 qr.needs_coaching,
                 qr.needs_immediate_action,
                 qr.has_pending_objections,
                 qr.quality_objections_count,
                 t.t_id as tutor_tid,
                 (t.name_i18n->>'en') as tutor_name,
                 t.status::int as tutor_status,
                 a.name as team_leader,
                 (btrim(m.name)) as mentor_name,
                 ${TUTOR_ORGS} as organizations,
                 st.s_id as student_sid,
                 st.id::text as student_id,
                 coalesce(st.name_en, st.name) as student_name,
                 (l.name_i18n->>'en') as lesson_name
          ${QUALITY_FROM}
          order by coalesce(qr.session_start_at, qr.created_at) desc
          limit coalesce($15::int, 100) offset coalesce($16::int, 0)`,
    params: [...QUALITY_PARAMS, "limit", "offset"],
    limit: 2000,
  },

  quality_reviews_count: {
    sql: `select count(*)::int as total,
                 round(avg(qr.score)::numeric, 2) as avg_score,
                 round((avg(qr.score) / 5.0 * 100)::numeric, 1) as avg_score_pct,
                 count(*) filter (where qr.needs_coaching)::int as needs_coaching,
                 count(*) filter (where qr.needs_immediate_action)::int as needs_immediate_action,
                 count(*) filter (where qr.remarkable_session)::int as remarkable,
                 count(*) filter (where qr.has_flags)::int as flagged,
                 count(*) filter (where ${RED_FLAGS} > 0)::int as red_flagged,
                 count(*) filter (where ${RED_FLAGS} = 0 and ${YELLOW_FLAGS} > 0)::int as yellow_flagged,
                 count(*) filter (where qr.has_pending_objections)::int as pending_objections,
                 count(distinct t.id)::int as tutors,
                 count(distinct a.id)::int as team_leaders
          ${QUALITY_FROM}`,
    params: QUALITY_PARAMS,
    limit: 1,
  },

  // Flag counts per team leader (red vs yellow), for the overview charts.
  quality_flag_breakdown: {
    sql: `select coalesce(a.name, 'Unassigned') as team_leader,
                 count(*)::int as reviews,
                 sum(${RED_FLAGS})::int as red_flags,
                 sum(${YELLOW_FLAGS})::int as yellow_flags,
                 count(*) filter (where ${RED_FLAGS} > 0)::int as red_reviews,
                 count(*) filter (where ${RED_FLAGS} = 0 and ${YELLOW_FLAGS} > 0)::int as yellow_reviews
          ${QUALITY_FROM}
          group by 1
          order by red_flags desc, yellow_flags desc`,
    params: QUALITY_PARAMS,
    limit: 100,
  },

  // Raw flag type distribution (diagnostics + label verification).
  quality_flag_types: {
    sql: `select f.flag_type,
                 count(*)::int as flags,
                 count(distinct qr.id)::int as reviews
          ${QUALITY_JOINS}
          join public.quality_review_flags f
            on f.quality_review_id = qr.id and f.deleted_at is null
          ${QUALITY_WHERE}
          group by 1
          order by 1`,
    params: QUALITY_PARAMS,
    limit: 20,
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
                 round((avg(qr.score) / 5.0 * 100)::numeric, 1) as avg_score_pct,
                 sum(${RED_FLAGS})::int as red_flags,
                 sum(${YELLOW_FLAGS})::int as yellow_flags,
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
                 qr.review_cycle::text as review_cycle,
                 qr.needs_coaching,
                 qr.needs_immediate_action,
                 qr.remarkable_session,
                 qr.has_flags,
                 ${RED_FLAGS} as red_flags,
                 ${YELLOW_FLAGS} as yellow_flags,
                 ${FLAG_LEVEL} as flag_level,
                 round((qr.score / 5.0 * 100)::numeric, 1) as score_pct,
                 t.t_id as tutor_tid,
                 (t.name_i18n->>'en') as tutor_name,
                 t.status::int as tutor_status,
                 a.name as team_leader,
                 (btrim(m.name)) as mentor_name,
                 (l.name_i18n->>'en') as lesson_name,
                 l.position as lesson_position,
                 st.s_id as student_sid,
                 st.id::text as student_id,
                 coalesce(st.name_en, st.name) as student_name,
                 s.tutor_join_time,
                 s.student_join_time,
                 s.student_feedback,
                 s.student_feedback_comment,
                 s.is_student_absent
          ${QUALITY_JOINS}
          ${QUALITY_WHERE}
          order by coalesce(qr.session_start_at, qr.created_at) desc
          limit coalesce($15::int, 100) offset coalesce($16::int, 0)`,
    params: [...QUALITY_PARAMS, "limit", "offset"],
    limit: 2000,
  },

  // Reviewer's written comments (evaluation notes + tagged comments), one row per comment.
  quality_comments_list: {
    sql: `select qr.id as review_id,
                 qr.score,
                 qr.session_start_at,
                 qr.review_cycle::text as review_cycle,
                 t.t_id as tutor_tid,
                 (t.name_i18n->>'en') as tutor_name,
                 t.status::int as tutor_status,
                 a.name as team_leader,
                 (btrim(m.name)) as mentor_name,
                 c.source,
                 c.body,
                 c.comment_type,
                 c.criterion_name,
                 c.parent_name,
                 c.criterion_score
          ${QUALITY_JOINS}
          join ${QUALITY_COMMENTS_UNION} on c.quality_review_id = qr.id
          ${QUALITY_WHERE}
            and ($15::text is null or c.parent_name = $15::text)
            and ($16::text is null or c.body ilike '%' || $16::text || '%')
            and ($17::int is null or c.comment_type = $17::int)
          order by coalesce(qr.session_start_at, qr.created_at) desc, qr.id desc, c.source, c.comment_type
          limit coalesce($18::int, 100) offset coalesce($19::int, 0)`,
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
            and ($15::text is null or c.parent_name = $15::text)
            and ($16::text is null or c.body ilike '%' || $16::text || '%')
            and ($17::int is null or c.comment_type = $17::int)`,
    params: [...QUALITY_PARAMS, "criterion", "search", "comment_type"],
    limit: 1,
  },

  // Comments grouped by the tutor's mentor.
  quality_comments_by_mentor: {
    sql: `select coalesce(btrim(m.name), 'No mentor') as mentor_name,
                 m.id::text as mentor_tid,
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
                 (qc.name_i18n->>'en') as criterion,
                 round(avg(qe.score)::numeric, 2) as avg_score,
                 count(*)::int as evaluations
          from public.quality_reviews qr
          join public.tutors t on t.id = qr.tutor_id
          left join public.admins a on a.id = t.team_lead_id
          left join public.admins m on m.id = t.mentor_id
          join public.quality_evaluations qe on qe.quality_review_id = qr.id
          join public.quality_criteria qc on qc.id = qe.quality_criterion_id
          left join public.quality_criteria parent on parent.id = qc.parent_id
          where qr.type = 'QualityReview'
            and qr.review_cycle::text = any($1::text[])
            and ($2::text is null or a.name ilike '%' || $2::text || '%')
            and ($3::text is null or t.t_id ilike '%' || $3::text || '%' or (t.name_i18n->>'en') ilike '%' || $3::text || '%')
            and ($4::int is null or t.status::int = $4::int)
            and ($5::text is null or (btrim(m.name)) ilike '%' || $5::text || '%')
          group by grouping sets ((1, 2, 3), (1, 2))
          order by 2, 3 nulls first, 1`,
    params: ["cycles", "team_lead", "tutor", "tutor_status", "mentor"],
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
          left join public.admins m on m.id = t.mentor_id
          where qr.type = 'QualityReview'
            and qr.review_cycle is not null
            and ($1::text[] is null or qr.review_cycle::text = any($1::text[]))
            and ($2::text is null or a.name ilike '%' || $2::text || '%')
            and ($3::text is null or t.t_id ilike '%' || $3::text || '%' or (t.name_i18n->>'en') ilike '%' || $3::text || '%')
            and ($4::int is null or t.status::int = $4::int)
            and ($5::text is null or (btrim(m.name)) ilike '%' || $5::text || '%')
          group by 1
          order by 1`,
    params: ["cycles", "team_lead", "tutor", "tutor_status", "mentor"],
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
                 qr.review_cycle::text as review_cycle,
                 qr.has_flags,
                 qr.flags_stats,
                 ${RED_FLAGS} as red_flags,
                 ${YELLOW_FLAGS} as yellow_flags,
                 ${FLAG_LEVEL} as flag_level,
                 round((qr.score / 5.0 * 100)::numeric, 1) as score_pct,
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
                 (btrim(m.name)) as mentor_name,
                 (l.name_i18n->>'en') as lesson_name,
                 l.position as lesson_position,
                 st.s_id as student_sid,
                 st.id::text as student_id,
                 coalesce(st.name_en, st.name) as student_name,
                 s.tutor_join_time,
                 s.student_join_time,
                 s.student_feedback,
                 s.student_feedback_comment,
                 s.is_student_absent
          from public.quality_reviews qr
          join public.tutors t on t.id = qr.tutor_id
          left join public.admins a on a.id = t.team_lead_id
          left join public.admins m on m.id = t.mentor_id
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

  quality_review_flags: {
    sql: `select f.id,
                 f.flag_type,
                 f.description,
                 f.status,
                 f.created_at,
                 (qc.name_i18n->>'en') as criterion_name,
                 (parent.name_i18n->>'en') as parent_name
          from public.quality_review_flags f
          left join public.quality_criteria qc on qc.id = f.quality_criterion_id
          left join public.quality_criteria parent on parent.id = qc.parent_id
          where f.quality_review_id = $1::bigint
            and f.deleted_at is null
          order by f.flag_type desc, f.id`,
    params: ["review_id"],
    limit: 100,
  },



  quality_filter_options: {
    // Each list is computed over the reviews matching every *other* filter,
    // so picking "Working" narrows the team-leader list to TLs of working tutors, etc.
    sql: `select
            (select array_agg(distinct a.name order by a.name)
               ${QUALITY_JOINS}
               ${qualityWhere("team_lead")}
                 and a.name is not null) as team_leaders,
            (select array_agg(distinct o.name order by o.name)
               ${QUALITY_JOINS}
               join public.tutor_organizations tor on tor.tutor_id = t.id
               join public.organizations o on o.id = tor.organization_id
               ${qualityWhere("organization")}) as organizations,
            (select array_agg(distinct t.status::int order by t.status::int)
               ${QUALITY_JOINS}
               ${qualityWhere("tutor_status")}
                 and t.status is not null) as tutor_statuses,
            (select array_agg(distinct qr.session_type::text order by qr.session_type::text)
               ${QUALITY_JOINS}
               ${qualityWhere("session_type")}
                 and qr.session_type is not null) as session_types,
            (select array_agg(distinct qr.status::text)
               ${QUALITY_JOINS}
               ${qualityWhere("status")}) as statuses,
            (select array_agg(distinct qr.review_cycle::text order by qr.review_cycle::text)
               ${QUALITY_JOINS}
               ${qualityWhere("review_cycle")}
                 and qr.review_cycle is not null) as review_cycles,
            (select array_agg(x order by x)
               from (select distinct coalesce(parent.name_i18n->>'en', qc.name_i18n->>'en') as x
                       from public.quality_criteria qc
                       left join public.quality_criteria parent on parent.id = qc.parent_id) d) as criteria`,
    params: QUALITY_PARAMS,
    limit: 1,
  },

  // --- Review coverage per cycle ---------------------------------------
  // Which tutors already have a review in the selected cycle, which are
  // still missing one, and which had no active session (so none is due).
  quality_cycles_list: {
    sql: `select distinct review_cycle::text as cycle
          from public.quality_reviews
          where type = 'QualityReview' and review_cycle is not null
          order by 1 desc`,
    params: [],
    limit: 100,
  },

  quality_coverage_list: {
    sql: `${COVERAGE_CTE}
          select t_id as tutor_tid,
                 tutor_name,
                 tutor_status,
                 team_leader,
                 mentor_name,
                 organizations,
                 sessions,
                 student_sessions,
                 reviews,
                 coverage_state,
                 cycle::text as cycle
          from classified
          where ($7::text is null or coverage_state = $7::text)
          order by (coverage_state = 'missing') desc, sessions desc, tutor_name
          limit coalesce($8::int, 100) offset coalesce($9::int, 0)`,
    params: COVERAGE_PARAMS.concat(["coverage", "limit", "offset"]),
    limit: 5000,
  },

  quality_coverage_summary: {
    sql: `${COVERAGE_CTE}
          select count(*)::int as total,
                 count(*) filter (where coverage_state = 'reviewed')::int as reviewed,
                 count(*) filter (where coverage_state = 'missing')::int as missing,
                 count(*) filter (where coverage_state = 'no_sessions')::int as no_sessions,
                 max(cycle)::text as cycle
          from classified`,
    params: COVERAGE_PARAMS,
    limit: 1,
  },
};
