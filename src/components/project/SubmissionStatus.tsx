import { motion } from "framer-motion";
import type { SubmissionStatus as StatusType } from "@/types/submission";
import { SkeletonLoader } from "@/components/shared/SkeletonLoader";

interface SubmissionStatusProps {
  status: StatusType;
  className?: string;
}

export function SubmissionStatus({
  status,
  className = "",
}: SubmissionStatusProps) {
  return (
    <div className={`card ${className}`}>
      {/* Status steps */}
      <div className="flex items-center gap-4">
        {/* Pending */}
        <Step
          label="Submitted"
          active={status === "pending"}
          complete={status === "evaluating" || status === "reviewed"}
        />
        <Connector complete={status === "evaluating" || status === "reviewed"} />

        {/* Evaluating */}
        <Step
          label="Evaluating"
          active={status === "evaluating"}
          complete={status === "reviewed"}
        />
        <Connector complete={status === "reviewed"} />

        {/* Reviewed */}
        <Step
          label="Reviewed"
          active={status === "reviewed"}
          complete={false}
        />
      </div>

      {/* Loading state while evaluating */}
      {status === "evaluating" && (
        <div className="mt-4">
          <SkeletonLoader lines={4} showMessage />
        </div>
      )}
    </div>
  );
}

function Step({
  label,
  active,
  complete,
}: {
  label: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.div
        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
          complete
            ? "border-success-500 bg-success-500"
            : active
              ? "border-primary-500 bg-primary-500"
              : "border-warm-300 bg-warm-100 dark:border-warm-600 dark:bg-warm-800"
        }`}
        animate={active ? { scale: [1, 1.1, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        {complete ? (
          <svg
            className="h-4 w-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        ) : active ? (
          <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
        ) : (
          <div className="h-2 w-2 rounded-full bg-warm-300 dark:bg-warm-600" />
        )}
      </motion.div>
      <span
        className={`text-xs font-medium ${
          complete || active
            ? "text-warm-700 dark:text-warm-300"
            : "text-warm-400 dark:text-warm-500"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function Connector({ complete }: { complete: boolean }) {
  return (
    <div
      className={`h-0.5 flex-1 rounded-full ${
        complete
          ? "bg-success-400"
          : "bg-warm-200 dark:bg-warm-700"
      }`}
    />
  );
}
