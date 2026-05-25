import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import OptionsApp from './OptionsApp';
import '../src/styles/global.css';

const root = ReactDOM.createRoot(document.getElementById('options-root')!);
root.render(
  <HashRouter>
    <OptionsApp />
  </HashRouter>
);