import React, { useEffect, useRef, useState } from 'react';
import { Clock, Zap, CheckCircle, UploadCloud, RefreshCw, AlertCircle } from 'lucide-react';
import { useTestState, useTestActions } from '../store/testStore';
import { uploadResults, flushPendingUploads } from '../utils/upload';

export default function CompletionPage() {
  const state = useTestState();
  const { reset } = useTestActions();
  const { results, behavioralLogs } = state;
  const uploadedOnce = useRef(false);
  const uploadInFlight = useRef(false); // 同一结果并发只发一次，避免导出出现重复记录
  const uploadStateRef = useRef('idle');
  const [uploadState, setUploadState] = useState('idle'); // idle | submitting | submitted | pending
  const [uploadErr, setUploadErr] = useState('');
  const [showLeaveWarn, setShowLeaveWarn] = useState(false); // 返回首页前未上传成功的确认弹窗
  const [leaveMsg, setLeaveMsg] = useState('');
  const [retrying, setRetrying] = useState(false);

  // 同步最新 uploadState，供异步回调读取
  const setStateSafe = (s) => {
    uploadStateRef.current = s;
    setUploadState(s);
  };

  // 唯一上传通道：同一结果同时只 POST 一次（每次 POST 都会新建一条 Blob）
  const doUpload = async (rs) => {
    if (uploadInFlight.current) return null; // 已在传，不重复发
    uploadInFlight.current = true;
    setStateSafe('submitting');
    try {
      const r = await uploadResults(rs);
      setStateSafe(r.ok ? 'submitted' : 'pending');
      if (!r.ok) setUploadErr(r.reason || '');
      return r;
    } catch (e) {
      setStateSafe('pending');
      setUploadErr((e && e.message) || '');
      return { ok: false, reason: (e && e.message) || 'unknown' };
    } finally {
      uploadInFlight.current = false;
    }
  };

  // 提交结果 + 补传历史暂存（只触发一次）
  useEffect(() => {
    if (!results || uploadedOnce.current) return;
    uploadedOnce.current = true;

    // 1) 本地备份（防上传彻底失败时的兜底）
    try {
      localStorage.setItem('aisupervision_final', JSON.stringify(results));
    } catch (e) {}

    // 2) 补传此前失败暂存的数据（静默）
    flushPendingUploads().catch(() => {});

    // 3) 上传本次结果（自动重试 3 次，失败自动暂存，下次打开补传）
    doUpload(results);
  }, [results]);

  // 手动重试
  const retryUpload = () => doUpload(results);

  // 返回首页：数据确认已上传才直接返回；否则先抢救（补传队列+重传本次），仍失败则弹窗让主试决定
  const handleGoHome = async () => {
    if (uploadStateRef.current === 'submitted') { reset(); return; }
    setRetrying(true);
    try {
      await flushPendingUploads();
      const r = await doUpload(results);
      if (r && r.ok) { reset(); return; }
      // r===null → 正在上传中；否则上传失败
      setLeaveMsg(r === null
        ? '数据仍在自动上传中，请稍候片刻再返回；也可以直接返回（数据已在本机备份，之后打开页面会自动补传，不会丢失）。'
        : (uploadErr ? `上传未成功：${uploadErr}。数据已在本机备份，之后打开页面会自动补传，不会丢失。` : '上传未成功。数据已在本机备份，之后打开页面会自动补传，不会丢失。'));
      setShowLeaveWarn(true);
    } finally {
      setRetrying(false);
    }
  };

  // 弹窗内重试：正在传时先不重复发
  const handleModalRetry = async () => {
    if (uploadInFlight.current) return;
    const r = await doUpload(results);
    if (r && r.ok) setShowLeaveWarn(false);
  };

  if (!results) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center text-slate-400">
          <p className="text-base">数据加载中...</p>
          <button onClick={reset} className="mt-2 text-sm text-blue-500 hover:text-blue-700 underline">返回首页</button>
        </div>
      </div>
    );
  }

  const uploadBadge = {
    submitted: {
      icon: <CheckCircle className="w-4 h-4" />,
      text: '数据已成功提交',
      cls: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    },
    pending: {
      icon: <AlertCircle className="w-4 h-4" />,
      text: '网络异常，数据已本地暂存，将自动重试',
      cls: 'bg-amber-50 text-amber-600 border-amber-200',
    },
    submitting: {
      icon: <UploadCloud className="w-4 h-4 animate-pulse" />,
      text: '正在提交数据...',
      cls: 'bg-blue-50 text-blue-600 border-blue-200',
    },
    idle: {
      icon: <UploadCloud className="w-4 h-4" />,
      text: '正在准备提交数据...',
      cls: 'bg-slate-50 text-slate-500 border-slate-200',
    },
  }[uploadState];

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg animate-fadeIn">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-50 rounded-2xl mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">任务完成</h1>
          <p className="text-base text-slate-500">感谢您的参与，所有作答数据已自动提交保存。</p>
        </div>

        {/* Info card */}
        <div className="panel p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[['编号', results.subjectId || '-'], ['姓名', results.name || '-'], ['岗位/专业', results.role || '-']].map(([l, v]) => (
              <div key={l} className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                <p className="text-xs text-slate-400 mb-1">{l}</p>
                <p className="text-[15px] font-semibold text-slate-800 truncate">{v}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-xs text-slate-400">总用时</p>
                <p className="text-[15px] font-semibold text-slate-800">
                  {results.timeUsedSec ? `${Math.floor(results.timeUsedSec / 60)} 分 ${results.timeUsedSec % 60} 秒` : '-'}
                </p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-3">
              <Zap className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-xs text-slate-400">剩余精力</p>
                <p className="text-[15px] font-semibold text-slate-800">{results.energyRemaining || 0} / 20</p>
              </div>
            </div>
          </div>

          {/* 上传状态 */}
          <div className={`flex flex-col items-center gap-1 text-sm rounded-xl px-4 py-3 border ${uploadBadge.cls}`}>
            <div className="flex items-center gap-2">
              {uploadBadge.icon}
              <span>{uploadBadge.text}</span>
              {uploadState === 'pending' && (
                <button onClick={retryUpload} className="ml-1 underline font-medium text-amber-700 hover:text-amber-900">立即重试</button>
              )}
            </div>
            {uploadState === 'pending' && uploadErr && (
              <p className="text-xs opacity-80 max-w-full break-all">失败原因：{uploadErr}</p>
            )}
          </div>

          <div className="text-sm text-slate-400 space-y-1 pt-3 border-t border-slate-100">
            <p>开始：{results.startTime ? new Date(results.startTime).toLocaleString('zh-CN') : '-'}</p>
            <p>完成：{results.endTime ? new Date(results.endTime).toLocaleString('zh-CN') : '-'}</p>
            <p>行为记录：{behavioralLogs?.length || 0} 条（含切屏、粘贴、微调等全部操作）</p>
          </div>
        </div>

        <div className="text-center mt-5">
          <button
            onClick={handleGoHome}
            disabled={retrying}
            className="btn-secondary text-sm py-2.5 px-5"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? '正在重新提交数据…' : '返回首页'}
          </button>
        </div>
      </div>

      {/* 未确认上传成功时的返回确认弹窗（防主试误操作丢数据） */}
      {showLeaveWarn && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">数据尚未确认上传成功</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{leaveMsg}</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleModalRetry}
                disabled={uploadState === 'submitting'}
                className="btn-primary flex-1"
              >
                重试上传
              </button>
              <button onClick={reset} className="btn-secondary flex-1">
                仍然返回
              </button>
            </div>
            <p className="text-xs text-slate-400">「仍然返回」不会删除本机备份，下次打开页面仍会自动补传。</p>
          </div>
        </div>
      )}
    </div>
  );
}
