import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "janitor",
  "ops_admin",
  "super_admin",
]);

export const recurrenceTypeEnum = pgEnum("recurrence_type", [
  "daily",
  "hourly",
  "weekly",
  "weekly_multi",
  "biweekly",
  "monthly",
  "quarterly",
  "biannual",
]);

export const occurrenceStatusEnum = pgEnum("occurrence_status", [
  "pending",
  "completed",
  "overdue",
  "missed",
]);

export const criticalityEnum = pgEnum("criticality", ["standard", "critical"]);

export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  timezone: text("timezone").notNull().default("Africa/Lagos"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    facilityId: integer("facility_id").references(() => facilities.id),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull().default("janitor"),
    phone: text("phone"),
    email: text("email"),
    pinHash: text("pin_hash"),
    passwordHash: text("password_hash"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_phone_uq").on(t.phone),
    uniqueIndex("users_email_uq").on(t.email),
  ],
);

export const taskTemplates = pgTable(
  "task_templates",
  {
    id: serial("id").primaryKey(),
    facilityId: integer("facility_id")
      .notNull()
      .references(() => facilities.id),
    name: text("name").notNull(),
    location: text("location"),
    category: text("category").notNull().default("soft_service"),
    recurrenceType: recurrenceTypeEnum("recurrence_type").notNull(),
    recurrenceConfig: jsonb("recurrence_config").notNull().default({}),
    requiresPhoto: boolean("requires_photo").notNull().default(true),
    instructions: text("instructions"),
    criticality: criticalityEnum("criticality").notNull().default("standard"),
    assignedUserId: integer("assigned_user_id").references(() => users.id),
    active: boolean("active").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("task_templates_facility_idx").on(t.facilityId)],
);

export const taskOccurrences = pgTable(
  "task_occurrences",
  {
    id: serial("id").primaryKey(),
    taskTemplateId: integer("task_template_id")
      .notNull()
      .references(() => taskTemplates.id),
    facilityId: integer("facility_id")
      .notNull()
      .references(() => facilities.id),
    dueDate: date("due_date").notNull(),
    dueHour: integer("due_hour"),
    windowStart: date("window_start").notNull(),
    windowEnd: date("window_end").notNull(),
    status: occurrenceStatusEnum("status").notNull().default("pending"),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("occurrence_template_due_uq").on(t.taskTemplateId, t.dueDate, t.dueHour),
    index("occurrence_due_idx").on(t.dueDate),
  ],
);

