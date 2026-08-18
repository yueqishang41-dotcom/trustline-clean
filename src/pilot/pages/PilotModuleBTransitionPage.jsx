import React from 'react';
import { ArrowRight, MessageSquare } from 'lucide-react';
import { usePilotActions } from '../pilotStore';

export default function PilotModuleBTransitionPage() {
  const { setPhase } = usePilotActions();

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="panel p-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-50 rounded-2xl mb-6">
            <MessageSquare className="w-8 h-8 text-violet-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-3">模块 A 已完成！</h1>
          <p className="text-base text-slate-600 leading-relaxed mb-8">
            接下来进入模块 B 微决策情境判断（共 10 题，不消耗精力），请凭第一直觉作答。
          </p>
          <button onClick={() => setPhase('moduleB')} className="btn-primary w-full text-base py-3">
            进入模块 B <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
