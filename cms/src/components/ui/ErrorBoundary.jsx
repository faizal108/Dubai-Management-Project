import React from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Button from "./Button";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("UI ErrorBoundary caught:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    if (this.props.fallback) {
      return typeof this.props.fallback === "function"
        ? this.props.fallback({ error: this.state.error, reset: this.reset })
        : this.props.fallback;
    }

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center shadow-card">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
            <ExclamationTriangleIcon className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Something went wrong
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              An unexpected error occurred while rendering this page. You can
              try reloading or go back to the dashboard.
            </p>
          </div>
          <pre className="max-h-32 w-full overflow-auto rounded-md bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.reset}>
              Try again
            </Button>
            <Button onClick={() => window.location.assign("/")}>
              Go home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
