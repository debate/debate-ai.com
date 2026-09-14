import React from 'react';
import ReactDOM from 'react-dom/client';

import '@/src/styles/base.css';
import '@/src/styles/timer.css';

import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
