import React, { useEffect } from 'react';
import { TestProvider, useTestState } from './store/testStore';
import SubjectInfoPage from './pages/SubjectInfoPage';
import InstructionsPage from './pages/InstructionsPage';
import ModuleAPage from './pages/ModuleAPage';
import ModuleBPage from './pages/ModuleBPage';
import CompletionPage from './pages/CompletionPage';
import { flushPendingUploads } from './utils/upload';

function TestRouter() {
  // 应用挂载时静默补传此前上传失败暂存的数据（被试无感）
  useEffect(() => {
    flushPendingUploads().catch(() => {});
  }, []);

  try {
    const { phase } = useTestState();
    switch (phase) {
      case 'subject-info': return <SubjectInfoPage />;
      case 'instructions': return <InstructionsPage />;
      case 'moduleA': return <ModuleAPage />;
      case 'moduleB': return <ModuleBPage />;
      case 'completion': return <CompletionPage />;
      default: return <SubjectInfoPage />;
    }
  } catch (e) {
    return <CrashScreen msg={e.message} />;
  }
}

function CrashScreen({ msg }) {
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', background: '#f1f5f9', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, color: '#1e293b' }}>应用遇到异常</h1>
      <p style={{ color: '#ef4444', margin: '12px 0' }}>{msg || '未知错误'}</p>
      <button onClick={() => { try { localStorage.clear(); } catch(e) {} window.location.reload(); }}
        style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
        清除数据并刷新
      </button>
    </div>
  );
}

class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <CrashScreen msg={this.state.error.message} />;
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <TestProvider>
        <TestRouter />
      </TestProvider>
    </AppErrorBoundary>
  );
}
