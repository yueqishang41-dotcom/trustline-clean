import React from 'react';
import { PilotProvider, usePilotState } from './pilotStore';
import { isPilotClosed, PILOT_HARD_CLOSE } from './pilotGate';
import PilotClosedPage from './pages/PilotClosedPage';
import PilotSubjectInfoPage from './pages/PilotSubjectInfoPage';
import PilotInstructionsPage from './pages/PilotInstructionsPage';
import PilotModuleAPage from './pages/PilotModuleAPage';
import PilotModuleBTransitionPage from './pages/PilotModuleBTransitionPage';
import PilotModuleBPage from './pages/PilotModuleBPage';
import PilotCompletionPage from './pages/PilotCompletionPage';

function PilotRouter() {
  // 每 10s 重查一次关闭时间，保证「停在指导页未开始」的人到点也会被拦下
  const [, setTick] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  try {
    const { phase } = usePilotState();
    // 到关闭时间后的处理：
    //  - 完成感恩页始终保留（数据照常上传）；
    //  - 硬关闭（PILOT_HARD_CLOSE=true）：除感恩页外全部显示关闭页（含在测被试，会被截断）；
    //  - 默认策略：只拦「尚未开始」的人（subject-info / instructions），在测被试允许做完提交。
    if (isPilotClosed()) {
      if (phase === 'completion') return <PilotCompletionPage />;
      if (PILOT_HARD_CLOSE || phase === 'subject-info' || phase === 'instructions') {
        return <PilotClosedPage />;
      }
    }
    switch (phase) {
      case 'subject-info': return <PilotSubjectInfoPage />;
      case 'instructions': return <PilotInstructionsPage />;
      case 'moduleA': return <PilotModuleAPage />;
      case 'moduleBTransition': return <PilotModuleBTransitionPage />;
      case 'moduleB': return <PilotModuleBPage />;
      case 'completion': return <PilotCompletionPage />;
      default: return <PilotSubjectInfoPage />;
    }
  } catch (e) {
    return <CrashScreen msg={e.message} />;
  }
}

function CrashScreen({ msg }) {
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', background: '#f1f5f9', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, color: '#1e293b' }}>预实验应用遇到异常</h1>
      <p style={{ color: '#ef4444', margin: '12px 0' }}>{msg || '未知错误'}</p>
      <button
        onClick={() => { try { localStorage.clear(); } catch (e) {} window.location.reload(); }}
        style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
      >清除数据并刷新</button>
    </div>
  );
}

class PilotErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <CrashScreen msg={this.state.error.message} />;
    return this.props.children;
  }
}

export default function PilotApp() {
  return (
    <PilotErrorBoundary>
      <PilotProvider>
        <PilotRouter />
      </PilotProvider>
    </PilotErrorBoundary>
  );
}
