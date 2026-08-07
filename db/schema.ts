import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cases = sqliteTable(
  "cases",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    waterNumber: text("water_number").notNull(),
    customerName: text("customer_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    coordinates: text("coordinates").notNull().default(""),
    meterNumber: text("meter_number").notNull().default(""),
    reason: text("reason").notNull().default(""),
    receivedDate: text("received_date").notNull().default(""),
    status: text("status").notNull().default("待處理"),
    customStatus: text("custom_status").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("cases_owner_updated_idx").on(table.ownerEmail, table.updatedAt),
    index("cases_owner_water_idx").on(table.ownerEmail, table.waterNumber),
  ],
);

export const caseRecords = sqliteTable(
  "case_records",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    ownerEmail: text("owner_email").notNull(),
    date: text("date").notNull(),
    method: text("method").notNull(),
    pointer: text("pointer").notNull().default(""),
    process: text("process").notNull().default(""),
    result: text("result").notNull().default(""),
    nextStep: text("next_step").notNull().default(""),
    followUpDate: text("follow_up_date").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("records_case_date_idx").on(table.caseId, table.date),
    index("records_owner_idx").on(table.ownerEmail),
  ],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    recordId: text("record_id").references(() => caseRecords.id, {
      onDelete: "cascade",
    }),
    ownerEmail: text("owner_email").notNull(),
    category: text("category").notNull(),
    objectKey: text("object_key").notNull().unique(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("attachments_case_idx").on(table.caseId),
    index("attachments_record_idx").on(table.recordId),
    index("attachments_owner_idx").on(table.ownerEmail),
  ],
);

export const dailyRoutes = sqliteTable(
  "daily_routes",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    routeDate: text("route_date").notNull(),
    startLabel: text("start_label").notNull().default("虎尾服務營運所"),
    startCoordinates: text("start_coordinates").notNull().default(""),
    endLabel: text("end_label").notNull().default("不限"),
    endCoordinates: text("end_coordinates").notNull().default(""),
    status: text("status").notNull().default("draft"),
    currentStopId: text("current_stop_id").notNull().default(""),
    startedAt: text("started_at").notNull().default(""),
    completedAt: text("completed_at").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("daily_routes_owner_date_idx").on(table.ownerEmail, table.routeDate),
    index("daily_routes_owner_status_idx").on(table.ownerEmail, table.status),
  ],
);

export const dailyRouteStops = sqliteTable(
  "daily_route_stops",
  {
    id: text("id").primaryKey(),
    routeId: text("route_id")
      .notNull()
      .references(() => dailyRoutes.id, { onDelete: "cascade" }),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    ownerEmail: text("owner_email").notNull(),
    position: integer("position").notNull(),
    coordinateSnapshot: text("coordinate_snapshot").notNull().default(""),
    coordinateSourceSnapshot: text("coordinate_source_snapshot")
      .notNull()
      .default("unknown"),
    status: text("status").notNull().default("pending"),
    arrivedAt: text("arrived_at").notNull().default(""),
    completedAt: text("completed_at").notNull().default(""),
    skippedReason: text("skipped_reason").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("daily_route_stops_route_position_idx").on(
      table.routeId,
      table.position,
    ),
    index("daily_route_stops_owner_idx").on(table.ownerEmail),
    index("daily_route_stops_case_idx").on(table.caseId),
  ],
);
