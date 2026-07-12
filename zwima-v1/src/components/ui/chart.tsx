"use client";

type Point = { label: string; value: number };

export function BarChart({ data, height = 160 }: { data: Point[]; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.length === 0 && <p className="text-sm text-slate-500">No data</p>}
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-blue-600 dark:bg-blue-500"
            style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 4 : 0 }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="truncate text-[10px] text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ data, size = 120 }: { data: Point[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const colors = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2"];
  let offset = 0;
  const segments = data.map((d, i) => {
    const pct = d.value / total;
    const start = offset;
    offset += pct;
    return { ...d, pct, start, color: colors[i % colors.length] };
  });

  const gradient = segments.map((s) => `${s.color} ${s.start * 360}deg ${(s.start + s.pct) * 360}deg`).join(", ");

  return (
    <div className="flex items-center gap-4">
      <div
        className="shrink-0 rounded-full"
        style={{
          width: size,
          height: size,
          background: total > 0 ? `conic-gradient(${gradient})` : "#e2e8f0",
          mask: "radial-gradient(circle at center, transparent 55%, black 56%)",
          WebkitMask: "radial-gradient(circle at center, transparent 55%, black 56%)",
        }}
      />
      <ul className="space-y-1 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: colors[i % colors.length] }} />
            <span className="text-slate-600 dark:text-slate-400">{d.label}</span>
            <span className="font-medium">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineChart({ data, height = 120 }: { data: Point[]; height?: number }) {
  if (data.length === 0) return <p className="text-sm text-slate-500">No data</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 100;
  const h = height;
  const points = data
    .map((d, i) => {
      const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w;
      const y = h - (d.value / max) * (h - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600" points={points} />
    </svg>
  );
}
