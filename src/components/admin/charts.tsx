"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const BRAND = "#2563EB";

export function GrowthChart({ data }: { data: { day: string; count: number }[] }) {
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <div className="h-64 w-full" role="img" aria-label="Daily registrations over the last 30 days">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="fillBrand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.22} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E4E7EC" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" tickFormatter={fmt} tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} />
          <Tooltip labelFormatter={(l) => fmt(String(l))} formatter={(v) => [v, "Registrations"]} contentStyle={{ borderRadius: 10, border: "1px solid #E4E7EC", fontSize: 12 }} />
          <Area type="monotone" dataKey="count" stroke={BRAND} strokeWidth={2} fill="url(#fillBrand)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SourceChart({ data }: { data: { name: string; count: number }[] }) {
  return (
    <div className="w-full" style={{ height: Math.max(160, data.length * 40) }} role="img" aria-label="Registrations by source">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#E4E7EC" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: "#101828" }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v) => [v, "Registrations"]} contentStyle={{ borderRadius: 10, border: "1px solid #E4E7EC", fontSize: 12 }} />
          <Bar dataKey="count" fill={BRAND} radius={[0, 6, 6, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
