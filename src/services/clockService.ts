import { prisma } from "../lib/prisma.js";
import { ConflictError, NotFoundError, ValidationError } from "../errors.js";
import { EventType, Prisma } from "@prisma/client";

type ClockHistoryEvent = {
  id: number;
  type: EventType;
  timestamp: Date;
  userId: number;
};

/**
 * Handles clock-in/out events with state-machine validation.
 * All mutations run inside a serializable transaction to prevent
 * race conditions under concurrent requests.
 */
export class ClockService {
  private static compareEventOrder(a: ClockHistoryEvent, b: ClockHistoryEvent) {
    const timestampDiff = a.timestamp.getTime() - b.timestamp.getTime();
    return timestampDiff !== 0 ? timestampDiff : a.id - b.id;
  }

  private static assertValidHistory(
    events: ClockHistoryEvent[],
    action: "Updating" | "Deleting"
  ) {
    for (let index = 0; index < events.length; index += 1) {
      const current = events[index];
      const previous = events[index - 1];

      if (index === 0 && current.type !== EventType.IN) {
        throw new ConflictError(
          `${action} this event would leave the history starting with an OUT event.`
        );
      }

      if (previous && previous.type === current.type) {
        throw new ConflictError(
          `${action} this event would create consecutive ${current.type} events.`
        );
      }
    }
  }

  /**
   * Record a clock event (IN or OUT).
   * Validates transitions: IN→OUT or OUT→IN only.
   */
  static async recordEvent(userId: number, type: EventType) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Verify user exists
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundError("User", userId);
      }

      // Fetch last event to determine current state
      const lastEvent = await tx.clockEvent.findFirst({
        where: { userId },
        orderBy: [{ timestamp: "desc" }, { id: "desc" }],
      });

      const currentState = lastEvent?.type ?? "OUT";

      if (type === EventType.IN && currentState === "IN") {
        throw new ConflictError("User is already clocked in.");
      }
      if (type === EventType.OUT && currentState === "OUT") {
        throw new ConflictError("User is not clocked in.");
      }

      return tx.clockEvent.create({
        data: { userId, type, timestamp: new Date() },
      });
    });
  }

  /** Current clock status for a user. */
  static async getStatus(userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User", userId);

    const lastEvent = await prisma.clockEvent.findFirst({
      where: { userId },
      orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    });
    return {
      userId,
      status: lastEvent?.type ?? "OUT",
      since: lastEvent?.timestamp ?? null,
    };
  }

  /** List events for a user with pagination. */
  static async listEvents(
    userId: number,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;
    const [events, total] = await Promise.all([
      prisma.clockEvent.findMany({
        where: { userId },
        orderBy: [{ timestamp: "desc" }, { id: "desc" }],
        skip,
        take: limit,
      }),
      prisma.clockEvent.count({ where: { userId } }),
    ]);
    return { events, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Get a single event by ID. */
  static async getEventById(id: number) {
    const event = await prisma.clockEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundError("ClockEvent", id);
    return event;
  }

  /** Update an event's timestamp. */
  static async updateEvent(id: number, data: { timestamp?: string }) {
    if (!data.timestamp) {
      throw new ValidationError("At least 'timestamp' must be provided.");
    }

    const nextTimestampInput = data.timestamp;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.clockEvent.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("ClockEvent", id);

      const nextTimestamp = new Date(nextTimestampInput);
      const events = await tx.clockEvent.findMany({
        where: { userId: existing.userId },
        orderBy: [{ timestamp: "asc" }, { id: "asc" }],
      });

      const updatedEvents = events
        .map((event) =>
          event.id === id ? { ...event, timestamp: nextTimestamp } : event
        )
        .sort(ClockService.compareEventOrder);

      ClockService.assertValidHistory(updatedEvents, "Updating");

      return tx.clockEvent.update({
        where: { id },
        data: { timestamp: nextTimestamp },
      });
    });
  }

  /** Delete a clock event. */
  static async deleteEvent(id: number) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.clockEvent.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("ClockEvent", id);

      const remainingEvents = await tx.clockEvent.findMany({
        where: { userId: existing.userId, id: { not: id } },
        orderBy: [{ timestamp: "asc" }, { id: "asc" }],
      });

      ClockService.assertValidHistory(remainingEvents, "Deleting");

      await tx.clockEvent.delete({ where: { id } });
      return { deleted: true, id };
    });
  }
}
