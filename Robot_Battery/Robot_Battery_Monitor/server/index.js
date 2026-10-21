import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ApiError,
  seedState,
  simulate,
  assess,
  validateSettings,
  validateTelemetry,
  scenarios,
  addReadingEvents,
} from "./domain.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
async function readBody(req) {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (Buffer.byteLength(data) > 8192)
      throw new ApiError(413, "Завеликий запит.");
  }
  try {
    return JSON.parse(data);
  } catch {
    throw new ApiError(400, "Некоректний JSON.");
  }
}
function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

export function createApp({
  dataFile = process.env.DATA_FILE || path.join(root, "server/data/state.json"),
  tickMs = 2000,
} = {}) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  let state = fs.existsSync(dataFile)
    ? JSON.parse(fs.readFileSync(dataFile, "utf8"))
    : seedState();
  function save(next) {
    fs.writeFileSync(`${dataFile}.tmp`, JSON.stringify(next, null, 2));
    fs.renameSync(`${dataFile}.tmp`, dataFile);
    state = next;
  }
  if (!fs.existsSync(dataFile)) save(state);
  function event(next, text) {
    save({
      ...next,
      events: [
        { key: "system", level: "info", text, at: new Date().toISOString() },
        ...next.events,
      ].slice(0, 100),
    });
  }
  const timer = tickMs
    ? setInterval(() => {
        try {
          const next = simulate(state);
          if (next !== state) save(addReadingEvents(next));
        } catch (error) {
          console.error("Не вдалося зберегти телеметрію:", error.message);
        }
      }, tickMs)
    : null;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const p = url.pathname;
      if (req.method === "GET" && p === "/api/health")
        return json(res, 200, { ok: true });
      if (req.method === "GET" && p === "/api/state") {
        const latest = state.readings.at(-1) || null;
        return json(res, 200, {
          ...state,
          latest,
          ...assess(
            latest,
            state.settings,
            Date.now(),
            state.source === "simulation" && state.scenario === "offline",
          ),
          serverAt: new Date().toISOString(),
        });
      }
      if (req.method === "GET" && p === "/api/history") {
        const minutes = Number(url.searchParams.get("minutes") || 60);
        if (![5, 15, 60].includes(minutes))
          throw new ApiError(422, "Період має бути 5, 15 або 60 хвилин.");
        return json(
          res,
          200,
          state.readings.filter(
            (r) => Date.parse(r.at) >= Date.now() - minutes * 60000,
          ),
        );
      }
      if (req.method === "PATCH" && p === "/api/settings") {
        const settings = validateSettings(await readBody(req));
        event(
          { ...state, settings },
          "Оновлено пороги сповіщень і ємність акумулятора.",
        );
        return json(res, 200, settings);
      }
      if (req.method === "POST" && p === "/api/scenario") {
        const input = await readBody(req);
        if (!input || !scenarios.includes(input.scenario))
          throw new ApiError(422, "Невідомий сценарій.");
        if (state.source !== "simulation")
          throw new ApiError(409, "Спочатку увімкніть симулятор.");
        const next = simulate(
          { ...state, scenario: input.scenario },
          Date.now(),
          true,
        );
        event(
          addReadingEvents(next),
          `Сценарій симулятора: ${input.scenario}.`,
        );
        return json(res, 200, { scenario: state.scenario });
      }
      if (req.method === "PATCH" && p === "/api/source") {
        const input = await readBody(req);
        if (!input || !["simulation", "external"].includes(input.source))
          throw new ApiError(422, "Невідоме джерело даних.");
        // A new session keeps synthetic history separate from external measurements.
        const next = {
          ...state,
          source: input.source,
          scenario: "normal",
          readings: input.source === state.source ? state.readings : [],
        };
        if (next.source === "simulation" && !next.readings.length)
          next.readings = seedState().readings;
        event(
          next,
          input.source === "simulation"
            ? "Увімкнено симулятор телеметрії."
            : "Очікування телеметрії від зовнішнього джерела.",
        );
        return json(res, 200, { source: state.source });
      }
      if (req.method === "POST" && p === "/api/telemetry") {
        const input = await readBody(req);
        if (state.source !== "external")
          throw new ApiError(409, "У налаштуваннях виберіть зовнішнє джерело.");
        const reading = validateTelemetry(input);
        save(
          addReadingEvents({
            ...state,
            readings: [...state.readings, reading].slice(-1800),
          }),
        );
        return json(res, 201, reading);
      }
      if (p.startsWith("/api/"))
        throw new ApiError(404, "Маршрут API не знайдено.");
      if (req.method !== "GET" && req.method !== "HEAD")
        throw new ApiError(405, "Метод не дозволено.");
      const dist = path.join(root, "dist");
      const file = path.resolve(dist, `.${decodeURIComponent(p)}`);
      if (!file.startsWith(dist + path.sep) && file !== dist)
        throw new ApiError(403, "Доступ заборонено.");
      const target =
        fs.existsSync(file) && fs.statSync(file).isFile()
          ? file
          : path.join(dist, "index.html");
      if (!fs.existsSync(target))
        throw new ApiError(503, "Спочатку виконайте npm run build.");
      res.writeHead(200, {
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(target).pipe(res);
    } catch (error) {
      json(res, error.status || 500, {
        message: error.status ? error.message : "Внутрішня помилка сервера.",
      });
      if (!error.status) console.error(error);
    }
  });
  server.on("close", () => {
    if (timer) clearInterval(timer);
  });
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 3004);
  const server = createApp();
  server.listen(port, "127.0.0.1", () =>
    console.log(`ROVER: http://127.0.0.1:${port}`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => server.close(() => process.exit(0)));
}
