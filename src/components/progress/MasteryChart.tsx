import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MasteryDataPoint } from "@/lib/ipc";
import * as ipc from "@/lib/ipc";
import { SkeletonLoader } from "@/components/shared/SkeletonLoader";

interface MasteryChartProps {
  className?: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  physics: "#6366f1",
  chemistry: "#f59e0b",
  biology: "#10b981",
  math: "#f43f5e",
  "earth-science": "#818cf8",
};

function getDomainColor(domain: string): string {
  return DOMAIN_COLORS[domain] ?? "#78716c";
}

export function MasteryChart({ className = "" }: MasteryChartProps) {
  const [data, setData] = useState<MasteryDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const history = await ipc.getMasteryHistory();
        if (!cancelled) setData(history);
      } catch {
        // Use empty data
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className={`card ${className}`}>
        <h3 className="mb-4 text-sm font-medium text-warm-500 dark:text-warm-400">
          Mastery Over Time
        </h3>
        <SkeletonLoader lines={5} showMessage={false} />
      </div>
    );
  }

  // Transform data for Recharts: pivot by date with domain columns
  const domains = [...new Set(data.map((d) => d.domain))];
  const dateMap = new Map<string, Record<string, number>>();

  for (const point of data) {
    const existing = dateMap.get(point.date) ?? {};
    existing[point.domain] = Math.round(point.score * 100);
    dateMap.set(point.date, existing);
  }

  const chartData = Array.from(dateMap.entries())
    .map(([date, scores]) => ({
      date,
      ...scores,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (chartData.length === 0) {
    return (
      <div className={`card ${className}`}>
        <h3 className="mb-4 text-sm font-medium text-warm-500 dark:text-warm-400">
          Mastery Over Time
        </h3>
        <p className="py-8 text-center text-sm text-warm-400 dark:text-warm-500">
          Complete some lessons to see your mastery progress here.
        </p>
      </div>
    );
  }

  return (
    <div className={`card ${className}`}>
      <h3 className="mb-4 text-sm font-medium text-warm-500 dark:text-warm-400">
        Mastery Over Time
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "12px",
              fontSize: "12px",
            }}
            formatter={(value: number) => [`${value}%`, ""]}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px" }}
          />
          {domains.map((domain) => (
            <Line
              key={domain}
              type="monotone"
              dataKey={domain}
              stroke={getDomainColor(domain)}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              name={domain.charAt(0).toUpperCase() + domain.slice(1)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
