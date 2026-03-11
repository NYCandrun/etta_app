import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { Concept } from "@/types/concept";
import { formatDuration } from "@/lib/format";
import { getNodeColorClass } from "@/lib/skill-tree-layout";

interface SessionSuggestionProps {
  concepts: Concept[];
  estimatedMinutes?: number;
  onStart: () => void;
  className?: string;
}

export function SessionSuggestion({
  concepts,
  estimatedMinutes,
  onStart,
  className = "",
}: SessionSuggestionProps) {
  const navigate = useNavigate();

  const totalMinutes =
    estimatedMinutes ??
    concepts.reduce((sum, c) => sum + c.estimatedMinutes, 0);

  if (concepts.length === 0) {
    return (
      <div className={`card ${className}`}>
        <h3 className="mb-2 text-sm font-medium text-warm-500 dark:text-warm-400">
          Today's Session
        </h3>
        <p className="text-sm text-warm-400 dark:text-warm-500">
          No concepts ready for review right now. Check back later!
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className={`card ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-warm-500 dark:text-warm-400">
          Today's Session
        </h3>
        <span className="rounded-lg bg-warm-100 px-2 py-0.5 text-xs font-medium text-warm-600 dark:bg-warm-800 dark:text-warm-400">
          ~{formatDuration(totalMinutes)}
        </span>
      </div>

      <ul className="mb-4 space-y-2">
        {concepts.slice(0, 5).map((concept) => (
          <li key={concept.id} className="flex items-center gap-3">
            <span
              className={`flex h-2 w-2 rounded-full ${
                concept.state === "mastered"
                  ? "bg-success-400"
                  : concept.state === "in_progress"
                    ? "bg-accent-400"
                    : "bg-primary-400"
              }`}
            />
            <span className="flex-1 text-sm text-warm-700 dark:text-warm-300">
              {concept.name}
            </span>
            <span
              className={`text-xs capitalize ${getNodeColorClass(concept.state)}`}
            >
              {concept.state.replace("_", " ")}
            </span>
          </li>
        ))}
        {concepts.length > 5 && (
          <li className="text-xs text-warm-400 dark:text-warm-500">
            +{concepts.length - 5} more concepts
          </li>
        )}
      </ul>

      <button
        onClick={() => {
          onStart();
          navigate("/lesson");
        }}
        className="btn-primary w-full"
      >
        Start Session
      </button>
    </motion.div>
  );
}
