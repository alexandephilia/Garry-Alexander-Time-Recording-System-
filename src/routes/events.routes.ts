import { Router } from "express";
import { ClockService } from "../services/clockService.js";
import { IdParamSchema, ListEventsQuerySchema, UpdateEventSchema } from "../schemas.js";

const router = Router();

/**
 * GET /api/events?userId=1&page=1&limit=20
 */
router.get("/", async (req, res, next) => {
  try {
    const { userId, page, limit } = ListEventsQuerySchema.parse(req.query);
    const result = await ClockService.listEvents(userId, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/events/:id
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = IdParamSchema.parse(req.params);
    const event = await ClockService.getEventById(id);
    res.json(event);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/events/:id
 * Body: { timestamp: "<ISO 8601>" }
 */
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = IdParamSchema.parse(req.params);
    const data = UpdateEventSchema.parse(req.body);
    const event = await ClockService.updateEvent(id, data);
    res.json(event);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/events/:id
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = IdParamSchema.parse(req.params);
    const result = await ClockService.deleteEvent(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
