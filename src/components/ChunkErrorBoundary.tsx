"use client";

import React from "react";

interface State { hasError: boolean }

export default class ChunkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // This specific TypeError is thrown by webpack's __webpack_require__ when an RSC
    // payload references a client-component chunk that isn't registered on the current
    // page — happens when window.location.assign is in-flight (login/logout transition)
    // and a server action response arrives mid-navigation.
    // We just render null here; the navigation completes and loads the new page cleanly.
    const isChunkError =
      error instanceof TypeError &&
      error.message.includes("Cannot read properties of undefined (reading 'call')") &&
      (error.stack?.includes("webpack") || error.stack?.includes("__webpack_require__"));

    if (!isChunkError) {
      // Real application error — don't swallow it, log for debugging
      console.error("[App]", error);
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
