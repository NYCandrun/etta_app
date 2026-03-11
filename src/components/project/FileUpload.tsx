import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { isTauri } from "@/hooks/useInvoke";

interface FileUploadProps {
  acceptedFormats: string[];
  onFileSelected: (filePath: string, fileName: string) => void;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  acceptedFormats,
  onFileSelected,
  disabled = false,
  className = "",
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    path: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFile = useCallback(async () => {
    setError(null);
    try {
      if (isTauri()) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const result = await open({
          multiple: false,
          filters: [
            {
              name: "Accepted files",
              extensions: acceptedFormats,
            },
          ],
        });
        if (result) {
          const path = typeof result === "string" ? result : result;
          const name = String(path).split("/").pop() ?? "file";
          // Validate extension
          const ext = name.split(".").pop()?.toLowerCase();
          if (ext && acceptedFormats.includes(ext)) {
            setSelectedFile({ name, path: String(path) });
            onFileSelected(String(path), name);
          } else {
            setError(
              `Invalid format. Accepted: ${acceptedFormats.map((f) => `.${f}`).join(", ")}`
            );
          }
        }
      } else {
        // Browser fallback: use input[type=file]
        const input = document.createElement("input");
        input.type = "file";
        input.accept = acceptedFormats.map((f) => `.${f}`).join(",");
        input.onchange = () => {
          const file = input.files?.[0];
          if (file) {
            setSelectedFile({ name: file.name, path: file.name });
            onFileSelected(file.name, file.name);
          }
        };
        input.click();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select file");
    }
  }, [acceptedFormats, onFileSelected]);

  return (
    <div className={`space-y-3 ${className}`}>
      <motion.button
        onClick={handleSelectFile}
        disabled={disabled}
        className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-warm-300 bg-warm-50 p-8
          hover:border-primary-400 hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-500
          disabled:cursor-not-allowed disabled:opacity-50
          dark:border-warm-700 dark:bg-warm-850 dark:hover:border-primary-600 dark:hover:bg-primary-950"
        whileHover={!disabled ? { scale: 1.01 } : {}}
        whileTap={!disabled ? { scale: 0.99 } : {}}
      >
        <svg
          className="h-10 w-10 text-warm-400 dark:text-warm-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <span className="text-sm font-medium text-warm-600 dark:text-warm-400">
          {selectedFile ? "Change file" : "Choose a file to upload"}
        </span>
        <span className="text-xs text-warm-400 dark:text-warm-500">
          Accepted: {acceptedFormats.map((f) => `.${f}`).join(", ")}
        </span>
      </motion.button>

      {/* Selected file */}
      {selectedFile && (
        <div className="flex items-center gap-3 rounded-xl bg-primary-50 px-4 py-3 dark:bg-primary-950">
          <svg
            className="h-5 w-5 text-primary-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <span className="flex-1 truncate text-sm font-medium text-primary-700 dark:text-primary-300">
            {selectedFile.name}
          </span>
          <button
            onClick={() => setSelectedFile(null)}
            className="text-primary-400 hover:text-primary-600 dark:hover:text-primary-300"
            aria-label="Remove file"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-danger-500">{error}</p>
      )}
    </div>
  );
}
