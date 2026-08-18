// Clean only stale version keys from previous app versions (preserve in-progress test data)
try {
  const v = localStorage.getItem('aisupervision_version');
  if (!v) {
    // First visit or after a clear — set version marker
    localStorage.setItem('aisupervision_version', '2.0');
  }
} catch (e) {}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// DIAGNOSTIC: verify the root element is found
const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<h2 style="color:red;padding:40px">错误: 找不到 #root 元素</h2>';
} else {
  console.log('✅ Found #root, mounting React...');
  ReactDOM.createRoot(rootEl).render(<App />);
  console.log('✅ React mounted');
}
