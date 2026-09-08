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
  // Placeholder — replaced with the real quality review SQL once provided.
};
