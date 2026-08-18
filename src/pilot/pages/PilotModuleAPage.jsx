import React, { useState, useEffect, useRef } from 'react';
import { FileText, Clock, RefreshCw, Send, CheckCircle, Info, BookOpen, RotateCw } from 'lucide-react';
import { usePilotState, usePilotActions } from '../pilotStore';
import PilotConfirmModal from '../components/PilotConfirmModal';

function clean(s) {
  if (!s) return '';
  return s.replace(/^\[AI[^\]]*\]\s*/g, '').trim();
}

function getQuestionGuidelines(q) {
  const guidelines = q.guidelines || '';
  const sceneLabels = { data: '数据分析', compliance: '制度合规', communication: '对外沟通' };
  const sceneLabel = sceneLabels[q.sceneType] || q.sceneType || '通用';
  if (guidelines) return { title: `工作规范 · ${sceneLabel}`, content: guidelines };
  return null;
}

export default function PilotModuleAPage() {
  const state = usePilotState();
  const a = usePilotActions();
  const { moduleAQuestions, moduleACurrentIndex, moduleAResponses, energyPoints, evidenceUnlocked, startTime } = state;

  const [text, setText] = useState('');
  const [showTemplate, setShowTemplate] = useState(false);
  const [cd, setCd] = useState(1500);
  const [promptInput, setPromptInput] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  // 二次确认弹窗状态
  const [pendingAction, setPendingAction] = useState(null); // { type: 'evidence' | 'template' | 'regenerate', cost }

  const q = moduleAQuestions && moduleAQuestions[moduleACurrentIndex];

  // 每题付费状态（同一题只付一次）
  const paidForRef = useRef({});
  const questionStartRef = useRef(Date.now());

  useEffect(() => {
    if (!q) return;
    const orig = clean(q.aiDraft || '');
    setText(moduleAResponses[q.id]?.editedText || orig);
    setShowTemplate(false);
    setShowPrompt(false);
    setPromptInput('');
    if (!paidForRef.current[q.id]) paidForRef.current[q.id] = { template: false, evidence: false, regenerate: false };
    questionStartRef.current = Date.now();
  }, [moduleACurrentIndex, q?.id]);

  useEffect(() => {
    if (!startTime) return;
    const tick = () => setCd(Math.max(0, 1500 - Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  if (!q || !moduleAQuestions || !moduleAQuestions.length) {
    return (
      <div className="h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-lg text-slate-500">正在加载题目...</p>
      </div>
    );
  }

  const orig = clean(q.aiDraft || '');
  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const template = getQuestionGuidelines(q);

  // ---- 确认弹窗确认/取消 ----
  const confirmPay = () => {
    if (!pendingAction) return;
    const { type, cost } = pendingAction;
    if (type === 'evidence') {
      a.consumeEnergy(3, 'view_evidence', q.id);
      a.setEvidenceUnlocked(true);
      paidForRef.current[q.id].evidence = true;
    } else if (type === 'template') {
      a.consumeEnergy(2, 'view_template', q.id);
      setShowTemplate(true);
      paidForRef.current[q.id].template = true;
    } else if (type === 'regenerate') {
      a.consumeEnergy(1, 'regenerate_prompt', q.id);
      paidForRef.current[q.id].regenerate = true; // 记录本题用过微调（能量已扣即视为已用）
      setShowPrompt(true);
    }
    setPendingAction(null);
  };
  const cancelPay = () => setPendingAction(null);

  // ---- 解锁材料包（3点）：需二次确认 ----
  const onEvidence = () => {
    if (evidenceUnlocked) { a.setEvidenceUnlocked(false); return; }
    if (paidForRef.current[q.id]?.evidence) { a.setEvidenceUnlocked(true); return; } // 已付费，免费重开
    if (energyPoints >= 3) setPendingAction({ type: 'evidence', cost: 3 }); // 首次：二次确认
  };

  // ---- 查看工作规范（2点）：需二次确认 ----
  const onShowTemplate = () => {
    if (showTemplate) { setShowTemplate(false); return; }
    if (paidForRef.current[q.id]?.template) { setShowTemplate(true); return; } // 已付费，免费重开
    if (energyPoints >= 2) setPendingAction({ type: 'template', cost: 2 }); // 首次：二次确认
  };

  // ---- 微调 Prompt（1点）：输入新约束，让 AI 基于当前内容重新生成 ----
  const onRegen = () => {
    if (showPrompt) { setShowPrompt(false); return; }
    if (paidForRef.current[q.id]?.regenerate) { setShowPrompt(true); return; } // 已付费，免费重开
    if (energyPoints >= 1) setPendingAction({ type: 'regenerate', cost: 1 }); // 首次：二次确认
  };

  const applyPrompt = async () => {
    if (!promptInput.trim()) return;

    // 微调请求：严格基于当前文本框内容（含已手动编辑部分）修改
    // 仅当「本题已付费解锁工作规范」且「提示语明确提到'规范'」同时满足时，
    // 才将本题工作规范携带给 AI 作为修改依据；否则只按提示语修改，不透露规范内容。
    const currentText = text.trim();
    const guideline = (q.guidelines || '').trim();
    const unlockedGuideline = paidForRef.current[q.id]?.template === true; // 花过2点解锁本题规范
    const mentionsGuideline = /规范/.test(promptInput);                    // 提示语提到"规范"
    const useGuideline = unlockedGuideline && mentionsGuideline;

    const blocks = [
      '你是一位专业的职场AI助理。请在一份工作文档的当前内容基础上按要求修改，直接输出修改后的完整文档。',
      '',
    ];
    if (useGuideline) {
      blocks.push(
        '【工作规范】',
        guideline || '（本题无特殊规范，请保持专业、简洁、准确。）',
        '',
      );
    }
    blocks.push(
      '【当前文档】',
      '"""',
      currentText || orig,
      '"""',
      '',
      `【修改要求】${promptInput}`,
      '',
      '要求：严格基于上述当前文档内容进行修改，完整保留我已手动编辑的部分，不得丢弃或另起炉灶生成与当前内容无关的版本。',
    );
    const userContent = blocks.join('\n');

    // 调用 DeepSeek API 代理（走 /api/chat → Netlify Function），自动重试一次
    let res = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: userContent }] }),
        });
      } catch (e) {
        // 网络层失败（含浏览器 fetch 超时）→ 重试一次
        if (attempt === 1) { await new Promise((r) => setTimeout(r, 1000)); continue; }
        window.alert('AI 服务连接失败，请稍后重试。若多次失败，您可以直接手动编辑文本。');
        return;
      }
      if (res.ok) break;
      // 网关错误（502/503/504）→ 重试一次；其他错误直接结束
      if ([502, 503, 504].includes(res.status) && attempt === 1) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      break;
    }

    if (res && res.ok) {
      const data = await res.json();
      setText(data.content);
      setShowPrompt(false);
      setPromptInput('');
      return;
    }

    // 两次都失败 → 友好提示（不暴露内部细节）
    let errMsg = `AI 服务暂不可用（${res ? `状态码 ${res.status}` : '网络错误'}），请稍后重试或直接手动编辑文本。`;
    try {
      const errData = await (res && res.json());
      if (errData?.error) errMsg = `AI 服务暂不可用：${errData.error}`;
    } catch (_) {}
    window.alert(errMsg);
  };

  const onSubmit = () => {
    a.updateModuleAResponse(q.id, {
      editedText: text,
      timeUsed: Math.round((Date.now() - questionStartRef.current) / 1000),
      actionsUsed: {
        viewEvidence: paidForRef.current[q.id]?.evidence || false,
        viewTemplate: paidForRef.current[q.id]?.template || false,
        regenerate: paidForRef.current[q.id]?.regenerate || false, // 是否使用过"微调 Prompt"（以扣费记录为准）
        editPerformed: text !== orig,
      },
      finalText: text,
    });
    a.goToNextModuleA();
  };

  // ---- 异常大段粘贴监控（>100 字符）----
  const onPaste = (e) => {
    const pasted = (e.clipboardData && e.clipboardData.getData('text')) || '';
    if (pasted.length > 100) {
      a.addBulkPaste(pasted.length);
    }
  };

  const templatePaid = paidForRef.current[q.id]?.template || false;
  const evidencePaid = paidForRef.current[q.id]?.evidence || false;

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* Top bar */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-5" style={{ height: '3.25rem' }}>
        <div className="h-full flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className={`font-mono text-base font-bold tabular-nums ${cd < 300 ? 'text-red-500' : 'text-slate-700'}`}>{fmt(cd)}</span>
            </div>
            <EnergyBar points={energyPoints} />
            <button onClick={() => { if (window.confirm('确认重置测试？所有当前进度将丢失。')) a.reset(); }}
              className="opacity-20 hover:opacity-60 transition-opacity" title="重置测试（工作人员专用）">
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-500">模块 A</span>
            <div className="flex gap-1">
              {moduleAQuestions.map((_, i) => (
                <div key={i} className={`w-6 h-1.5 rounded-full ${i === moduleACurrentIndex ? 'bg-blue-500' : i < moduleACurrentIndex ? 'bg-blue-300' : 'bg-slate-200'}`} />
              ))}
            </div>
            <span className="text-sm text-slate-400 font-mono font-medium">{moduleACurrentIndex + 1}/{moduleAQuestions.length}</span>
          </div>
        </div>
      </header>

      {/* Content grid */}
      <div className="flex-1 min-h-0 p-4 gap-4 grid grid-cols-1 xl:grid-cols-12 overflow-y-auto" style={{ height: 'calc(100vh - 3.25rem)' }}>
        {/* Left: task background */}
        <div className="col-span-12 xl:col-span-3 panel flex flex-col overflow-hidden min-w-0 max-h-[45vh] xl:max-h-none">
          <div className="panel-hd"><Info className="w-4 h-4 text-blue-500" /><span className="text-sm font-semibold text-slate-700">任务背景</span></div>
          <div className="panel-bd flex-1 overflow-y-auto space-y-4">
            <p className="text-[15px] text-slate-600 leading-relaxed">{q.background || ''}</p>
          </div>
        </div>

        {/* Middle: AI draft editor */}
        <div className="col-span-12 xl:col-span-5 panel flex flex-col overflow-hidden min-w-0 max-h-[45vh] xl:max-h-none">
          <div className="panel-hd flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-slate-700">AI 初稿 — 请审核编辑</span>
            </div>
            {text !== orig
              ? <span className="tag bg-emerald-50 text-emerald-600 border-emerald-200 text-xs">已修改</span>
              : <span className="tag bg-slate-100 text-slate-400 border-slate-200 text-xs">未修改</span>}
          </div>
          <div className="flex-1 flex flex-col p-5 gap-3 min-h-0">
            <div className="flex-1 relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPaste={onPaste}
                className="w-full h-full min-w-0 min-h-[120px] xl:min-h-[200px] p-4 text-[15px] border border-slate-200 rounded-lg resize-y leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>

            {/* 微调 Prompt 输入框 */}
            {showPrompt && (
              <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-4 py-2.5 border border-amber-200">
                <input
                  type="text" value={promptInput} onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="输入新约束条件，如：语气改为正式..."
                  className="flex-1 px-3 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                  onKeyDown={(e) => { if (e.key === 'Enter') applyPrompt(); }}
                />
                <button onClick={applyPrompt}
                  className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium">应用</button>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100">
              <ActionBtn icon={<BookOpen className="w-5 h-5" />} label="查看工作规范" desc="解锁（消耗 2 点精力）" cost={2}
                active={showTemplate} disabled={!templatePaid && energyPoints < 2} onClick={onShowTemplate} color="blue" />
              <ActionBtn icon={<FileText className="w-5 h-5" />} label="解锁材料包" desc="消耗 3 点精力" cost={3}
                active={evidenceUnlocked} disabled={!evidencePaid && energyPoints < 3} onClick={onEvidence} color="violet" />
              <ActionBtn icon={<RotateCw className="w-5 h-5" />} label="微调 Prompt" desc="输入新约束重生成" cost={1}
                active={showPrompt} disabled={!showPrompt && energyPoints < 1} onClick={onRegen} color="amber" />
              <ActionBtn icon={<Send className="w-5 h-5" />} label="提交本题" desc="进入下一题" cost={0}
                active={false} disabled={false} onClick={onSubmit} color="emerald" />
            </div>
          </div>
        </div>

        {/* Right: evidence */}
        <div className="col-span-12 xl:col-span-4 panel flex flex-col overflow-hidden min-w-0 max-h-[45vh] xl:max-h-none">
          <div className="panel-hd flex items-center justify-between">
            <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-violet-500" /><span className="text-sm font-semibold text-slate-700">参考信息</span></div>
            {evidenceUnlocked && <span className="tag bg-violet-50 text-violet-600 border-violet-200 text-xs">全文可见</span>}
            {showTemplate && !evidenceUnlocked && <span className="tag bg-blue-50 text-blue-600 border-blue-200 text-xs">规范可见</span>}
            {!evidencePaid && !templatePaid && <span className="tag bg-slate-100 text-slate-400 border-slate-200 text-xs">已锁定</span>}
          </div>
          <div className="flex-1 p-5 overflow-y-auto">
            {evidenceUnlocked ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-violet-700 bg-violet-50 rounded-lg px-4 py-2.5 border border-violet-200">
                  <CheckCircle className="w-4 h-4" /> 原始材料（全文）
                  <button onClick={onEvidence} className="ml-auto text-violet-500 hover:text-violet-700 underline font-medium">收起</button>
                </div>
                <pre className="text-[15px] text-slate-600 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-lg p-4 border border-slate-200">
                  {q.evidencePackage || '（暂无详细材料）'}
                </pre>
              </div>
            ) : showTemplate ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-4 py-2.5 border border-blue-200">
                  <CheckCircle className="w-4 h-4" /> 工作规范
                  <button onClick={onShowTemplate} className="ml-auto text-blue-500 hover:text-blue-700 underline font-medium">收起</button>
                </div>
                {template ? (
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-200 text-sm font-medium text-blue-800">{template.title}</div>
                    <pre className="text-[14px] text-slate-600 whitespace-pre-wrap font-sans leading-relaxed p-4 bg-white">{template.content}</pre>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-8">（该题型暂无工作规范）</p>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center"><FileText className="w-7 h-7 text-slate-300" /></div>
                <div>
                  <p className="text-base font-medium text-slate-600">参考信息已锁定</p>
                  <p className="text-sm text-slate-400 mt-1">消耗精力解锁材料包或工作规范</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 二次确认弹窗 */}
      <PilotConfirmModal
        open={!!pendingAction}
        cost={pendingAction?.cost || 0}
        energy={energyPoints}
        label={pendingAction?.type === 'evidence' ? '解锁材料包' : pendingAction?.type === 'template' ? '查看工作规范' : '微调 Prompt'}
        onConfirm={confirmPay}
        onCancel={cancelPay}
      />
    </div>
  );
}

function EnergyBar({ points, maxPoints = 20 }) {
  const pct = Math.round((points / maxPoints) * 100);
  const low = points <= 5;
  const crit = points <= 2;
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-mono font-bold tabular-nums ${crit ? 'text-red-500' : low ? 'text-amber-600' : 'text-slate-700'}`}>{points}</span>
      <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${crit ? 'bg-red-400' : low ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, desc, cost, active, disabled, onClick, color }) {
  const styles = {
    violet: { a: 'bg-violet-600 border-violet-700 text-white shadow-lg shadow-violet-200', n: 'bg-white border-violet-400 text-violet-700 hover:bg-violet-50 hover:shadow-md', d: 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed' },
    blue: { a: 'bg-blue-600 border-blue-700 text-white shadow-lg shadow-blue-200', n: 'bg-white border-blue-400 text-blue-700 hover:bg-blue-50 hover:shadow-md', d: 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed' },
    amber: { a: 'bg-amber-600 border-amber-700 text-white shadow-lg shadow-amber-200', n: 'bg-white border-amber-400 text-amber-700 hover:bg-amber-50 hover:shadow-md', d: 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed' },
    emerald: { a: 'bg-emerald-600 border-emerald-700 text-white shadow-lg shadow-emerald-200', n: 'bg-white border-emerald-400 text-emerald-700 hover:bg-emerald-50 hover:shadow-md', d: '' },
  };
  const s = disabled ? styles[color].d : active ? styles[color].a : styles[color].n;
  return (
    <button onClick={onClick} disabled={disabled}
      className={`relative flex flex-col items-center justify-center px-2 py-3 rounded-xl border-2 text-sm font-bold transition-all w-full min-w-0 h-[4.25rem] ${s}`}>
      <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
        {icon}
        <span className="text-[15px] leading-tight truncate min-w-0">{label}</span>
      </div>
      <span className="text-[11px] opacity-80 truncate w-full text-center">{desc}</span>
      {cost > 0 && (
        <span className={`absolute -top-2 -right-1.5 text-xs font-bold px-2 py-0.5 rounded-full border-2 bg-white shadow-sm ${disabled ? 'text-slate-300 border-slate-200' : 'text-slate-700 border-slate-300'}`}>{cost}</span>
      )}
    </button>
  );
}
