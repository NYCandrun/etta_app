import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Astrolabe Error Boundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-warm-50 p-8 dark:bg-warm-950">
          <div className="card max-w-md text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger-50 dark:bg-danger-950">
              <svg
                className="h-8 w-8 text-danger-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-warm-900 dark:text-warm-100">
              Something went wrong
            </h2>
            <p className="mb-6 text-warm-500 dark:text-warm-400">
              Don't worry — your progress is saved. Let's get you back on track.
            </p>
            {this.state.error && (
              <pre className="mb-4 max-h-32 overflow-auto rounded-xl bg-warm-100 p-3 text-left text-xs text-warm-600 dark:bg-warm-800 dark:text-warm-400">
                {this.state.error.message}
              </pre>
            )}
            <button onClick={this.handleReset} className="btn-primary">
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
