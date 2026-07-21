import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

/**
 * Application-wide error boundary — Milestone 5.
 *
 * Catches render/runtime errors anywhere in the component tree so a
 * single failing panel cannot blank the whole app. Shows a diagnostic
 * message plus a recovery action. The persistent scenario library is
 * unaffected (it lives in localStorage), so reloading recovers state.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the console for diagnostics; no external reporting.
    console.error('TALON UI error boundary caught:', error, info);
    this.setState({ info });
  }

  handleReset = (): void => {
    this.setState({ error: null, info: null });
  };

  render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <h1>Something went wrong in the interface</h1>
        <p>
          A component failed to render. Your saved scenarios are stored separately and are not
          affected. You can dismiss this and retry, or reload the page.
        </p>
        <p>
          <strong>Diagnostic:</strong> {error.message}
        </p>
        {info?.componentStack && (
          <details>
            <summary>Component stack</summary>
            <pre>{info.componentStack}</pre>
          </details>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={this.handleReset}>Dismiss and retry</button>
          <button onClick={() => window.location.reload()}>Reload application</button>
        </div>
      </div>
    );
  }
}
