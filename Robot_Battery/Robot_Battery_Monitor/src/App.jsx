import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  Link,
  useLocation,
} from "react-router-dom";
import { api } from "./api.js";
import Icon from "./components/Icon.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import History from "./pages/History.jsx";
import Settings from "./pages/Settings.jsx";
function Workspace() {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false),
    [refreshing, setRefreshing] = useState(false);
  const queue = useRef(Promise.resolve()),
    mounted = useRef(false),
    polling = useRef(false),
    changing = useRef(false);
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    setMessage("");
  }, [location.pathname]);
  const refresh = useCallback(() => {
    // Every refresh runs after the previous one, so older responses cannot overwrite newer data.
    const job = queue.current
      .catch(() => {})
      .then(async () => {
        if (!mounted.current) return;
        setRefreshing(true);
        try {
          const next = await api.state();
          if (mounted.current) {
            setData(next);
            setConnected(true);
            setError("");
          }
        } catch (err) {
          if (mounted.current) {
            setConnected(false);
            setError(err.message);
          }
        } finally {
          if (mounted.current) setRefreshing(false);
        }
      });
    queue.current = job;
    return job;
  }, []);
  useEffect(() => {
    mounted.current = true;
    refresh();
    const timer = setInterval(async () => {
      if (polling.current || changing.current) return;
      polling.current = true;
      try {
        await refresh();
      } finally {
        polling.current = false;
      }
    }, 2000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(t);
  }, [message]);
  async function mutate(action, success) {
    if (changing.current) return;
    changing.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await queue.current;
      await action();
      await refresh();
      setMessage(success);
    } catch (err) {
      setError(err.message);
    } finally {
      changing.current = false;
      setBusy(false);
    }
  }
  const viewData =
    data && !connected
      ? {
          ...data,
          stale: true,
          remainingMinutes: null,
          status: "critical",
          alerts: [
            {
              key: "api",
              level: "critical",
              text: "Зв’язок з API втрачено. Відображено останні отримані вимірювання.",
            },
            ...data.alerts,
          ],
        }
      : data;
  const props = { data: viewData, mutate, busy };
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main">
        Перейти до вмісту
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-icon">
            <Icon name="bolt" size={22} />
          </span>
          <span>
            ROVER<small>BATTERY MONITOR</small>
          </span>
        </Link>
        <p className="nav-label">РОБОЧИЙ ПРОСТІР</p>
        <nav aria-label="Основна навігація">
          {[
            ["/", "grid", "Моніторинг"],
            ["/history", "chart", "Історія даних"],
            ["/settings", "settings", "Налаштування"],
          ].map(([to, icon, label]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon name={icon} />
              {label}
              <span className="nav-arrow">↗</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="robot-visual" aria-hidden="true">
            <div className="robot-antenna" />
            <div className="robot-body">
              <span />
              <span />
            </div>
            <div className="robot-wheels">
              <i />
              <i />
            </div>
          </div>
          <strong>ROVER</strong>
          <span>Мобільна платформа</span>
          <p>
            <span
              className={`live-dot ${data?.stale || !connected ? "red" : ""}`}
            />
            {data?.stale || !connected
              ? "Очікування даних"
              : "Телеметрія активна"}
          </p>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Платформи <span>/</span>
            <strong>ROVER</strong>
          </div>
          <div className="topbar-status">
            <span className="chip source-chip">
              {data?.source === "external"
                ? "Зовнішній API"
                : "Демонстраційні дані"}
            </span>
            <span className={`live-dot ${!connected ? "red" : ""}`} />
            <span>{connected ? "API підключено" : "API не підключено"}</span>
            <button
              className="icon-button"
              aria-label="Оновити дані"
              title="Оновити дані"
              disabled={refreshing || busy}
              onClick={refresh}
            >
              <Icon name="refresh" size={18} />
            </button>
          </div>
        </header>
        <main id="main" tabIndex="-1">
          {error && (
            <div className="notice critical api-error" role="alert">
              <span>{error}</span>
              <button
                className="button secondary"
                disabled={refreshing || busy}
                onClick={refresh}
              >
                Повторити
              </button>
            </div>
          )}
          {message && (
            <div className="toast" role="status">
              ✓ {message}
            </div>
          )}
          {!connected && data && (
            <p className="offline-label" role="status">
              Зв’язок з API втрачено. Показано останні отримані дані; їх
              актуальність не підтверджена.
            </p>
          )}
          {data ? (
            <Routes>
              <Route path="/" element={<Dashboard {...props} />} />
              <Route path="/history" element={<History data={data} />} />
              <Route path="/settings" element={<Settings {...props} />} />
              <Route
                path="*"
                element={
                  <section className="card not-found">
                    <p className="eyebrow">404</p>
                    <h1>Сторінку не знайдено</h1>
                    <Link to="/" className="button">
                      До моніторингу
                    </Link>
                  </section>
                }
              />
            </Routes>
          ) : (
            <section className="card loading" role="status">
              {error
                ? "Дані не завантажено. Скористайтеся кнопкою «Повторити»."
                : "Завантаження телеметрії…"}
            </section>
          )}
          <footer className="page-footer">
            <span>ROVER / Система моніторингу акумулятора</span>
            <span>Оновлення кожні 2 с · Час пристрою</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <Workspace />
    </BrowserRouter>
  );
}
