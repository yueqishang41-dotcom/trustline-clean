import React, { useState, useEffect, useRef } from 'react';
import { FileText, Clock, RotateCw, Send, Lock, CheckCircle, Info, Search, BookOpen, RefreshCw } from 'lucide-react';
import { useTestState, useTestActions } from '../store/testStore';
import EnergyBar from '../components/EnergyBar';
import ConfirmModal from '../components/ConfirmModal';

function clean(s) {
  if (!s) return '';
  return s.replace(/^\[AI[^\]]*\]\s*/g, '').trim();
}

function parsePrompt(p) {
  if (!p) return null;
  const items = [];
  const rules = [
    { re: /\[角色\]([^|]+)/, label: '角色' },
    { re: /\[字数\]([^|]+)/, label: '字数' },
    { re: /\[生成内容\]([^|]+)/, label: '内容' },
    { re: /\[要求\]([^|]+)/, label: '要求' },
  ];
  for (const { re, label } of rules) {
    const m = p.match(re);
    if (m) items.push({ label, value: m[1].trim() });
  }
  return items.length ? items : null;
}

/**
 * Get per-question guidelines from the item bank data.
 * Each question has its own specific rules/standards to follow.
 */
function getQuestionGuidelines(q) {
  const guidelines = q.guidelines || '';
  const sceneLabels = { data: '数据分析', compliance: '制度合规', communication: '对外沟通' };
  const sceneLabel = sceneLabels[q.sceneType] || q.sceneType || '通用';

  if (guidelines) {
    return { title: `工作规范 · ${sceneLabel}`, content: guidelines };
  }
  return null;
}

