import { Component } from 'react';

// Last-resort screen. Data stays in storage untouched; a reload usually fixes it.
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error(error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="safe-top mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg font-semibold">Something went a little sideways.</p>
        <p className="text-sm text-muted">Your progress is safe on this device.</p>
        <button type="button" onClick={() => location.reload()} className="mt-2 h-11 rounded-full bg-ink px-6 text-sm font-semibold text-bg">
          Reload
        </button>
      </div>
    );
  }
}
