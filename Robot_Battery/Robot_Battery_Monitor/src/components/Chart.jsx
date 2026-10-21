import React, { useId, useState } from 'react';
export const metrics = {
  soc: { label: 'Рівень заряду', unit: '%', color: '#147861', bounds: [0, 100] },
  voltage: { label: 'Напруга', unit: 'В', color: '#3f70b7', bounds: [18, 26] },
  current: { label: 'Струм', unit: 'А', color: '#7d59a4', bounds: [-5, 5] },
  temperature: { label: 'Температура', unit: '°C', color: '#be7b2c', bounds: [20, 60] },
};
export const time = (at) => new Date(at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const number = (value, digits = 1) => value == null ? '—' : value.toLocaleString('uk-UA', { maximumFractionDigits: digits, minimumFractionDigits: digits });

export default function Chart({ readings, metric, minutes, threshold }) {
  const id = useId().replaceAll(':', '');
  const [hover, setHover] = useState(null);
  const meta = metrics[metric];
  const end = Date.now(), start = end - minutes * 60000;
  const rows = readings.filter((r) => Date.parse(r.at) >= start);
  // Keep SVG light while preserving the final measurement.
  const stride = Math.max(1, Math.ceil(rows.length / 240));
  const points = rows.filter((_, i) => i % stride === 0 || i === rows.length - 1);
  if (!points.length) return <div className="empty-chart">За цей період ще немає вимірювань.</div>;
  const low = Math.min(meta.bounds[0], ...points.map((r) => r[metric]));
  const high = Math.max(meta.bounds[1], ...points.map((r) => r[metric]));
  const x = (r) => 52 + (Date.parse(r.at) - start) / (end - start) * 850;
  const y = (v) => 218 - (v - low) / (high - low) * 184;
  const line = points.map((r, i) => `${i ? 'L' : 'M'}${x(r).toFixed(1)},${y(r[metric]).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.at(-1)).toFixed(1)},218 L${x(points[0]).toFixed(1)},218 Z`;
  const active = points[hover] || points.at(-1);
  return <div className="chart-wrap">
    <div className="chart-reading"><span className="legend-dot" style={{ background: meta.color }} />{meta.label}<strong>{number(active[metric])} {meta.unit}</strong><span>{time(active.at)}</span></div>
    <svg className="chart" viewBox="0 0 930 258" role="img" aria-label={`${meta.label} за ${minutes} хвилин. Останнє значення ${number(points.at(-1)[metric])} ${meta.unit}.`} onMouseLeave={() => setHover(null)}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor={meta.color} stopOpacity=".17"/><stop offset="1" stopColor={meta.color} stopOpacity=".01"/></linearGradient></defs>
      {[0, 1, 2, 3, 4].map((n) => { const v = low + (high - low) * n / 4; return <g key={n}><line x1="52" x2="902" y1={y(v)} y2={y(v)} stroke="#e7ece7" strokeDasharray="3 4"/><text x="36" y={y(v) + 4} textAnchor="end">{Number(v.toFixed(1))}</text></g>; })}
      {threshold >= low && threshold <= high && <><line x1="52" x2="902" y1={y(threshold)} y2={y(threshold)} stroke="#bc7b28" strokeDasharray="5 5"/><text x="900" y={y(threshold) - 6} textAnchor="end" fill="#a2691f">Межа {threshold} {meta.unit}</text></>}
      <path d={area} fill={`url(#${id})`}/><path d={line} fill="none" stroke={meta.color} strokeWidth="2.6" strokeLinejoin="round"/>
      {[0, 1, 2, 3, 4].map((n) => <text key={n} x={52 + n * 212.5} y="246" textAnchor={n === 0 ? 'start' : n === 4 ? 'end' : 'middle'}>{new Date(start + n * minutes * 15000).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</text>)}
      {hover !== null && <line x1={x(active)} x2={x(active)} y1="32" y2="218" stroke="#aabbb3" strokeDasharray="3 3"/>}
      <circle cx={x(active)} cy={y(active[metric])} r="4.5" fill={meta.color} stroke="white" strokeWidth="2"/>
      {points.map((p, i) => <rect key={p.at + i} x={x(p) - 5} y="24" width="10" height="200" fill="transparent" onMouseMove={() => setHover(i)}/>)}
    </svg>
  </div>;
}
