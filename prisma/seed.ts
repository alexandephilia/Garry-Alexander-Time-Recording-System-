import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create test user
  await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      name: "Test User",
    },
  });

  // Seed work rules (0=Sun, 6=Sat)
  const rules = [
    { dayOfWeek: 0, isWorkingDay: false, normalHours: 0 },
    { dayOfWeek: 1, isWorkingDay: true, normalHours: 8 },
    { dayOfWeek: 2, isWorkingDay: true, normalHours: 8 },
    { dayOfWeek: 3, isWorkingDay: true, normalHours: 8 },
    { dayOfWeek: 4, isWorkingDay: true, normalHours: 8 },
    { dayOfWeek: 5, isWorkingDay: true, normalHours: 8 },
    { dayOfWeek: 6, isWorkingDay: false, normalHours: 0 },
  ];

  for (const rule of rules) {
    await prisma.workRule.upsert({
      where: { dayOfWeek: rule.dayOfWeek },
      update: rule,
      create: rule,
    });
  }

  console.log("Seed data created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
