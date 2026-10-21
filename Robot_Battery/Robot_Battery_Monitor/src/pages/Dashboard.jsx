import React, { useState } from "react";
import { Link } from "react-router-dom";
import Chart, { metrics, number, time } from "../components/Chart.jsx";
import Icon from "../components/Icon.jsx";
import { api } from "../api.js";
const scenarioNames = {
  normal: "Звичайна робота",
  low: "Низький заряд",
  hot: "Перегрів",
  charging: "Заряджання",
  offline: "Втрата зв’язку",
};
const modeNames = {
  discharging: "Розряджання",
  charging: "Заряджання",
  idle: "Очікування",
};
export default function Dashboard({ data, mutate, busy }) {
  const [metric, setMetric] = useState("soc");
  const [minutes, setMinutes] = useState(60);
  const r = data.latest;
  const status = {
    normal: "У межах норми",
    warning: "Потрібна увага",
    critical: "Критичний стан",
  }[data.status];
  const threshold = {
    soc: data.settings.warningSoc,
    temperature: data.settings.maxTemperature,
    voltage: data.settings.minVoltage,
  }[metric];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ТЕЛЕМЕТРІЯ АКУМУЛЯТОРА</p>
          <h1>Енергія під контролем</h1>
          <p className="subtitle">
            Поточний стан та динаміка показників мобільного робота.
          </p>
        </div>
        <Link to="/history" className="button secondary">
          Історія даних <Icon name="arrow" size={17} />
        </Link>
      </div>
      <div
        className={`notice ${data.alerts.length ? data.status : ""}`}
        role={data.alerts.length ? "alert" : "status"}
      >
        <span className="notice-icon">{data.alerts.length ? "!" : "✓"}</span>
        <div>
          <strong>{status}</strong>
          <span>
            {data.alerts[0]?.text ||
              "Заряд, напруга та температура відповідають встановленим порогам."}
          </span>
        </div>
        <span className="notice-label">ROVER 01</span>
      </div>
      <div className="overview-grid">
        <section
          className={`card battery-card ${data.status}`}
          aria-labelledby="charge-title"
        >
          <div className="card-top">
            <h2 id="charge-title">Рівень заряду</h2>
            <span className="chip">Li-ion · 6S</span>
          </div>
          <div className="battery-main">
            <div
              className="battery-drawing"
              role="img"
              aria-label={`Заряд ${r ? number(r.soc) : "невідомий"} відсотків`}
            >
              <div
                className="battery-fill"
                style={{ height: `${r?.soc ?? 0}%` }}
              >
                <span />
              </div>
              <Icon name="bolt" size={31} />
            </div>
            <div>
              <div className="soc-value">
                {r ? number(r.soc, 0) : "—"}
                <span>%</span>
              </div>
              <span className={`badge ${data.status}`}>
                {data.stale
                  ? "Дані застаріли"
                  : modeNames[r?.mode] || "Немає даних"}
              </span>
            </div>
          </div>
          <div className="battery-footer">
            <span>Орієнтовний час роботи</span>
            <strong>
              {data.remainingMinutes == null
                ? "—"
                : `${Math.floor(data.remainingMinutes / 60)} год ${data.remainingMinutes % 60} хв`}
            </strong>
          </div>
          <p className="small">Оцінка за поточним струмом і заданою ємністю.</p>
        </section>
        <div className="metrics-grid">
          {[
            [
              "Напруга",
              r?.voltage,
              "В",
              "bolt",
              `Нижня межа ${data.settings.minVoltage} В`,
            ],
            [
              "Струм",
              r?.current,
              "А",
              "chart",
              "Додатний — розряд; від’ємний — заряд",
            ],
            [
              "Температура",
              r?.temperature,
              "°C",
              "temp",
              `Граничне значення ${data.settings.maxTemperature} °C`,
            ],
            [
              "Потужність",
              data.power,
              "Вт",
              "battery",
              "P = U × I · знак відповідає струму",
            ],
          ].map(([label, value, unit, icon, hint]) => (
            <section className="card metric-card" key={label}>
              <div className="metric-label">
                {label}
                <Icon name={icon} />
              </div>
              <div className="metric-value">
                {number(value)}
                <span>{unit}</span>
              </div>
              <p className="small">{hint}</p>
            </section>
          ))}
        </div>
      </div>
      <section className="card chart-card" aria-labelledby="chart-title">
        <div className="card-top">
          <div>
            <p className="eyebrow">ЗМІНИ У ЧАСІ</p>
            <h2 id="chart-title">Графік телеметрії</h2>
          </div>
          <div className="segmented" aria-label="Період графіка">
            {[5, 15, 60].map((m) => (
              <button
                key={m}
                aria-pressed={minutes === m}
                className={minutes === m ? "active" : ""}
                onClick={() => setMinutes(m)}
              >
                {m === 60 ? "1 година" : `${m} хв`}
              </button>
            ))}
          </div>
        </div>
        <div className="metric-tabs" aria-label="Показник графіка">
          {Object.entries(metrics).map(([key, value]) => (
            <button
              key={key}
              className={metric === key ? "active" : ""}
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
            >
              {value.label}
            </button>
          ))}
        </div>
        <Chart
          readings={data.readings}
          metric={metric}
          minutes={minutes}
          threshold={threshold}
        />
      </section>
      <div className="bottom-grid">
        <section className="card demo-card">
          <div className="card-top">
            <h2>Демонстраційні сценарії</h2>
            <span className="chip">Симулятор</span>
          </div>
          <p className="small">
            Оберіть стан, щоб перевірити індикатори та сповіщення.
          </p>
          <div className="scenario-buttons">
            {Object.entries(scenarioNames).map(([key, name]) => (
              <button
                disabled={busy || data.source !== "simulation"}
                key={key}
                className={
                  data.scenario === key && data.source === "simulation"
                    ? "selected"
                    : ""
                }
                aria-pressed={
                  data.scenario === key && data.source === "simulation"
                }
                onClick={() =>
                  mutate(() => api.scenario(key), "Сценарій застосовано.")
                }
              >
                {name}
              </button>
            ))}
          </div>
          {data.source === "external" && (
            <p className="small">
              Сценарії доступні після ввімкнення симулятора в налаштуваннях.
            </p>
          )}
        </section>
        <section className="card">
          <div className="card-top">
            <h2>Стан системи</h2>
            <span className={`live-dot ${data.stale ? "red" : ""}`} />
          </div>
          <dl className="system-list">
            <div>
              <dt>Джерело</dt>
              <dd>
                {data.source === "simulation"
                  ? "Навчальний симулятор"
                  : "Зовнішній API"}
              </dd>
            </div>
            <div>
              <dt>Останній вимір</dt>
              <dd>{r ? time(r.at) : "Очікування"}</dd>
            </div>
            <div>
              <dt>Ємність / оновлення</dt>
              <dd>{data.settings.capacityAh} А·год / 2 с</dd>
            </div>
          </dl>
          <Link to="/settings" className="text-link">
            Налаштувати пороги <Icon name="arrow" size={15} />
          </Link>
        </section>
      </div>
      {data.alerts.length > 1 && (
        <section className="extra-alerts" aria-label="Додаткові сповіщення">
          {data.alerts.slice(1).map((a) => (
            <p key={a.key} className={`notice ${a.level}`} role="alert">
              {a.text}
            </p>
          ))}
        </section>
      )}
    </>
  );
}
