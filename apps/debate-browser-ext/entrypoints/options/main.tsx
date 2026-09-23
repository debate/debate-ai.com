import React from 'react';
import ReactDOM from 'react-dom/client';

import '@/src/styles/base.css';
// The web UI package ships its own scoped stylesheet (everything under
// `.dai-root`), so it renders the same here as it would in a host with no
// Tailwind at all.
import 'debate-ai-webui/styles.css';
import '@/src/styles/options.css';

import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
