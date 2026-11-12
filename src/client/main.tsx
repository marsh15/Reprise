import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Stylesheets are linked from index.html in cascade order: tokens, base, shell, thread, evidence.
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
