import React from 'react';
import ReactDOM from 'react-dom/client';
import { ReasonDocs } from '../src/index';
import '../src/lexical/styles/tailwind.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ReasonDocs />
  </React.StrictMode>
);
