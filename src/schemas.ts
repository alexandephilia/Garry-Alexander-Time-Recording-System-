import { z } from "zod";

/** POST /api/clock body */
export const ClockEventSchema = z.object({
  userId: z.number().int().positive({ message: "'userId' must be a positive integer." }),
  type: z.enum(["IN", "OUT"], { message: "'type' must be 'IN' or 'OUT'." }),
});

/** POST /api/users body */
export const CreateUserSchema = z.object({
  email: z.string().email("Invalid email format."),
  name: z.string().optional(),
});

/** Route params with numeric IDs */
export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive({ message: "'id' must be a positive integer." }),
});

export const UserIdParamSchema = z.object({
  userId: z.coerce.number().int().positive({ message: "'userId' must be a positive integer." }),
});

/** PUT /api/events/:id body */
export const UpdateEventSchema = z.object({
  timestamp: z.string().refine((s) => !isNaN(Date.parse(s)), {
    message: "Must be a valid ISO 8601 datetime.",
  }),
});

/** GET /api/report query */
export const ReportQuerySchema = z.object({
  userId: z.coerce.number().int().positive(),
  start: z.string().refine((s) => !isNaN(Date.parse(s)), {
    message: "'start' must be a valid date string.",
  }),
  end: z.string().refine((s) => !isNaN(Date.parse(s)), {
    message: "'end' must be a valid date string.",
  }),
});

/** GET /api/events query */
export const ListEventsQuerySchema = z.object({
  userId: z.coerce.number().int().positive(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type ClockEventInput = z.infer<typeof ClockEventSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type IdParamInput = z.infer<typeof IdParamSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
export type ReportQueryInput = z.infer<typeof ReportQuerySchema>;
export type ListEventsQueryInput = z.infer<typeof ListEventsQuerySchema>;
export type UserIdParamInput = z.infer<typeof UserIdParamSchema>;
