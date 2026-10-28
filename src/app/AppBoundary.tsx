import { Component, type ReactNode } from 'react';
import AuthLoading from './AuthLoading';

// A failed auth script or lazy chunk must leave a useful recovery screen, not an empty root.
export default class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <AuthLoading failed /> : this.props.children;
  }
}
