import React from 'react';
import ReactDOM from 'react-dom/client';
import PopupApp from './PopupApp';
import '@/styles/global.css';
import './popup.css';
import { applyDocumentLocale } from '@/i18n';

applyDocumentLocale('popupPageTitle');

// 渲染Popup应用
const root = ReactDOM.createRoot(document.getElementById('popup-root')!);
root.render(<PopupApp />);