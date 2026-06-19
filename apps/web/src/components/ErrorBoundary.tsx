'use client';

import React from 'react';
import Link from 'next/link';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.props.onError?.(error, info);
    import('@sentry/nextjs')
      .then(({ captureException }) =>
        captureException(error, { extra: { componentStack: info.componentStack } }),
      )
      .catch(() => undefined);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const isDev = process.env.NODE_ENV === 'development';

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center space-y-3 my-4">
        <div className="flex justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-slate-400"
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
        <h2 className="text-base font-semibold text-slate-800">Something went wrong</h2>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          This section couldn&apos;t load. It may be a temporary issue.
        </p>
        {isDev && this.state.error && (
          <details className="text-left mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <summary className="text-xs font-medium text-red-700 cursor-pointer select-none">
              Error details (dev only)
            </summary>
            <pre className="mt-2 text-xs text-red-800 whitespace-pre-wrap break-all overflow-auto max-h-48">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          </details>
        )}
        <div className="flex justify-center gap-3 pt-1">
          <button
            onClick={this.reset}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Go home
          </Link>
        </div>
      </div>
    );
  }
}
