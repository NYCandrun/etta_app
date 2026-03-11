import { useState, useEffect, useMemo } from "react";
import type { ReviewForecastItem } from "@/lib/ipc";
import * as ipc from "@/lib/ipc";
import { formatMonthDay } from "@/lib/format";
import { SkeletonLoader } from "@/components/shared/SkeletonLoader";

interface ReviewForecastProps {
  className?: string;
}

export function ReviewForecast({ className = "" }: ReviewForecastProps) {
  const [items, setItems] = useState<ReviewForecastItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const forecast = await ipc.getReviewForecast();
        if (!cancelled) setItems(forecast);
      } catch {
        // empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, ReviewForecastItem[]>();
    for (const item of items) {
      const dateKey = item.dueDate.split("T")[0] ?? item.dueDate;
      const group = map.get(dateKey) ?? [];
      group.push(item);
      map.set(dateKey, group);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
  }, [items]);

  if (loading) {
    return (
      <div className={`card ${className}`}>
        <h3 className="mb-4 text-sm font-medium text-warm-500 dark:text-warm-400">
          Upcoming Reviews
        </h3>
        <SkeletonLoader lines={4} showMessage={false} />
      </div>
    );
  }

  if (grouped.length === 0) {
    return (
      <div className={`card ${className}`}>
        <h3 className="mb-4 text-sm font-medium text-warm-500 dark:text-warm-400">
          Upcoming Reviews
        </h3>
        <p className="py-4 text-center text-sm text-warm-400 dark:text-warm-500">
          No upcoming reviews scheduled.
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className={`card ${className}`}>
      <h3 className="mb-4 text-sm font-medium text-warm-500 dark:text-warm-400">
        Upcoming Reviews
      </h3>

      <div className="space-y-4">
        {grouped.slice(0, 7).map(([date, reviews]) => {
          const isToday = date === today;
          return (
            <div key={date}>
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className={`text-xs font-semibold ${
                    isToday
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-warm-500 dark:text-warm-400"
                  }`}
                >
                  {isToday ? "Today" : formatMonthDay(date)}
                </span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warm-200 text-[10px] font-medium text-warm-600 dark:bg-warm-700 dark:text-warm-400">
                  {reviews.length}
                </span>
              </div>
              <div className="space-y-1 pl-2">
                {reviews.map((review) => (
                  <div
                    key={review.conceptId}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />
                    <span className="text-warm-700 dark:text-warm-300">
                      {review.conceptName}
                    </span>
                    <span className="text-xs text-warm-400 dark:text-warm-500">
                      {review.domain}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
