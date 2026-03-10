import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../errors.js";

const MS_PER_HOUR = 1000 * 60 * 60;

interface DailyEntry {
  date: string;
  isWorkday: boolean;
  workedHours: number;
  normalHours: number;
  overtime: number;
}

interface Report {
  userId: number;
  startDate: string;
  endDate: string;
  daily: DailyEntry[];
  totals: {
    workedHours: number;
    overtime: number;
    regularHours: number;
  };
}

/**
 * Generates time reports with daily breakdowns and overtime calculations.
 */
export class ReportService {
  static async generateReport(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<Report> {
    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User", userId);

    // Fetch all events up to the report boundary so sessions that start before
    // the selected range can still be reconstructed and clipped correctly.
    const events = await prisma.clockEvent.findMany({
      where: {
        userId,
        timestamp: { lte: endDate },
      },
      orderBy: { timestamp: "asc" },
    });

    // Load work rules into a map keyed by day-of-week (0=Sun .. 6=Sat)
    const workRules = await prisma.workRule.findMany();
    const rulesMap = new Map(workRules.map((r) => [r.dayOfWeek, r]));

    // Accumulate worked hours per calendar date
    const dailyMap = new Map<string, number>();
    let currentIn: Date | null = null;

    for (const event of events) {
      if (event.type === "IN") {
        currentIn = event.timestamp;
      } else if (event.type === "OUT" && currentIn) {
        ReportService.addClippedSessionToDailyMap(
          dailyMap,
          currentIn,
          event.timestamp,
          startDate,
          endDate
        );
        currentIn = null;
      }
    }

    // If still clocked in at report time, count up to endDate
    if (currentIn) {
      ReportService.addClippedSessionToDailyMap(
        dailyMap,
        currentIn,
        endDate,
        startDate,
        endDate
      );
    }

    // Build daily entries with overtime calculation
    let totalWorked = 0;
    let totalOvertime = 0;

    const daily: DailyEntry[] = [];

    for (const [dateStr, workedRaw] of dailyMap.entries()) {
      const dayOfWeek = new Date(dateStr).getUTCDay();
      const rule = rulesMap.get(dayOfWeek);
      const isWorkday = rule?.isWorkingDay ?? true;
      const normalHours = isWorkday ? (rule?.normalHours ?? 8) : 0;
      const worked = Math.round(workedRaw * 100) / 100;
      const overtime =
        Math.round(Math.max(0, worked - normalHours) * 100) / 100;

      daily.push({ date: dateStr, isWorkday, workedHours: worked, normalHours, overtime });
      totalWorked += worked;
      totalOvertime += overtime;
    }

    // Sort by date
    daily.sort((a, b) => a.date.localeCompare(b.date));

    return {
      userId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      daily,
      totals: {
        workedHours: Math.round(totalWorked * 100) / 100,
        overtime: Math.round(totalOvertime * 100) / 100,
        regularHours:
          Math.round((totalWorked - totalOvertime) * 100) / 100,
      },
    };
  }

  private static addClippedSessionToDailyMap(
    dailyMap: Map<string, number>,
    sessionStart: Date,
    sessionEnd: Date,
    rangeStart: Date,
    rangeEnd: Date
  ) {
    const clippedStart = new Date(
      Math.max(sessionStart.getTime(), rangeStart.getTime())
    );
    const clippedEnd = new Date(
      Math.min(sessionEnd.getTime(), rangeEnd.getTime())
    );

    if (clippedEnd <= clippedStart) {
      return;
    }

    let cursor = clippedStart;

    while (cursor < clippedEnd) {
      const nextDayBoundary = ReportService.startOfNextUtcDay(cursor);
      const segmentEnd =
        nextDayBoundary < clippedEnd ? nextDayBoundary : clippedEnd;
      const dateKey = ReportService.toUtcDateKey(cursor);
      const hours =
        (segmentEnd.getTime() - cursor.getTime()) / MS_PER_HOUR;

      dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + hours);
      cursor = segmentEnd;
    }
  }

  private static startOfNextUtcDay(date: Date): Date {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + 1
      )
    );
  }

  private static toUtcDateKey(date: Date): string {
    return date.toISOString().split("T")[0];
  }
}
