import axios, { type AxiosRequestConfig } from "axios";

const BASE = "http://localhost:3000/api";

async function testInvalidInput() {
  console.log("Checking invalid-input normalization...");

  await expectStatus("GET /events/abc", { method: "get", url: `${BASE}/events/abc` }, 400);
  await expectStatus(
    "PUT /events/abc",
    { method: "put", url: `${BASE}/events/abc`, data: { timestamp: "2026-03-10T09:00:00Z" } },
    400
  );
  await expectStatus("DELETE /events/abc", { method: "delete", url: `${BASE}/events/abc` }, 400);
  await expectStatus("GET /clock/status/abc", { method: "get", url: `${BASE}/clock/status/abc` }, 400);
  await expectStatus("GET /users/abc", { method: "get", url: `${BASE}/users/abc` }, 400);
  await expectStatus(
    "POST /clock malformed JSON",
    {
      method: "post",
      url: `${BASE}/clock`,
      data: '{"userId":1,',
      headers: { "Content-Type": "application/json" },
      transformRequest: [(data) => data],
    },
    400
  );

  console.log("Invalid-input checks passed ✅");
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

async function expectStatus(name: string, config: AxiosRequestConfig, expectedStatus: number) {
  const response = await axios({
    validateStatus: () => true,
    ...config,
  });

  assert(response.status === expectedStatus, `${name}: expected ${expectedStatus}, got ${response.status}`);
  assert(typeof response.data?.error === "string", `${name}: expected JSON error message`);
  console.log(`✅ ${name} -> ${response.status}`);
}

testInvalidInput();