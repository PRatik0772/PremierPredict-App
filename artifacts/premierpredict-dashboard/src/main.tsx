import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// Responsive Recharts containers can emit this browser-level notification while
// resizing. It is harmless, but Replit's dev error overlay treats it as a fatal
// runtime exception. Keep real exceptions untouched.
window.addEventListener(
  'error',
  (event) => {
    const message = event.message || '';
    if (
      message.includes('ResizeObserver loop completed') ||
      message.includes('ResizeObserver loop limit exceeded')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true,
);

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
