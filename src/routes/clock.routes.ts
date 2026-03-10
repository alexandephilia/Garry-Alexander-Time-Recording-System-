import { Router } from "express";
import { ClockService } from "../services/clockService.js";
import { ClockEventSchema, UserIdParamSchema } from "../schemas.js";

const router = Router();

/**
 * POST /api/clock
 * Body: { userId: number, type: "IN" | "OUT" }
 */
router.post("/", async (req, res, next) => {
  try {
    const { userId, type } = ClockEventSchema.parse(req.body);
    const event = await ClockService.recordEvent(userId, type);
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/clock/status/:userId
 */
router.get("/status/:userId", async (req, res, next) => {
  try {
    const { userId } = UserIdParamSchema.parse(req.params);
    const status = await ClockService.getStatus(userId);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

export default router;
