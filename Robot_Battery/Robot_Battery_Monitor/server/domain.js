export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const defaults = {
  warningSoc: 20, criticalSoc: 10, maxTemperature: 45,
  minVoltage: 20, capacityAh: 10,
};
export const scenarios = ['normal', 'low', 'hot', 'charging', 'offline'];
const round = (n) => Math.round(n * 100) / 100;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export function validateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new ApiError(422, 'Передайте об’єкт налаштувань.');
  const ranges = { warningSoc: [5, 50], criticalSoc: [1, 30],
    maxTemperature: [30, 70], minVoltage: [15, 25], capacityAh: [1, 100] };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] < min || input[key] > max)
      throw new ApiError(422, `Поле ${key}: допустиме число від ${min} до ${max}.`);
  }
  if (input.criticalSoc >= input.warningSoc)
    throw new ApiError(422, 'Критичний заряд має бути меншим за попереджувальний.');
  return Object.fromEntries(Object.keys(ranges).map((key) => [key, input[key]]));
}

export function validateTelemetry(input, now = Date.now()) {
  const ranges = { soc: [0, 100], voltage: [0, 60], current: [-50, 50], temperature: [-40, 100] };
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new ApiError(422, 'Передайте об’єкт телеметрії.');
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] < min || input[key] > max)
      throw new ApiError(422, `Некоректний показник ${key}; діапазон ${min}…${max}.`);
  }
  return { at: new Date(now).toISOString(), ...Object.fromEntries(Object.keys(ranges).map((k) => [k, input[k]])),
    mode: input.current < 0 ? 'charging' : input.current > 0 ? 'discharging' : 'idle', source: 'external' };
}

export function seedState(now = Date.now()) {
  const readings = Array.from({ length: 61 }, (_, i) => ({
    at: new Date(now - (60 - i) * 60000).toISOString(),
    soc: round(91 - i * .22), voltage: round(24.9 - i * .018),
    current: round(2.7 + Math.sin(i / 4) * .45),
    temperature: round(31.5 + i * .04 + Math.sin(i / 6) * .7),
    mode: 'discharging', source: 'simulation',
  }));
  return { version: 1, settings: { ...defaults }, source: 'simulation', scenario: 'normal', readings, events: [] };
}

// Positive current = discharge; negative current = charging. One tick = actual elapsed time.
export function simulate(state, now = Date.now(), forced = false) {
  if (state.source !== 'simulation' || state.scenario === 'offline') return state;
  const last = state.readings.at(-1);
  const seconds = clamp((now - Date.parse(last.at)) / 1000, 0, 10);
  const phase = now / 15000;
  let current = 2.8 + Math.sin(phase) * .35;
  if (state.scenario === 'charging') current = last.soc >= 100 ? 0 : -3.5;
  let soc = clamp(last.soc - current * seconds / (state.settings.capacityAh * 36), 0, 100);
  if (forced && state.scenario === 'normal') soc = 78;
  if (forced && state.scenario === 'low') soc = Math.max(0, state.settings.criticalSoc - 2);
  if (forced && state.scenario === 'charging') soc = 42;
  if (soc <= 0 && current > 0) current = 0;
  let temperature = 33.6 + Math.sin(phase / 2) * .6;
  if (state.scenario === 'hot') temperature = state.settings.maxTemperature + 5 + Math.sin(phase) * .2;
  const reading = { at: new Date(now).toISOString(), soc: round(soc),
    voltage: round(19.5 + soc * .06 + (current < 0 ? .5 : 0)), current: round(current),
    temperature: round(temperature), mode: current < 0 ? 'charging' : current > 0 ? 'discharging' : 'idle', source: 'simulation' };
  return { ...state, readings: [...state.readings, reading].slice(-1800) };
}

export function assess(reading, settings, now = Date.now(), offline = false) {
  const alerts = [];
  const stale = !reading || offline || now - Date.parse(reading.at) > 10000;
  if (stale) alerts.push({ key: 'stale', level: 'critical', text: 'Немає свіжої телеметрії. Перевірте зв’язок із роботом.' });
  if (!reading) return { alerts, stale: true, status: 'critical', power: null, remainingMinutes: null };
  if (reading.soc <= settings.criticalSoc)
    alerts.push({ key: 'soc', level: 'critical', text: 'Критичний заряд. Потрібне заряджання акумулятора.' });
  else if (reading.soc <= settings.warningSoc)
    alerts.push({ key: 'soc', level: 'warning', text: 'Низький заряд. Заплануйте повернення до зарядної станції.' });
  if (reading.temperature >= settings.maxTemperature)
    alerts.push({ key: 'temperature', level: 'critical', text: 'Перегрів акумулятора. Перевірте навантаження та охолодження.' });
  if (reading.voltage <= settings.minVoltage)
    alerts.push({ key: 'voltage', level: 'warning', text: 'Напруга нижча за встановлену межу.' });
  const status = alerts.some((a) => a.level === 'critical') ? 'critical' : alerts.length ? 'warning' : 'normal';
  return { alerts, stale, status, power: round(reading.voltage * reading.current),
    remainingMinutes: !stale && reading.current > .1
      ? Math.round(settings.capacityAh * reading.soc / 100 / reading.current * 60) : null };
}

export function addReadingEvents(state, now = Date.now()) {
  const before = state.readings.length > 1 ? assess(state.readings.at(-2), state.settings, now).alerts : [];
  const after = assess(state.readings.at(-1), state.settings, now).alerts;
  const added = after.filter((a) => !before.some((b) => b.key === a.key && b.level === a.level));
  if (!added.length) return state;
  return { ...state, events: [...added.map((a) => ({ ...a, at: new Date(now).toISOString() })), ...state.events].slice(0, 100) };
}
