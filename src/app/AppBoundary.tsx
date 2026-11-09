import { Component, type ReactNode } from 'react';
import AuthLoading from './AuthLoading';

// A failed auth script, lazy chunk or crash must leave a useful recovery screen, not an empty root. It says "something went wrong":
// only a real Clerk failure (main.tsx) says sign-in could not load.
export default class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <AuthLoading failed kind="app" /> : this.props.children;
  }
}
