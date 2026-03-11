import { useEffect, useRef, useState } from "react";

interface QuizTimerProps {
  /** Total seconds for the timer */
  totalSeconds: number;
  /** Whether the timer is running */
  running: boolean;
  /** Called when the timer reaches zero */
  onTimeUp?: () => void;
  className?: string;
}

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function QuizTimer({
  totalSeconds,
  running,
  onTimeUp,
  className = "",
}: QuizTimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    setRemaining(totalSeconds);
  }, [totalSeconds]);

  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          onTimeUpRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const progress = remaining / totalSeconds;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const isLow = remaining <= 10;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        className="-rotate-90"
        width="48"
        height="48"
        viewBox="0 0 48 48"
      >
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-warm-200 dark:text-warm-700"
        />
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          className={isLow ? "text-danger-500" : "text-primary-500"}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span
        className={`text-sm font-mono font-semibold ${isLow ? "text-danger-500" : "text-warm-700 dark:text-warm-300"}`}
      >
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
    </div>
  );
}
