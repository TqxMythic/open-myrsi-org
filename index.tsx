import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { installAvatarFallback } from './lib/avatarFallback';
import { printConsoleBanner } from './lib/consoleBanner';

// Vite fires this when a dynamic import (React.lazy) fails to preload (e.g. a
// stale chunk after a deploy). Let the error propagate to the ErrorBoundary
// rather than auto-reloading (which can loop on Safari); the lazyWithRetry
// wrappers in App/DashboardApp handle transient preload failures.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
});

installAvatarFallback();
printConsoleBanner();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);