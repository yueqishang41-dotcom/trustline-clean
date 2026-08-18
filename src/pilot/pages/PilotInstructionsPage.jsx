import React from 'react';
import { FileText, ArrowRight, Zap } from 'lucide-react';
import { usePilotActions, usePilotState } from '../pilotStore';

export default function PilotInstructionsPage() {
  const { startTest } = usePilotActions();
  const { formLabel } = usePilotState();

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl animate-fadeIn space-y-6">
        {/* Title */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-50 rounded-2xl mb-4">
            <span className="text-2xl font-bold text-violet-600">🧪</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">办公协作平台 · 入职指引</h1>
          <p className="text-base text-slate-500">请熟悉以下工作流程后开始您的任务</p>
          <span className="inline-flex items-center px-3 py-1 rounded-md bg-slate-100 text-slate-500 text-xs font-medium mt-3">
            当前试卷：{formLabel}
          </span>
        </div>

        {/* Two modules - work phases */}
        <div className="panel overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              工作流程概览
            </h2>
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <span className="text-base font-bold text-blue-600">A</span>
                </div>
                <div>
                  <span className="text-xs text-blue-500 font-medium">第一阶段</span>
                  <h3 className="text-lg font-semibold text-slate-900">文书审阅与修订</h3>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                您将收到 AI 助理生成的初稿，需结合原始材料审阅、核查并修订。共 <strong>6</strong> 项任务。
              </p>
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-3.5 text-sm text-slate-700">
                <div className="flex items-center gap-2 mb-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <strong className="text-slate-800">工作精力说明</strong>
                </div>
                <p>文书审阅阶段共有 <strong className="text-amber-600">20 点工作精力</strong>，请合理分配；模块 B 无精力限制。</p>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                  <span className="text-base font-bold text-violet-600">B</span>
                </div>
                <div>
                  <span className="text-xs text-violet-500 font-medium">第二阶段</span>
                  <h3 className="text-lg font-semibold text-slate-900">工作决策判断</h3>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                您将面对一系列日常工作情境及 AI 助理的回应，请选出最合适的处理方式。共 <strong>10</strong> 道题。
              </p>
              <ul className="space-y-1.5 text-sm text-slate-500">
                <li className="flex items-start gap-2"><span className="text-violet-400 mt-0.5">•</span><span>凭第一直觉作答</span></li>
                <li className="flex items-start gap-2"><span className="text-violet-400 mt-0.5">•</span><span>完成第一阶段后自动进入</span></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Start */}
        <div className="panel p-6">
          <button onClick={() => startTest()} className="btn-primary w-full text-base py-3">
            开始工作 <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
