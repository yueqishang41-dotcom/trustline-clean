import React from 'react';
import ReactDOM from 'react-dom/client';
import PilotApp from './pilotApp';
import '../index.css';

const rootEl = document.getElementById('pilot-root');
if (!rootEl) {
  document.body.innerHTML = '<h2 style="color:red;padding:40px">错误: 找不到 #pilot-root 元素</h2>';
} else {
  ReactDOM.createRoot(rootEl).render(<PilotApp />);
}
