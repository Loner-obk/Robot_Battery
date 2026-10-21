import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import {
  assess,
  defaults,
  seedState,
  simulate,
  validateSettings,
  validateTelemetry,
} from "../server/domain.js";
import { createApp } from "../server/index.js";
const now = Date.now();
const reading = {
  at: new Date(now).toISOString(),
  soc: 50,
  voltage: 24,
  current: 2,
  temperature: 33,
};
test("power, runtime and threshold boundary calculations", () => {
  const result = assess(reading, defaults, now);
  assert.equal(result.power, 48);
  assert.equal(result.remainingMinutes, 150);
  assert.equal(result.status, "normal");
  assert.equal(
    assess({ ...reading, soc: 20 }, defaults, now).status,
    "warning",
  );
  assert.equal(
    assess({ ...reading, soc: 10 }, defaults, now).status,
    "critical",
  );
  assert.equal(
    assess({ ...reading, temperature: 45 }, defaults, now).status,
    "critical",
  );
});
test("stale telemetry, absent readings and charging have no runtime estimate", () => {
  assert.equal(assess(reading, defaults, now + 10001).remainingMinutes, null);
  assert.equal(assess(reading, defaults, now + 10001).stale, true);
  assert.equal(
    assess({ ...reading, current: -3 }, defaults, now).remainingMinutes,
    null,
  );
  assert.equal(assess(null, defaults, now).status, "critical");
});
test("settings reject wrong thresholds, missing fields and numeric strings", () => {
  assert.throws(() => validateSettings({ ...defaults, criticalSoc: 25 }));
  assert.throws(() => validateSettings({ ...defaults, capacityAh: 0 }));
  assert.throws(() => validateSettings({ ...defaults, warningSoc: "20" }));
  assert.throws(() => validateSettings(null));
  assert.deepEqual(validateSettings(defaults), defaults);
});
test("external telemetry validates all fields and stamps server time", () => {
  assert.throws(() => validateTelemetry({ ...reading, soc: 101 }));
  assert.throws(() => validateTelemetry({ ...reading, voltage: null }));
  assert.equal(
    validateTelemetry({ ...reading, current: -2 }, now).mode,
    "charging",
  );
  assert.equal(
    validateTelemetry({ ...reading, at: "invalid" }, now).at,
    new Date(now).toISOString(),
  );
});
test("simulator discharges, charges, pauses and bounds charge", () => {
  const state = seedState(now);
  assert.ok(
    simulate(state, now + 2000).readings.at(-1).soc < state.readings.at(-1).soc,
  );
  const charging = { ...state, scenario: "charging" };
  assert.ok(
    simulate(charging, now + 2000).readings.at(-1).soc >
      state.readings.at(-1).soc,
  );
  const paused = { ...state, scenario: "offline" };
  assert.equal(simulate(paused, now + 2000), paused);
  const full = { ...charging, readings: [{ ...reading, soc: 100 }] };
  assert.equal(simulate(full, now + 2000).readings.at(-1).soc, 100);
});
test("HTTP API, validation, external source isolation, stale data and persistence", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rover-test-"));
  const dataFile = path.join(dir, "state.json");
  let server = createApp({ dataFile, tickMs: 0 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const req = (p, body, method = "POST") =>
    fetch(base + p, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal((await fetch(base + "/api/health")).status, 200);
  assert.equal((await fetch(base + "/api/history?minutes=7")).status, 422);
  assert.equal((await fetch(base + "/api/nope")).status, 404);
  assert.equal(
    (await fetch(base + "/api/settings", { method: "PATCH", body: "{" }))
      .status,
    400,
  );
  assert.equal(
    (await req("/api/settings", { ...defaults, criticalSoc: 25 }, "PATCH"))
      .status,
    422,
  );
  assert.equal(
    (await req("/api/settings", { ...defaults, warningSoc: 25 }, "PATCH"))
      .status,
    200,
  );
  assert.equal((await req("/api/scenario", { scenario: "low" })).status, 200);
  let state = await (await fetch(base + "/api/state")).json();
  assert.equal(state.status, "critical");
  assert.equal(state.latest.soc, 8);
  assert.equal(
    (await req("/api/scenario", { scenario: "offline" })).status,
    200,
  );
  state = await (await fetch(base + "/api/state")).json();
  assert.equal(state.stale, true);
  assert.equal((await req("/api/telemetry", reading)).status, 409);
  assert.equal(
    (await req("/api/source", { source: "external" }, "PATCH")).status,
    200,
  );
  state = await (await fetch(base + "/api/state")).json();
  assert.equal(state.readings.length, 0);
  assert.equal(state.stale, true);
  assert.equal(
    (await req("/api/telemetry", { ...reading, soc: -1 })).status,
    422,
  );
  assert.equal((await req("/api/telemetry", reading)).status, 201);
  state = await (await fetch(base + "/api/state")).json();
  assert.equal(state.latest.source, "external");
  assert.equal(state.stale, false);
  assert.equal((await req("/api/scenario", { scenario: "hot" })).status, 409);
  await new Promise((resolve) => server.close(resolve));
  server = createApp({ dataFile, tickMs: 0 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  state = await (await fetch(base + "/api/state")).json();
  assert.equal(state.settings.warningSoc, 25);
  assert.equal(state.latest.soc, 50);
});
