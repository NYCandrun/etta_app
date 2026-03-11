import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MathKeyboardProps {
  onInsert: (symbol: string) => void;
  disabled?: boolean;
  className?: string;
}

interface SymbolGroup {
  label: string;
  symbols: { display: string; value: string; label: string }[];
}

const SYMBOL_GROUPS: SymbolGroup[] = [
  {
    label: "Basic",
    symbols: [
      { display: "+", value: "+", label: "plus" },
      { display: "-", value: "-", label: "minus" },
      { display: "\u00D7", value: "\u00D7", label: "times" },
      { display: "\u00F7", value: "\u00F7", label: "divide" },
      { display: "=", value: "=", label: "equals" },
      { display: "\u2260", value: "\u2260", label: "not equal" },
      { display: "<", value: "<", label: "less than" },
      { display: ">", value: ">", label: "greater than" },
      { display: "\u2264", value: "\u2264", label: "less or equal" },
      { display: "\u2265", value: "\u2265", label: "greater or equal" },
      { display: "\u00B1", value: "\u00B1", label: "plus minus" },
      { display: "(", value: "(", label: "left paren" },
      { display: ")", value: ")", label: "right paren" },
    ],
  },
  {
    label: "Algebra",
    symbols: [
      { display: "\u221A", value: "\u221A", label: "square root" },
      { display: "\u221B", value: "\u221B", label: "cube root" },
      { display: "x\u00B2", value: "\u00B2", label: "squared" },
      { display: "x\u00B3", value: "\u00B3", label: "cubed" },
      { display: "x\u207F", value: "^n", label: "to the n" },
      { display: "|x|", value: "||", label: "absolute value" },
      { display: "\u221E", value: "\u221E", label: "infinity" },
      { display: "\u03C0", value: "\u03C0", label: "pi" },
      { display: "e", value: "e", label: "euler" },
      { display: "log", value: "log()", label: "logarithm" },
      { display: "ln", value: "ln()", label: "natural log" },
      { display: "x/y", value: "/", label: "fraction" },
    ],
  },
  {
    label: "Trig",
    symbols: [
      { display: "sin", value: "sin()", label: "sine" },
      { display: "cos", value: "cos()", label: "cosine" },
      { display: "tan", value: "tan()", label: "tangent" },
      { display: "sin\u207B\u00B9", value: "arcsin()", label: "arcsine" },
      { display: "cos\u207B\u00B9", value: "arccos()", label: "arccosine" },
      { display: "tan\u207B\u00B9", value: "arctan()", label: "arctangent" },
      { display: "\u03B8", value: "\u03B8", label: "theta" },
      { display: "\u00B0", value: "\u00B0", label: "degrees" },
    ],
  },
  {
    label: "Calculus",
    symbols: [
      { display: "\u222B", value: "\u222B", label: "integral" },
      { display: "\u2202", value: "\u2202", label: "partial" },
      { display: "\u2211", value: "\u2211", label: "summation" },
      { display: "\u220F", value: "\u220F", label: "product" },
      { display: "\u0394", value: "\u0394", label: "delta" },
      { display: "d/dx", value: "d/dx", label: "derivative" },
      { display: "lim", value: "lim", label: "limit" },
      { display: "\u2192", value: "\u2192", label: "arrow" },
    ],
  },
  {
    label: "Greek",
    symbols: [
      { display: "\u03B1", value: "\u03B1", label: "alpha" },
      { display: "\u03B2", value: "\u03B2", label: "beta" },
      { display: "\u03B3", value: "\u03B3", label: "gamma" },
      { display: "\u03B4", value: "\u03B4", label: "delta" },
      { display: "\u03BB", value: "\u03BB", label: "lambda" },
      { display: "\u03BC", value: "\u03BC", label: "mu" },
      { display: "\u03C3", value: "\u03C3", label: "sigma" },
      { display: "\u03C9", value: "\u03C9", label: "omega" },
    ],
  },
];

export function MathKeyboard({
  onInsert,
  disabled = false,
  className = "",
}: MathKeyboardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeGroup, setActiveGroup] = useState(0);

  return (
    <div className={className}>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        disabled={disabled}
        className="flex items-center gap-2 rounded-lg border border-warm-300 px-3 py-1.5 text-xs font-medium text-warm-600 transition-all hover:bg-warm-50 disabled:opacity-50 dark:border-warm-600 dark:text-warm-400 dark:hover:bg-warm-800"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
        </svg>
        {expanded ? "Hide" : "Math"} Symbols
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Keyboard panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 overflow-hidden rounded-xl border border-warm-200 bg-warm-50 dark:border-warm-700 dark:bg-warm-850"
          >
            {/* Group tabs */}
            <div className="flex border-b border-warm-200 dark:border-warm-700">
              {SYMBOL_GROUPS.map((group, i) => (
                <button
                  key={group.label}
                  onClick={() => setActiveGroup(i)}
                  className={`flex-1 px-2 py-2 text-xs font-medium transition-all
                    ${
                      activeGroup === i
                        ? "border-b-2 border-primary-500 text-primary-600 dark:text-primary-400"
                        : "text-warm-500 hover:text-warm-700 dark:text-warm-400 dark:hover:text-warm-300"
                    }`}
                >
                  {group.label}
                </button>
              ))}
            </div>

            {/* Symbols grid */}
            <div className="grid grid-cols-6 gap-1 p-2 sm:grid-cols-8">
              {SYMBOL_GROUPS[activeGroup]?.symbols.map((sym) => (
                <button
                  key={sym.label}
                  onClick={() => onInsert(sym.value)}
                  disabled={disabled}
                  title={sym.label}
                  className="flex h-10 items-center justify-center rounded-lg border border-warm-200 bg-white text-base font-medium text-warm-800 transition-all hover:border-primary-300 hover:bg-primary-50 active:scale-95 disabled:opacity-50 dark:border-warm-600 dark:bg-warm-800 dark:text-warm-200 dark:hover:border-primary-500 dark:hover:bg-primary-950"
                >
                  {sym.display}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