export const taskLogs = pgTable(
  "task_logs",
  {
    id: serial("id").primaryKey(),
    taskOccurrenceId: integer("task_occurrence_id")
      .notNull()
      .references(() => taskOccurrences.id),
    janitorId: integer("janitor_id")
      .notNull()
      .references(() => users.id),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    notes: text("notes"),
    gpsLat: doublePrecision("gps_lat"),
    gpsLng: doublePrecision("gps_lng"),
    statusAtLogTime: occurrenceStatusEnum("status_at_log_time")
      .notNull()
      .default("pending"),
    clientLogId: text("client_log_id"),
    completionMetadata: jsonb("completion_metadata"),
    syncedOffline: boolean("synced_offline").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("task_logs_client_uq").on(t.clientLogId),
    index("task_logs_occurrence_idx").on(t.taskOccurrenceId),
  ],
);

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  taskLogId: integer("task_log_id")
    .notNull()
    .references(() => taskLogs.id),
  url: text("url").notNull(),
  storageKey: text("storage_key").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id")
    .notNull()
    .references(() => facilities.id),
  taskOccurrenceId: integer("task_occurrence_id").references(
    () => taskOccurrences.id,
  ),
  severity: text("severity").notNull().default("warning"),
  channel: text("channel").notNull().default("in_app"),
  message: text("message").notNull(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  meta: jsonb("meta").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const customTaskStatusEnum = pgEnum("custom_task_status", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

export const customTasks = pgTable(
  "custom_tasks",
  {
    id: serial("id").primaryKey(),
    facilityId: integer("facility_id")
      .notNull()
      .references(() => facilities.id),
    createdById: integer("created_by_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    area: text("area"),
    instructions: text("instructions"),
    dueDate: date("due_date"),
    priority: text("priority").notNull().default("standard"),
    status: customTaskStatusEnum("status").notNull().default("pending"),
    requiresPhoto: boolean("requires_photo").notNull().default(true),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: integer("completed_by").references(() => users.id),
    completionNotes: text("completion_notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("custom_tasks_facility_idx").on(t.facilityId),
    index("custom_tasks_status_idx").on(t.status),
  ],
);

export const taskAssignments = pgTable(
  "task_assignments",
  {
    id: serial("id").primaryKey(),
    customTaskId: integer("custom_task_id")
      .notNull()
      .references(() => customTasks.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("task_assignments_task_idx").on(t.customTaskId),
    index("task_assignments_user_idx").on(t.userId),
  ],
);

export const customTaskPhotos = pgTable("custom_task_photos", {
  id: serial("id").primaryKey(),
  customTaskId: integer("custom_task_id")
    .notNull()
    .references(() => customTasks.id),
  uploadedBy: integer("uploaded_by")
    .notNull()
    .references(() => users.id),
  url: text("url").notNull(),
  storageKey: text("storage_key").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const consumables = pgTable("consumables", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id").notNull().references(() => facilities.id),
  name: text("name").notNull(),
  category: text("category").notNull().default("general"),
  unit: text("unit").notNull().default("pcs"),
  currentStock: integer("current_stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(10),
  maxStock: integer("max_stock").notNull().default(100),
  unitCost: doublePrecision("unit_cost"),
  location: text("location"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("consumables_facility_idx").on(t.facilityId),
]);

export const consumableDeliveries = pgTable("consumable_deliveries", {
  id: serial("id").primaryKey(),
  consumableId: integer("consumable_id").notNull().references(() => consumables.id),
  receivedById: integer("received_by_id").notNull().references(() => users.id),
  quantity: integer("quantity").notNull(),
  supplier: text("supplier"),
  waybillNumber: text("waybill_number"),
  notes: text("notes"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("consumable_deliveries_consumable_idx").on(t.consumableId),
]);

export const consumableUsage = pgTable("consumable_usage", {
  id: serial("id").primaryKey(),
  consumableId: integer("consumable_id").notNull().references(() => consumables.id),
  usedById: integer("used_by_id").notNull().references(() => users.id),
  quantity: integer("quantity").notNull(),
  area: text("area"),
  notes: text("notes"),
  usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("consumable_usage_consumable_idx").on(t.consumableId),
]);

export const incidentStatusEnum = pgEnum("incident_status", [
  "open",
  "assigned",
  "in_progress",
  "resolved",
]);

export const incidents = pgTable(
  "incidents",
  {
    id: serial("id").primaryKey(),
    facilityId: integer("facility_id")
      .notNull()
      .references(() => facilities.id),
    reportedById: integer("reported_by_id")
      .notNull()
      .references(() => users.id),
    assignedToId: integer("assigned_to_id").references(() => users.id),
    area: text("area").notNull(),
    description: text("description"),
    status: incidentStatusEnum("status").notNull().default("open"),
    priority: text("priority").notNull().default("standard"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNotes: text("resolution_notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("incidents_facility_idx").on(t.facilityId),
    index("incidents_status_idx").on(t.status),
    index("incidents_assigned_idx").on(t.assignedToId),
  ],
);

export const incidentPhotos = pgTable(
  "incident_photos",
  {
    id: serial("id").primaryKey(),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incidents.id),
    uploadedBy: integer("uploaded_by")
      .notNull()
      .references(() => users.id),
    photoType: text("photo_type").notNull().default("before"),
    url: text("url").notNull(),
    storageKey: text("storage_key").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("incident_photos_incident_idx").on(t.incidentId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    entityType: text("entity_type"),
    entityId: integer("entity_id"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId),
    index("notifications_read_idx").on(t.read),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_uq").on(t.endpoint)],
);

export type Facility = typeof facilities.$inferSelect;
export type User = typeof users.$inferSelect;
export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type TaskOccurrence = typeof taskOccurrences.$inferSelect;
export type TaskLog = typeof taskLogs.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type CustomTask = typeof customTasks.$inferSelect;
export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type Consumable = typeof consumables.$inferSelect;
export type ConsumableDelivery = typeof consumableDeliveries.$inferSelect;
export type ConsumableUsage = typeof consumableUsage.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type IncidentPhoto = typeof incidentPhotos.$inferSelect;
