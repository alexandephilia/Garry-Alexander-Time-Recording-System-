import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma.js";
import { parseReportBoundary } from "../src/routes/report.routes.js";
import { ReportService } from "../src/services/reportService.js";

const TEST_EMAIL = "report-tests@example.com";

async function main() {
  const userId = await ensureUser();

  try {
    await ensureWorkRules();

    console.log("1. Counts sessions overlapping the report start boundary...");
    await replaceEvents(userId, [
      { type: "IN", timestamp: "2026-03-10T22:00:00.000Z" },
      { type: "OUT", timestamp: "2026-03-11T02:00:00.000Z" },
    ]);

    const boundaryReport = await ReportService.generateReport(
      userId,
      new Date("2026-03-11T00:00:00.000Z"),
      new Date("2026-03-11T23:59:59.999Z")
    );

    assert.equal(boundaryReport.daily.length, 1);
    assertDaily(boundaryReport.daily[0], "2026-03-11", 2, 0);

    console.log("2. Counts open sessions only through the report end boundary...");
    await replaceEvents(userId, [
      { type: "IN", timestamp: "2026-03-12T22:00:00.000Z" },
    ]);

    const openSessionReport = await ReportService.generateReport(
      userId,
      new Date("2026-03-13T00:00:00.000Z"),
      new Date("2026-03-13T03:00:00.000Z")
    );

    assert.equal(openSessionReport.daily.length, 1);
    assertDaily(openSessionReport.daily[0], "2026-03-13", 3, 0);

    console.log("3. Splits overnight work into separate UTC days with overtime... ");
    await replaceEvents(userId, [
      { type: "IN", timestamp: "2026-03-16T20:00:00.000Z" },
      { type: "OUT", timestamp: "2026-03-17T10:00:00.000Z" },
    ]);

    const overnightReport = await ReportService.generateReport(
      userId,
      new Date("2026-03-16T00:00:00.000Z"),
      new Date("2026-03-17T23:59:59.999Z")
    );

    assert.equal(overnightReport.daily.length, 2);
    assertDaily(overnightReport.daily[0], "2026-03-16", 4, 0);
    assertDaily(overnightReport.daily[1], "2026-03-17", 10, 2);
    assert.equal(overnightReport.totals.workedHours, 14);
    assert.equal(overnightReport.totals.overtime, 2);

    console.log("4. Normalizes date-only report end values to include the full day...");
    assert.equal(
      parseReportBoundary("2026-03-31", "end").toISOString(),
      "2026-03-31T23:59:59.999Z"
    );

    await replaceEvents(userId, [
      { type: "IN", timestamp: "2026-03-31T18:00:00.000Z" },
      { type: "OUT", timestamp: "2026-03-31T20:00:00.000Z" },
    ]);

    const dateOnlyReport = await ReportService.generateReport(
      userId,
      parseReportBoundary("2026-03-31", "start"),
      parseReportBoundary("2026-03-31", "end")
    );

    assert.equal(dateOnlyReport.daily.length, 1);
    assertDaily(dateOnlyReport.daily[0], "2026-03-31", 2, 0);

    console.log("✅ Focused report edge-case checks passed");
  } finally {
    await prisma.clockEvent.deleteMany({ where: { userId } });
    await prisma.$disconnect();
  }
}

function assertDaily(
  entry: { date: string; workedHours: number; overtime: number },
  date: string,
  workedHours: number,
  overtime: number
) {
  assert.equal(entry.date, date);
  assert.equal(entry.workedHours, workedHours);
  assert.equal(entry.overtime, overtime);
}

async function ensureUser() {
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: { email: TEST_EMAIL, name: "Report Test User" },
  });

  return user.id;
}

async function ensureWorkRules() {
  const rules = [
    { dayOfWeek: 0, isWorkingDay: false, normalHours: 0 },
    { dayOfWeek: 1, isWorkingDay: true, normalHours: 8 },
    { dayOfWeek: 2, isWorkingDay: true, normalHours: 8 },
    { dayOfWeek: 3, isWorkingDay: true, normalHours: 8 },
    { dayOfWeek: 4, isWorkingDay: true, normalHours: 8 },
    { dayOfWeek: 5, isWorkingDay: true, normalHours: 8 },
    { dayOfWeek: 6, isWorkingDay: false, normalHours: 0 },
  ];

  await Promise.all(
    rules.map((rule) =>
      prisma.workRule.upsert({
        where: { dayOfWeek: rule.dayOfWeek },
        update: rule,
        create: rule,
      })
    )
  );
}

async function replaceEvents(
  userId: number,
  events: Array<{ type: "IN" | "OUT"; timestamp: string }>
) {
  await prisma.clockEvent.deleteMany({ where: { userId } });

  for (const event of events) {
    await prisma.clockEvent.create({
      data: {
        userId,
        type: event.type,
        timestamp: new Date(event.timestamp),
      },
    });
  }
}

main().catch((error) => {
  console.error("❌ Report edge-case checks failed");
  console.error(error);
  process.exit(1);
});