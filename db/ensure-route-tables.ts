let initialized = false;

export async function ensureRouteTables() {
  if (initialized) return;
  const database = globalThis.__INSPECTION_ENV__?.DB;
  if (!database) throw new Error("Cloudflare D1 binding `DB` is unavailable");

  await database.exec(`
    CREATE TABLE IF NOT EXISTS daily_routes (
      id text PRIMARY KEY NOT NULL,
      owner_email text NOT NULL,
      route_date text NOT NULL,
      start_label text DEFAULT '虎尾服務營運所' NOT NULL,
      start_coordinates text DEFAULT '' NOT NULL,
      end_label text DEFAULT '不限' NOT NULL,
      end_coordinates text DEFAULT '' NOT NULL,
      status text DEFAULT 'draft' NOT NULL,
      current_stop_id text DEFAULT '' NOT NULL,
      started_at text DEFAULT '' NOT NULL,
      completed_at text DEFAULT '' NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );
    CREATE INDEX IF NOT EXISTS daily_routes_owner_date_idx
      ON daily_routes (owner_email, route_date);
    CREATE INDEX IF NOT EXISTS daily_routes_owner_status_idx
      ON daily_routes (owner_email, status);
    CREATE TABLE IF NOT EXISTS daily_route_stops (
      id text PRIMARY KEY NOT NULL,
      route_id text NOT NULL,
      case_id text NOT NULL,
      owner_email text NOT NULL,
      position integer NOT NULL,
      coordinate_snapshot text DEFAULT '' NOT NULL,
      coordinate_source_snapshot text DEFAULT 'unknown' NOT NULL,
      status text DEFAULT 'pending' NOT NULL,
      arrived_at text DEFAULT '' NOT NULL,
      completed_at text DEFAULT '' NOT NULL,
      skipped_reason text DEFAULT '' NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      FOREIGN KEY (route_id) REFERENCES daily_routes(id) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON UPDATE no action ON DELETE cascade
    );
    CREATE INDEX IF NOT EXISTS daily_route_stops_route_position_idx
      ON daily_route_stops (route_id, position);
    CREATE INDEX IF NOT EXISTS daily_route_stops_owner_idx
      ON daily_route_stops (owner_email);
    CREATE INDEX IF NOT EXISTS daily_route_stops_case_idx
      ON daily_route_stops (case_id);
  `);
  initialized = true;
}
