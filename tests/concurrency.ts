import axios, { AxiosError } from "axios";

const BASE = "http://localhost:3000/api";

async function testConcurrency() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║       Time-Recording System — Test Suite         ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // ── 1. Ensure clean state ─────────────────────────────────
  console.log("1. Cleaning state — clocking out (ignore errors)...");
  await post("/clock", { userId: 1, type: "OUT" }).catch(() => {});

  // ── 2. Basic clock-in ─────────────────────────────────────
  console.log("\n2. Clock IN (should succeed)...");
  const clockIn = await post("/clock", { userId: 1, type: "IN" });
  assert(clockIn.status === 201, `Expected 201, got ${clockIn.status}`);
  console.log("   ✅ Clock-in succeeded");

  // ── 3. Duplicate clock-in ─────────────────────────────────
  console.log("\n3. Duplicate Clock IN (should fail with 409)...");
  const dup = await post("/clock", { userId: 1, type: "IN" });
  assert(dup.status === 409, `Expected 409, got ${dup.status}`);
  console.log("   ✅ Duplicate rejected correctly");

  // ── 4. Clock-out ──────────────────────────────────────────
  console.log("\n4. Clock OUT (should succeed)...");
  const clockOut = await post("/clock", { userId: 1, type: "OUT" });
  assert(clockOut.status === 201, `Expected 201, got ${clockOut.status}`);
  console.log("   ✅ Clock-out succeeded");

  // ── 5. Duplicate clock-out ────────────────────────────────
  console.log("\n5. Duplicate Clock OUT (should fail with 409)...");
  const dupOut = await post("/clock", { userId: 1, type: "OUT" });
  assert(dupOut.status === 409, `Expected 409, got ${dupOut.status}`);
  console.log("   ✅ Duplicate clock-out rejected correctly");

  // ── 6. CRUD — List events ─────────────────────────────────
  console.log("\n6. GET /api/events?userId=1 ...");
  const eventsRes = await get("/events?userId=1");
  assert(eventsRes.status === 200, `Expected 200, got ${eventsRes.status}`);
  assert(eventsRes.data.events.length >= 2, `Expected ≥2 events, got ${eventsRes.data.events.length}`);
  console.log(`   ✅ Listed ${eventsRes.data.events.length} events (total: ${eventsRes.data.total})`);

  // ── 7. CRUD — Get single event ────────────────────────────
  const eventId = eventsRes.data.events[0].id;
  console.log(`\n7. GET /api/events/${eventId} ...`);
  const singleEvent = await get(`/events/${eventId}`);
  assert(singleEvent.status === 200, `Expected 200, got ${singleEvent.status}`);
  console.log(`   ✅ Got event id=${eventId}`);

  // ── 8. CRUD — Update event ────────────────────────────────
  console.log(`\n8. PUT /api/events/${eventId} (update timestamp)...`);
  const updated = await put(`/events/${eventId}`, { timestamp: "2026-03-10T09:00:00Z" });
  assert(updated.status === 200, `Expected 200, got ${updated.status}`);
  console.log("   ✅ Event updated");

  // ── 9. CRUD — Delete event ────────────────────────────────
  console.log(`\n9. DELETE /api/events/${eventId} ...`);
  const deleted = await del(`/events/${eventId}`);
  assert(deleted.status === 200, `Expected 200, got ${deleted.status}`);
  console.log("   ✅ Event deleted");

  // ── 10. Report ────────────────────────────────────────────
  console.log("\n10. GET /api/report ...");
  const report = await get("/report?userId=1&start=2026-03-01&end=2026-03-31");
  assert(report.status === 200, `Expected 200, got ${report.status}`);
  console.log(`   ✅ Report generated — worked: ${report.data.totals.workedHours}h, overtime: ${report.data.totals.overtime}h`);

  // ── 11. Concurrency stress test ───────────────────────────
  console.log("\n11. CONCURRENCY: Firing 10 simultaneous clock-in requests...");
  // Make sure we're clocked out first
  await post("/clock", { userId: 1, type: "OUT" }).catch(() => {});

  const promises = Array.from({ length: 10 }, () =>
    post("/clock", { userId: 1, type: "IN" })
  );
  const results = await Promise.all(promises);
  const successes = results.filter((r) => r.status === 201).length;
  const conflicts = results.filter((r) => r.status === 409).length;
  console.log(`   Results: ${successes} success, ${conflicts} conflicts, ${10 - successes - conflicts} other`);
  assert(successes <= 1, `Expected at most 1 success, got ${successes}`);
  console.log("   ✅ Concurrency test passed");

  console.log("\n══════════════════════════════════════════════════");
  console.log("   ALL TESTS PASSED ✅");
  console.log("══════════════════════════════════════════════════\n");
}

// ── Helpers ──────────────────────────────────────────────────

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`   ❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

async function post(path: string, body: object) {
  try {
    const res = await axios.post(`${BASE}${path}`, body);
    return { status: res.status, data: res.data };
  } catch (err) {
    const e = err as AxiosError;
    return { status: e.response?.status ?? 0, data: e.response?.data ?? {} };
  }
}

async function get(path: string) {
  try {
    const res = await axios.get(`${BASE}${path}`);
    return { status: res.status, data: res.data };
  } catch (err) {
    const e = err as AxiosError;
    return { status: e.response?.status ?? 0, data: e.response?.data ?? {} };
  }
}

async function put(path: string, body: object) {
  try {
    const res = await axios.put(`${BASE}${path}`, body);
    return { status: res.status, data: res.data };
  } catch (err) {
    const e = err as AxiosError;
    return { status: e.response?.status ?? 0, data: e.response?.data ?? {} };
  }
}

async function del(path: string) {
  try {
    const res = await axios.delete(`${BASE}${path}`);
    return { status: res.status, data: res.data };
  } catch (err) {
    const e = err as AxiosError;
    return { status: e.response?.status ?? 0, data: e.response?.data ?? {} };
  }
}

testConcurrency();
