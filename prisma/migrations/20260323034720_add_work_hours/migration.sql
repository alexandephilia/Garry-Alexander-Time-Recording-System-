-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dayOfWeek" INTEGER NOT NULL,
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
    "normalHours" REAL NOT NULL DEFAULT 8.0,
    "startTime" TEXT NOT NULL DEFAULT '09:00',
    "endTime" TEXT NOT NULL DEFAULT '18:00'
);
INSERT INTO "new_WorkRule" ("dayOfWeek", "id", "isWorkingDay", "normalHours") SELECT "dayOfWeek", "id", "isWorkingDay", "normalHours" FROM "WorkRule";
DROP TABLE "WorkRule";
ALTER TABLE "new_WorkRule" RENAME TO "WorkRule";
CREATE UNIQUE INDEX "WorkRule_dayOfWeek_key" ON "WorkRule"("dayOfWeek");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
