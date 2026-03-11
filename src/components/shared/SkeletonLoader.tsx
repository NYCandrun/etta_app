import { useState, useEffect } from "react";

const MICRO_MESSAGES = [
  "Crafting your next challenge...",
  "Finding the perfect example...",
  "Preparing something special...",
  "Connecting the dots...",
  "Thinking deeply about this...",
  "Almost ready for you...",
  "Sharpening the details...",
  "Building your path forward...",
];

interface SkeletonLoaderProps {
  /** Number of skeleton lines to show */
  lines?: number;
  /** Show the rotating micro-message */
  showMessage?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function SkeletonLoader({
  lines = 3,
  showMessage = true,
  className = "",
}: SkeletonLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!showMessage) return;
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % MICRO_MESSAGES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [showMessage]);

  return (
    <div className={`animate-pulse space-y-4 ${className}`} role="status" aria-label="Loading">
      {showMessage && (
        <p className="text-center text-sm font-medium text-warm-400 dark:text-warm-500 transition-all duration-500">
          {MICRO_MESSAGES[messageIndex]}
        </p>
      )}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 rounded-lg bg-warm-200 dark:bg-warm-800"
            style={{ width: `${85 - i * 15}%` }}
          />
        ))}
      </div>
      <span className="sr-only">Loading content...</span>
    </div>
  );
}

/**
 * Card-shaped skeleton for dashboard widgets.
 */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`card animate-pulse ${className}`} role="status" aria-label="Loading">
      <div className="mb-3 h-5 w-1/3 rounded-lg bg-warm-200 dark:bg-warm-800" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded-lg bg-warm-200 dark:bg-warm-800" />
        <div className="h-4 w-5/6 rounded-lg bg-warm-200 dark:bg-warm-800" />
        <div className="h-4 w-2/3 rounded-lg bg-warm-200 dark:bg-warm-800" />
      </div>
      <span className="sr-only">Loading content...</span>
    </div>
  );
}
