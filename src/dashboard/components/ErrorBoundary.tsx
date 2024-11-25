import React, { Component, ErrorInfo, ReactNode } from 'react';

/**
 * Error Boundary component to catch and handle errors in the dashboard
 */
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    // Update state to display fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error details
    console.error('Uncaught error:', error, errorInfo);
    // Optionally, send error details to a logging service
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return <h2>Something went wrong.</h2>;
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 