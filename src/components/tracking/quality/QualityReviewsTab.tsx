import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Database, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useReplicaQuery } from "@/hooks/useReplicaQuery";

type CheckRow = {
  database: string;
  db_user: string;
  server_version: string;
  server_time: string;
};

type TableRow = { table_schema: string; table_name: string };

/**
 * Reviews tab — currently shows the live connection status to the iSchool
 * replica and what it exposes. Real review reports plug in here as soon as
 * their queries are registered in the gateway.
 */
export function QualityReviewsTab() {
  const [showTables, setShowTables] = useState(false);
  const check = useReplicaQuery<CheckRow>("connection_check");
  const tables = useReplicaQuery<TableRow>("list_tables", {}, { enabled: showTables });

  const info = check.rows[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-4 h-4" />
            iSchool data connection
          </CardTitle>
          <Button size="sm" variant="outline" onClick={check.refetch} disabled={check.loading}>
            {check.loading ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            )}
            Check again
          </Button>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          {check.loading && !info ? (
            <p className="text-muted-foreground">Checking the connection…</p>
          ) : check.error ? (
            <p className="text-destructive flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {check.error}
            </p>
          ) : info ? (
            <>
              <p className="text-green-600 dark:text-green-500 flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Connected — read-only
              </p>
              <div className="grid gap-1 text-muted-foreground">
                <div>
                  Database: <span className="text-foreground font-mono">{info.database}</span>
                </div>
                <div>
                  Server time:{" "}
                  <span className="text-foreground font-mono">
                    {new Date(info.server_time).toLocaleString()}
                  </span>
                </div>
                <div className="truncate">Version: {info.server_version}</div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Available data</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => (showTables ? tables.refetch() : setShowTables(true))}
            disabled={tables.loading}
          >
            {tables.loading ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            )}
            {showTables ? "Reload" : "Load list"}
          </Button>
        </CardHeader>
        <CardContent className="text-sm">
          {!showTables ? (
            <p className="text-muted-foreground">
              Quality review reports will appear here. Load the list to see what the connection
              exposes.
            </p>
          ) : tables.error ? (
            <p className="text-destructive">{tables.error}</p>
          ) : tables.loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <>
              <p className="text-muted-foreground mb-2">{tables.rows.length} tables found.</p>
              <div className="flex flex-wrap gap-1.5 max-h-72 overflow-y-auto">
                {tables.rows.map((t) => (
                  <Badge
                    key={`${t.table_schema}.${t.table_name}`}
                    variant="secondary"
                    className="font-mono text-[11px]"
                  >
                    {t.table_schema === "public" ? t.table_name : `${t.table_schema}.${t.table_name}`}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
