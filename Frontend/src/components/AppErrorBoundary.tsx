import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export default class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unknown render error',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App render failure:', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] p-6 text-[var(--text-primary)]">
        <div className="glass-panel w-full max-w-2xl rounded-[2rem] p-8 shadow-[var(--shadow-strong)]">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
            Render Error
          </div>
          <h1 className="mb-3 text-3xl font-semibold tracking-tight">
            The UI failed during render.
          </h1>
          <p className="mb-5 text-sm leading-7 text-[var(--text-secondary)]">
            The blank screen was caused by a runtime rendering failure. This fallback keeps
            the app visible while the failing component is fixed.
          </p>
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {this.state.errorMessage}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)]"
          >
            <RefreshCw className="h-4 w-4" />
            Reload App
          </button>
        </div>
      </div>
    );
  }
}
