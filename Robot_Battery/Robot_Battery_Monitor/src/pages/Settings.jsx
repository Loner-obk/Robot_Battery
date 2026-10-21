import React, { useState } from "react";
import { api } from "../api.js";
const fields = [
  [
    "warningSoc",
    "Попередження про заряд, %",
    5,
    50,
    "Рекомендований початковий поріг — 20 %.",
  ],
  [
    "criticalSoc",
    "Критичний рівень заряду, %",
    1,
    30,
    "Має бути нижчим за поріг попередження.",
  ],
  [
    "maxTemperature",
    "Максимальна температура, °C",
    30,
    70,
    "Сповіщення виникає при досягненні межі.",
  ],
  [
    "minVoltage",
    "Мінімальна напруга, В",
    15,
    25,
    "Навчальний профіль Li-ion 6S.",
  ],
  [
    "capacityAh",
    "Ємність акумулятора, А·год",
    1,
    100,
    "Використовується для оцінки часу роботи.",
  ],
];
export default function Settings({ data, mutate, busy }) {
  const [form, setForm] = useState({ ...data.settings });
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setError("");
    const values = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, Number(v)]),
    );
    if (Object.values(form).some((v) => String(v).trim() === ""))
      return setError("Заповніть усі поля.");
    if (values.criticalSoc >= values.warningSoc)
      return setError("Критичний заряд має бути меншим за попереджувальний.");
    await mutate(() => api.settings(values), "Налаштування збережено.");
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ПАРАМЕТРИ МОНІТОРИНГУ</p>
          <h1>
            Налаштування системи<span>.</span>
          </h1>
          <p className="subtitle">
            Пороги сповіщень, профіль акумулятора та джерело даних.
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="card settings-card">
          <h2>Пороги та профіль</h2>
          <p className="small">
            Значення перевіряються на клієнті й сервері та зберігаються між
            запусками.
          </p>
          <form onSubmit={submit}>
            <div className="form-grid">
              {fields.map(([key, label, min, max, hint]) => (
                <div className="field" key={key}>
                  <label htmlFor={key}>{label}</label>
                  <input
                    id={key}
                    name={key}
                    type="number"
                    min={min}
                    max={max}
                    step="0.1"
                    required
                    value={form[key]}
                    onChange={(e) => {
                      setForm((old) => ({ ...old, [key]: e.target.value }));
                      setError("");
                    }}
                    aria-describedby={`${key}-hint`}
                  />
                  <small id={`${key}-hint`}>
                    {hint} Діапазон: {min}–{max}.
                  </small>
                </div>
              ))}
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button className="button" disabled={busy}>
                {busy ? "Збереження…" : "Зберегти налаштування"}
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setForm({ ...data.settings });
                  setError("");
                }}
              >
                Скасувати зміни
              </button>
            </div>
          </form>
        </section>
        <div className="settings-aside">
          <section className="card source-card">
            <h2>Джерело телеметрії</h2>
            <p className="small">
              Зміна джерела починає новий сеанс вимірювань. Журнал подій
              зберігається.
            </p>
            <label htmlFor="source">Режим роботи</label>
            <select
              id="source"
              value={data.source}
              disabled={busy}
              onChange={(e) => {
                const source = e.target.value;
                mutate(() => api.source(source), "Джерело даних змінено.");
              }}
            >
              <option value="simulation">Навчальний симулятор</option>
              <option value="external">Зовнішній API робота</option>
            </select>
            <p className="source-note">
              {data.source === "simulation"
                ? "Симулятор створює вимірювання кожні 2 секунди. Початкова історія за годину є демонстраційною."
                : "Сервер очікує POST /api/telemetry. Після 10 секунд без нового вимірювання дані вважаються застарілими."}
            </p>
          </section>
          <section className="card">
            <h2>Про розрахунки</h2>
            <p className="small body-note">
              Потужність: P = U × I.
              <br />
              Час роботи: t = C × SOC / (100 × I).
              <br />
              Для заряджання та застарілих даних час роботи не оцінюється.
            </p>
            <p className="small body-note">
              Пороги цього навчального профілю можна змінити. Вони не замінюють
              захист BMS фізичного акумулятора.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
