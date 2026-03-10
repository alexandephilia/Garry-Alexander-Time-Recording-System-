import axios, { AxiosError } from "axios";
import { EventType, PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = process.env.BASE_URL ?? "http://localhost:3000/api";
const createdUserIds: number[] = [];

async function main() {
  console.log("Checking event CRUD invariants...");

  const invalidUser = await createUser("invalid-sequence");
  const [, middleOut, lastIn] = await seedEvents(invalidUser.id, [
    { type: EventType.IN, timestamp: "2026-03-10T09:00:00Z" },
    { type: EventType.OUT, timestamp: "2026-03-10T17:00:00Z" },
    { type: EventType.IN, timestamp: "2026-03-11T09:00:00Z" },
  ]);

  await expectStatus(invalidUser.id, "IN", "2026-03-11T09:00:00.000Z");

  const invalidUpdate = await put(`/events/${middleOut.id}`, {
    timestamp: "2026-03-11T10:00:00Z",
  });
  expectConflict(invalidUpdate, "invalid update");
  await expectStatus(invalidUser.id, "IN", "2026-03-11T09:00:00.000Z");

  const invalidDelete = await del(`/events/${middleOut.id}`);
  expectConflict(invalidDelete, "invalid delete");
  await expectStatus(invalidUser.id, "IN", "2026-03-11T09:00:00.000Z");

  const safeUpdate = await put(`/events/${lastIn.id}`, {
    timestamp: "2026-03-11T09:30:00Z",
  });
  assert(safeUpdate.status === 200, `Expected safe update to return 200, got ${safeUpdate.status}`);
  await expectStatus(invalidUser.id, "IN", "2026-03-11T09:30:00.000Z");

  const safeDeleteUser = await createUser("safe-delete");
  const [firstIn, lastOut] = await seedEvents(safeDeleteUser.id, [
    { type: EventType.IN, timestamp: "2026-03-12T09:00:00Z" },
    { type: EventType.OUT, timestamp: "2026-03-12T17:00:00Z" },
  ]);

  await expectStatus(safeDeleteUser.id, "OUT", "2026-03-12T17:00:00.000Z");

  const safeDelete = await del(`/events/${lastOut.id}`);
  assert(safeDelete.status === 200, `Expected safe delete to return 200, got ${safeDelete.status}`);
  await expectStatus(safeDeleteUser.id, "IN", firstIn.timestamp.toISOString());

  console.log("Event CRUD invariants verified ✅");
}

async function createUser(tag: string): Promise<User> {
  const user = await prisma.user.create({
    data: {
      email: `${tag}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: tag,
    },
  });
  createdUserIds.push(user.id);
  return user;
}

async function seedEvents(
  userId: number,
  events: Array<{ type: EventType; timestamp: string }>
) {
  return Promise.all(
    events.map((event) =>
      prisma.clockEvent.create({
        data: { userId, type: event.type, timestamp: new Date(event.timestamp) },
      })
    )
  );
}

async function expectStatus(userId: number, status: EventType | "OUT", since: string) {
  const response = await get(`/clock/status/${userId}`);
  assert(response.status === 200, `Expected status check to return 200, got ${response.status}`);
  assert(response.data.status === status, `Expected status ${status}, got ${response.data.status}`);
  assert(response.data.since === since, `Expected since=${since}, got ${response.data.since}`);
}

function expectConflict(
  response: { status: number; data: Record<string, unknown> },
  label: string
) {
  assert(response.status === 409, `Expected ${label} to return 409, got ${response.status}`);
  assert(typeof response.data.error === "string", `Expected ${label} to include an error message.`);
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function get(path: string) {
  try {
    const response = await axios.get(`${BASE}${path}`);
    return { status: response.status, data: response.data as Record<string, unknown> };
  } catch (error) {
    const axiosError = error as AxiosError;
    return { status: axiosError.response?.status ?? 0, data: axiosError.response?.data as Record<string, unknown> };
  }
}

async function put(path: string, body: object) {
  try {
    const response = await axios.put(`${BASE}${path}`, body);
    return { status: response.status, data: response.data as Record<string, unknown> };
  } catch (error) {
    const axiosError = error as AxiosError;
    return { status: axiosError.response?.status ?? 0, data: axiosError.response?.data as Record<string, unknown> };
  }
}

async function del(path: string) {
  try {
    const response = await axios.delete(`${BASE}${path}`);
    return { status: response.status, data: response.data as Record<string, unknown> };
  } catch (error) {
    const axiosError = error as AxiosError;
    return { status: axiosError.response?.status ?? 0, data: axiosError.response?.data as Record<string, unknown> };
  }
}

main()
  .catch((error) => {
    console.error("Event CRUD invariant test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (createdUserIds.length > 0) {
      await prisma.clockEvent.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });