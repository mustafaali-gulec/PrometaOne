/**
 * ReportChart — rapor sonucundan (result) recharts grafiği üretir.
 * Tipler: bar | line | pie | kpi. recharts zaten projede bağımlı.
 */
import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export const CHART_PALETTE = [
  '#7c3aed',
  '#0891b2',
  '#15803d',
  '#ea580c',
  '#ca8a04',
  '#be123c',
  '#1d4ed8',
  '#0f766e',
];

/** result.rows (dizi-içinde-dizi) → recharts için obje dizisi. */
export function chartData(result) {
  return result.rows.map((r) => Object.fromEntries(result.columns.map((c, i) => [c.key, r[i]])));
}

const num = (v) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function ReportChart({ result, chart }) {
  const type = chart?.type || 'none';
  if (type === 'none') return null;

  const yKeys = (chart.yKeys || []).filter(Boolean);
  const xKey = chart.xKey || '';
  const data = chartData(result);

  // KPI: her y kolonu için toplam kartı
  if (type === 'kpi') {
    if (!yKeys.length) return null;
    return (
      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
        {yKeys.map((yk, i) => {
          const total = data.reduce((s, d) => s + num(d[yk]), 0);
          return (
            <div
              key={yk}
              className="card p-3"
              style={{
                minWidth: 160,
                borderLeft: `4px solid ${CHART_PALETTE[i % CHART_PALETTE.length]}`,
              }}
            >
              <div className="text-xs" style={{ color: 'var(--ink-mute)' }}>
                {yk}
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
                {total.toLocaleString('tr-TR')}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (!xKey || !yKeys.length) return null;

  if (type === 'pie') {
    const yk = yKeys[0];
    const pieData = data.map((d) => ({ name: String(d[xKey]), value: num(d[yk]) }));
    return (
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const isLine = type === 'line';
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        {isLine ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {yKeys.map((yk, i) => (
              <Line
                key={yk}
                type="monotone"
                dataKey={yk}
                stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                dot={false}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {yKeys.map((yk, i) => (
              <Bar key={yk} dataKey={yk} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
