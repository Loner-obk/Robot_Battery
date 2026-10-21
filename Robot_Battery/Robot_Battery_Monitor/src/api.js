export async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`/api${path}`, {
      ...options, signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || `Помилка HTTP ${response.status}`);
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Час очікування API вичерпано. Повторіть запит.');
    if (error instanceof TypeError) throw new Error('Немає зв’язку з API. Перевірте, чи запущено сервер.');
    throw error;
  } finally { clearTimeout(timer); }
}
export const api = {
  state: () => request('/state'),
  settings: (settings) => request('/settings', { method: 'PATCH', body: JSON.stringify(settings) }),
  source: (source) => request('/source', { method: 'PATCH', body: JSON.stringify({ source }) }),
  scenario: (scenario) => request('/scenario', { method: 'POST', body: JSON.stringify({ scenario }) }),
};
