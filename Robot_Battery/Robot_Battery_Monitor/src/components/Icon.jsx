import React from 'react';
const paths = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  chart: <><path d="M3 3v18h18M6 15l4-5 4 3 6-8"/></>,
  settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/></>,
  bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7z"/>,
  temp: <><path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0zM12 9v9"/></>,
  battery: <><rect x="2" y="6" width="18" height="12" rx="2"/><path d="M23 10v4M6 10v4m4-4v4m4-4v4"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
  refresh: <><path d="M20 7V3l-4 4a8 8 0 1 0 3 10M20 3h-5"/></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
};
export default function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.bolt}</svg>;
}
