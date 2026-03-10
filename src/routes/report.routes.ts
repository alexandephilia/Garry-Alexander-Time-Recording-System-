import { Router } from "express";
import { ReportService } from "../services/reportService.js";
import { ReportQuerySchema } from "../schemas.js";
import { ValidationError } from "../errors.js";

const router = Router();
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseReportBoundary(
  value: string,
  boundary: "start" | "end"
): Date {
  if (DATE_ONLY_PATTERN.test(value)) {
    const time = boundary === "start" ? "00:00:00.000" : "23:59:59.999";
    return new Date(`${value}T${time}Z`);
  }

  return new Date(value);
}

/**
 * GET /api/report?userId=1&start=2026-03-01T00:00:00Z&end=2026-03-31T23:59:59Z
 */
router.get("/", async (req, res, next) => {
  try {
    const { userId, start, end } = ReportQuerySchema.parse(req.query);

    const startDate = parseReportBoundary(start, "start");
    const endDate = parseReportBoundary(end, "end");

    if (startDate > endDate) {
      throw new ValidationError("'start' must be before 'end'.");
    }

    const report = await ReportService.generateReport(userId, startDate, endDate);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

export default router;
