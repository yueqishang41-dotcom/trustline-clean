import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronRight, MessageSquare, Clock, RefreshCw } from 'lucide-react';
import { usePilotState, usePilotActions } from '../pilotStore';

function shuffle(arr) {
  const a = arr.map((x, i) => ({ ...x, _orig: i }));
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export default function PilotModuleBPage() {
  const state = usePilotState();
  const actions = usePilotActions();
  const { moduleBQuestions, moduleBCurrentIndex, moduleBResponses, startTime } = state;
  const q = moduleBQuestions[moduleBCurrentIndex];
  const saved = moduleBResponses[q?.id];

  const shuffled = useMemo(() => q ? shuffle(q.options || []) : [], [moduleBCurrentIndex, q?.id]);
  const [sel, setSel] = useState(null);
  const [cd, setCd] = useState(1500);
  const questionStartRef = useRef(Date.now());
  const done = sel !== null && sel !== undefined;

  useEffect(() => {
    if (!startTime) return;
    const tick = () => setCd(Math.max(0, 1500 - Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [startTime]);

  useEffect(() => {
    if (saved) { setSel(saved.selectedIndex ?? null); }
    else { setSel(null); questionStartRef.current = Date.now(); }
  }, [moduleBCurrentIndex, q?.id]);

  const pick = useCallback((opt) => {
    const timeUsed = Math.round((Date.now() - questionStartRef.current) / 1000);
    if (sel === opt._orig) {
      setSel(null);
      actions.updateModuleBResponse(q.id, {
        selectedIndex: undefined, selectedScore: undefined, selectedText: undefined, timeUsed,
      });
    } else {
      setSel(opt._orig);
      actions.updateModuleBResponse(q.id, {
        selectedIndex: opt._orig, selectedScore: opt.score, selectedText: opt.text, timeUsed,
      });
    }
  }, [sel, q, actions]);

  if (!q) return null;

  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const scene = q.scenario || q.background || '';

  return (
    <div className="h-screen bg-slate-100 flex flex-col">
      <header className="shrink-0 bg-white border-b border-slate-200 px-5" style={{ height: '3.25rem' }}>
        <div className="h-full flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-medium text-slate-500">模块 B</span>
            <button onClick={() => { if (window.confirm('确认重置测试？所有当前进度将丢失。')) actions.reset(); }}
              className="opacity-20 hover:opacity-60 transition-opacity ml-1" title="重置测试（工作人员专用）">
              <RefreshCw className="w-3 h-3 text-slate-400" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className={`font-mono text-base font-bold tabular-nums ${cd < 300 ? 'text-red-500' : 'text-slate-700'}`}>{fmt(cd)}</span>
            </div>
            <div className="flex gap-1">
              {moduleBQuestions.map((_, i) => (
                <div key={i} className={`w-5 h-1.5 rounded-full ${i === moduleBCurrentIndex ? 'bg-blue-500' : moduleBResponses[moduleBQuestions[i]?.id] ? 'bg-emerald-400' : 'bg-slate-200'}`} />
              ))}
            </div>
            <span className="text-sm font-mono font-medium text-slate-400">{moduleBCurrentIndex + 1}/{moduleBQuestions.length}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-2xl animate-fadeIn space-y-5">
          <div className="text-center">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-50 text-blue-600 text-base font-bold border border-blue-200">
              {moduleBCurrentIndex + 1}
            </span>
          </div>

          <div className="panel p-6">
            <p className="text-[15px] text-slate-600 leading-relaxed">{scene}</p>
            {q.aiReply && (
              <div className="mt-4 bg-blue-50 rounded-xl p-5 border border-blue-200">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-500 font-medium mb-1">AI 回复</p>
                    <p className="text-[15px] text-slate-600 leading-relaxed">{q.aiReply}</p>
                  </div>
                </div>
              </div>
            )}
            <p className="text-sm text-slate-400 mt-4">请选择您认为最合适的行动方案：</p>
          </div>

          <div className="space-y-3">
            {shuffled.map((opt, di) => {
              const isSel = sel === opt._orig;
              return (
                <button key={di} onClick={() => pick(opt)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    isSel ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm'
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      isSel ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {String.fromCharCode(65 + di)}
                    </div>
                    <p className="text-[15px] text-slate-600 leading-relaxed pt-0.5">{opt.text}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-400 pt-1">点击已选选项可取消，点击其他选项可更改，确认后点击「下一题」。</p>

          <div className="flex justify-end pt-2">
            <button onClick={actions.goToNextModuleB} disabled={!done}
              className="btn-primary text-base py-3 px-6">
              {moduleBCurrentIndex < moduleBQuestions.length - 1
                ? <>下一题 <ChevronRight className="w-5 h-5" /></>
                : <>完成 <ChevronRight className="w-5 h-5" /></>}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
