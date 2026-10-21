import React, { useState } from "react";
import Icon from "../components/Icon.jsx";
import { time, number } from "../components/Chart.jsx";
export default function History({ data }) {
  const [minutes, setMinutes] = useState(60);
  const rows = data.readings.filter(
    (r) => Date.parse(r.at) >= Date.now() - minutes * 60000,
  );
  const visible = rows.slice(-100).reverse();
  function download() {
    const header =
      "Час;Заряд (%);Напруга (В);Струм (А);Температура (°C);Джерело";
    const csv =
      "\uFEFF" +
      [
        header,
        ...rows.map((r) =>
          [r.at, r.soc, r.voltage, r.current, r.temperature, r.source].join(
            ";",
          ),
        ),
      ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "rover-battery.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ЖУРНАЛ ВИМІРЮВАНЬ</p>
          <h1>
            Історія телеметрії<span>.</span>
          </h1>
          <p className="subtitle">
            Збережені показники та події системи моніторингу.
          </p>
        </div>
        <button className="button" disabled={!rows.length} onClick={download}>
          <Icon name="download" size={17} />
          Завантажити CSV
        </button>
      </div>
      <section className="card history-card">
        <div className="card-top">
          <div>
            <h2>Вимірювання</h2>
            <p className="small">
              Показано {visible.length} із {rows.length} записів. CSV містить
              усі записи за період.
            </p>
          </div>
          <label className="select-label">
            Період
            <select
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            >
              <option value="5">5 хвилин</option>
              <option value="15">15 хвилин</option>
              <option value="60">1 година</option>
            </select>
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Час виміру</th>
                <th>Заряд, %</th>
                <th>Напруга, В</th>
                <th>Струм, А</th>
                <th>Температура, °C</th>
                <th>Джерело</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => (
                <tr key={r.at + i}>
                  <td>{time(r.at)}</td>
                  <td>
                    <strong>{number(r.soc)}</strong>
                  </td>
                  <td>{number(r.voltage, 2)}</td>
                  <td>{number(r.current, 2)}</td>
                  <td>{number(r.temperature)}</td>
                  <td>
                    <span className="chip">
                      {r.source === "simulation" ? "Симулятор" : "API"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="empty-chart">За обраний період даних немає.</p>
          )}
        </div>
      </section>
      <section className="card event-card">
        <div className="card-top">
          <h2>Останні події</h2>
          <span className="chip">{data.events.length} / 100</span>
        </div>
        {data.events.length ? (
          <ul className="events">
            {data.events.slice(0, 20).map((e, i) => (
              <li key={e.at + i}>
                <span
                  className={`live-dot ${e.level === "critical" ? "red" : ""}`}
                />
                <span>{e.text}</span>
                <time>{time(e.at)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small">
            Після зміни сценарію або налаштувань тут з’являться події.
          </p>
        )}
      </section>
    </>
  );
}
