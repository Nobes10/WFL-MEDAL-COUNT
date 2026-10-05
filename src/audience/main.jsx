import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AudienceApp } from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AudienceApp />
  </StrictMode>
);