export default function ModuleAPage() {
  const state = useTestState();
  const a = useTestActions();
  const { moduleAQuestions, moduleACurrentIndex, moduleAResponses, energyPoints, evidenceUnlocked, startTime } = state;

  const [text, setText] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [cd, setCd] = useState(1500);
  const [pendingAction, setPendingAction] = useState(null); // { type: 'evidence' | 'template' | 'regenerate', cost } 二次确认
  const [aiLoading, setAiLoading] = useState(false); // 微调生成中
  const [aiError, setAiError] = useState(null);      // 微调失败提示（保留 promptInput 供重试）

  const q = moduleAQuestions && moduleAQuestions[moduleACurrentIndex];

  // Track per-question payment status (consume energy once per question)
  const paidForRef = useRef({}); // { [questionId]: { template: bool, evidence: bool } }
  // Track per-question start time for elapsed-time measurement
  const questionStartRef = useRef(Date.now());

  useEffect(() => {
    if (!q) return;
    const orig = clean(q.aiDraft || '');
    setText(moduleAResponses[q.id]?.editedText || orig);
    setShowPrompt(false);
    setPromptInput('');
    setShowTemplate(false);
    // Init payment tracking for this question if not exists
    if (!paidForRef.current[q.id]) {
      paidForRef.current[q.id] = { template: false, evidence: false, regenerate: false };
    }
    // Record start time when entering a new question
    questionStartRef.current = Date.now();
  }, [moduleACurrentIndex, q?.id]);

  // 自动保存：当前题编辑内容防抖写入 store（防刷新/误关丢失编辑）
  useEffect(() => {
    if (!q) return;
    const origDraft = clean(q.aiDraft || '');
    const t = setTimeout(() => {
      if (text && text !== origDraft) {
        a.updateModuleAResponse(q.id, { editedText: text });
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [text, q?.id]);

  useEffect(() => {
    if (!startTime) return;
    const tick = () => setCd(Math.max(0, 1500 - Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  // Show loading if no question
  if (!q || !moduleAQuestions || !moduleAQuestions.length) {
    return (
      <div className="h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-lg text-slate-500">正在加载题目...</p>
      </div>
    );
  }

  const orig = clean(q.aiDraft || '');
  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const pp = parsePrompt(q.aiSystemPrompt);
  // Auto-generate AI prompt display from background info
  const autoPrompt = pp || (() => {
    const items = [];
    const bg = q.background || '';
    const mRole = bg.match(/^(?:你是|你是一名?|你作为)([^。，]+)/);
    if (mRole) items.push({ label: '角色', value: mRole[1].trim() });
    const mReq = bg.match(/要求[：:]([^。]*(?:。|$))/);
    if (mReq) items.push({ label: '要求', value: mReq[1].trim() });
    const sceneType = q.sceneType || '';
    const sceneLabels = { data: '数据分析', compliance: '制度合规', communication: '对外沟通' };
    const sceneLabel = sceneLabels[sceneType] || sceneType;
    if (sceneLabel) items.push({ label: '场景', value: sceneLabel });
    return items.length ? items : null;
  })();

  const sceneBadge = (() => {
    const t = q.sceneType || '';
    if (t === 'data') return { label: '数据分析', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
    if (t === 'compliance') return { label: '制度合规', cls: 'bg-violet-50 text-violet-700 border-violet-200' };
    if (t === 'communication') return { label: '对外沟通', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    return { label: t || '通用', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  })();

  const template = getQuestionGuidelines(q);

  // --- Payment logic: energy consumed ONCE per question（消耗前二次确认，防误触） ---
  // 已付费判定同时参考行为日志：paidForRef 在页面重挂载（如刷新）后会丢失，
  // 而消耗精力会写日志（含 questionId），两者取并集可防止重挂载后重复扣费/漏记。
  const hasLog = (action) => (state.behavioralLogs || []).some(
    (l) => l.action === action && (l.questionId === q.id || l.meta?.questionId === q.id)
  );

  const onEvidence = () => {
    if (evidenceUnlocked) { a.setEvidenceUnlocked(false); return; }
    if (paidForRef.current[q.id]?.evidence || hasLog('view_evidence')) { a.setEvidenceUnlocked(true); paidForRef.current[q.id].evidence = true; return; } // 已付费，免费重开
    if (energyPoints >= 3) setPendingAction({ type: 'evidence', cost: 3 }); // 首次：二次确认
  };

  const onShowTemplate = () => {
    if (showTemplate) { setShowTemplate(false); return; }
    if (paidForRef.current[q.id]?.template || hasLog('view_template')) { setShowTemplate(true); paidForRef.current[q.id].template = true; return; } // 已付费，免费重开
    if (energyPoints >= 2) setPendingAction({ type: 'template', cost: 2 }); // 首次：二次确认
  };

  const onRegen = () => {
    if (showPrompt) { setShowPrompt(false); return; }
    if (paidForRef.current[q.id]?.regenerate || hasLog('regenerate_prompt')) { setShowPrompt(true); paidForRef.current[q.id].regenerate = true; return; } // 已付费，免费重开
    if (energyPoints >= 1) setPendingAction({ type: 'regenerate', cost: 1 }); // 首次：二次确认
  };

  // 二次确认弹窗确认/取消
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

  // 防作弊监控：异常大段粘贴（>100 字符）自动记录
  const onPaste = (e) => {
    const pasted = (e.clipboardData && e.clipboardData.getData('text')) || '';
    if (pasted.length > 100) a.addBulkPaste(pasted.length);
  };

  const onSubmit = () => {
    a.updateModuleAResponse(q.id, {
      editedText: text,
      timeUsed: Math.round((Date.now() - questionStartRef.current) / 1000),
      actionsUsed: {
        // 与 paidForRef 取并集：防止重挂载（刷新）后漏记已使用过的行为
        viewEvidence: paidForRef.current[q.id]?.evidence || hasLog('view_evidence'),
        viewTemplate: paidForRef.current[q.id]?.template || hasLog('view_template'),
        regenerate: paidForRef.current[q.id]?.regenerate || hasLog('regenerate_prompt'), // 是否使用过"微调 Prompt"（以扣费记录/日志为准）
        editPerformed: text !== orig,
      },
      finalText: text,
    });
    a.goToNextModuleA();
  };

  const applyPrompt = async () => {
    if (!promptInput.trim() || aiLoading) return;

    // 微调请求：严格基于当前文本框内容（含已手动编辑部分）修改
    // 仅当「本题已付费解锁工作规范」且「提示语明确提到'规范'」同时满足时，
    // 才将本题工作规范携带给 AI 作为修改依据；否则只按提示语修改，不透露规范内容。
    const currentText = text.trim();
    const guideline = (q.guidelines || '').trim();
    const unlockedGuideline = paidForRef.current[q.id]?.template === true || hasLog('view_template'); // 花过2点解锁本题规范（含刷新后日志兜底）
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

    // 调用 DeepSeek API 代理（走 /api/chat），最多 3 次重试、递增退避。
    // 高峰时段 DeepSeek 常快速返回 429/502/503/504，服务端(api/chat.mjs)已在上游重试一次，
    // 这里客户端再兜底 3 次，并保留 promptInput 供内联"重试"按钮使用（不再弹窗打断）。
    const retryable = [429, 500, 502, 503, 504];
    let res = null;
    setAiLoading(true);
    setAiError(null);
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: userContent }] }),
          });
        } catch (e) {
          // 网络层失败（含浏览器 fetch 超时）→ 退避后重试
          if (attempt < 3) { await new Promise((r) => setTimeout(r, 1200 * attempt)); continue; }
          setAiError('网络连接失败，请稍后重试，或直接手动编辑文本。');
          return;
        }
        if (res.ok) break;
        if (retryable.includes(res.status) && attempt < 3) {
          await new Promise((r) => setTimeout(r, 1200 * attempt));
          continue;
        }
        // 非可重试错误 → 直接结束
        setAiError(`AI 服务暂不可用（状态码 ${res.status}），请稍后重试或直接手动编辑文本。`);
        return;
      }

      if (res && res.ok) {
        const data = await res.json();
        setText(data.content);
        setShowPrompt(false);
        setPromptInput('');
        return;
      }

      // 3 次可重试都失败 → 内联提示，保留 promptInput，被试可点"重试"
      setAiError('AI 服务高峰期繁忙，请稍后点击"重试"，或直接手动编辑文本。');
    } finally {
      setAiLoading(false);
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
            <span className={`tag text-sm ${sceneBadge.cls} hidden sm:inline-flex`}>{sceneBadge.label}</span>
          </div>
        </div>
      </header>

      {/* Content grid */}
      <div className="flex-1 min-h-0 p-4 gap-4 grid grid-cols-1 xl:grid-cols-12 overflow-y-auto" style={{ height: 'calc(100vh - 3.25rem)' }}>
        {/* Left */}
        <div className="col-span-12 xl:col-span-3 panel flex flex-col overflow-hidden min-w-0 max-h-[45vh] xl:max-h-none">
          <div className="panel-hd"><Info className="w-4 h-4 text-blue-500" /><span className="text-sm font-semibold text-slate-700">任务背景</span></div>
          <div className="panel-bd flex-1 overflow-y-auto space-y-4">
            <p className="text-[15px] text-slate-600 leading-relaxed">{q.background || ''}</p>
            {autoPrompt && (
              <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs font-medium text-slate-500">交付给 AI 助理的指令</div>
                <div className="p-4 space-y-2">
                  {autoPrompt.map(({ label, value }) => (
                    <div key={label} className="flex gap-3 text-sm">
                      <span className="text-slate-400 font-medium shrink-0 w-10">{label}</span>
                      <span className="text-slate-600">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Middle */}
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
              <textarea value={text} onChange={e => setText(e.target.value)} onPaste={onPaste}
                className="w-full h-full min-w-0 min-h-[120px] xl:min-h-[200px] p-4 text-[15px] border border-slate-200 rounded-lg resize-y leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>

            {showPrompt && (
              <div className="bg-amber-50 rounded-lg px-4 py-2.5 border border-amber-200">
                <div className="flex items-center gap-2">
                  <input
                    type="text" value={promptInput} onChange={e => setPromptInput(e.target.value)}
                    placeholder="输入新约束条件，如：语气改为正式..."
                    disabled={aiLoading}
                    className="flex-1 px-3 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:bg-amber-100"
                    onKeyDown={e => { if (e.key === 'Enter' && !aiLoading) applyPrompt(); }}
                  />
                  <button onClick={applyPrompt} disabled={aiLoading}
                    className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium disabled:opacity-60">
                    {aiLoading ? '生成中...' : '应用'}
                  </button>
                </div>
                {aiError && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                    <span>{aiError}</span>
                    <button onClick={applyPrompt} className="underline font-medium text-amber-700 hover:text-amber-900">重试</button>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100">
              <ActionBtn icon={<BookOpen className="w-5 h-5" />} label="工作规范" desc="本类任务规范要求" cost={2}
                active={showTemplate} disabled={!templatePaid && energyPoints < 2} onClick={onShowTemplate} color="blue" />
              <ActionBtn icon={<FileText className="w-5 h-5" />} label="查阅原始材料" desc="全文：完整证据包" cost={3}
                active={evidenceUnlocked} disabled={!evidencePaid && energyPoints < 3} onClick={onEvidence} color="violet" />
              <ActionBtn icon={<RotateCw className="w-5 h-5" />} label="微调 Prompt" desc="输入新约束重生成" cost={1}
                active={showPrompt} disabled={!showPrompt && energyPoints < 1} onClick={onRegen} color="amber" />
              <ActionBtn icon={<Send className="w-5 h-5" />} label="提交本题" desc="进入下一题" cost={0}
                active={false} disabled={false} onClick={onSubmit} color="emerald" />
            </div>
          </div>
        </div>

        {/* Right: Evidence */}
        <div className="col-span-12 xl:col-span-4 panel flex flex-col overflow-hidden min-w-0 max-h-[45vh] xl:max-h-none">
          <div className="panel-hd flex items-center justify-between">
            <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-violet-500" /><span className="text-sm font-semibold text-slate-700">参考信息</span></div>
            {!evidencePaid && !templatePaid && <span className="tag bg-slate-100 text-slate-400 border-slate-200 text-xs">已锁定</span>}
            {showTemplate && !evidenceUnlocked && <span className="tag bg-blue-50 text-blue-600 border-blue-200 text-xs">规范可见</span>}
            {evidenceUnlocked && <span className="tag bg-violet-50 text-violet-600 border-violet-200 text-xs">全文可见</span>}
          </div>
          <div className="flex-1 p-5 overflow-y-auto">
            {evidenceUnlocked ? (
              /* Full evidence unlocked */
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
              /* Template shown */
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-4 py-2.5 border border-blue-200">
                  <CheckCircle className="w-4 h-4" /> 工作规范
                  <button onClick={onShowTemplate} className="ml-auto text-blue-500 hover:text-blue-700 underline font-medium">收起</button>
                </div>
                {template ? (
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-200 text-sm font-medium text-blue-800">
                      {template.title}
                    </div>
                    <pre className="text-[14px] text-slate-600 whitespace-pre-wrap font-sans leading-relaxed p-4 bg-white">
                      {template.content}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-8">（该题型暂无工作规范）</p>
                )}
              </div>
            ) : (
              /* Fully locked（操作统一在底部 action bar，这里不再重复放按钮） */
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center"><Lock className="w-7 h-7 text-slate-300" /></div>
                <div>
                  <p className="text-base font-medium text-slate-600">参考信息已锁定</p>
                  <p className="text-sm text-slate-400 mt-1">消耗精力解锁工作规范或原始材料</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 消耗精力二次确认弹窗 */}
      <ConfirmModal
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
