import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, Award, RotateCcw } from 'lucide-react';
import { usePilotState, usePilotActions } from '../pilotStore';
import { uploadResults } from '../pilotUpload';

/**
 * 预实验完成页：极简感恩页面。
 * 完全屏蔽分数明细、三大维度、画像评语（防泄题/心态波动）。
 * 进入时后台静默上传数据（失败自动重试 + localStorage 暂存补传，被试无感），
 * 界面无任何报错提示，也不触发任何浏览器下载。
 */
export default function PilotCompletionPage() {
  const state = usePilotState();
  const { reset } = usePilotActions();
  const { results, subject } = state;
  const uploaded = useRef(false);
  const [status, setStatus] = useState('uploading'); // uploading | done

  useEffect(() => {
    if (!results || uploaded.current) return;
    uploaded.current = true;

    // 本地留底（备份，不展示）
    try { localStorage.setItem('trustline_pilot_final', JSON.stringify(results)); } catch (e) {}

    // 云端静默上传（内部含重试 + localStorage 暂存补传），完成后仅切换图标状态，不显示失败信息
    uploadResults(results).then(() => {
      setStatus('done');
    }).catch(() => {
      setStatus('done');
    });
  }, [results]);

  if (!results) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="text-center text-slate-400">
          <p className="text-base">数据加载中...</p>
          <button onClick={reset} className="mt-2 text-sm text-blue-500 hover:text-blue-700 underline">返回首页</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-violet-50 to-white flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="panel p-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-50 rounded-full mb-6 mx-auto">
            {status === 'done' ? (
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            ) : (
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            )}
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-3">🎉 答卷已安全提交！</h1>
          <p className="text-base text-slate-600 leading-relaxed mb-8">
            非常感谢您参与本次人机协同办公测评研究。
            <br />
            您的作答数据已加密上传用于学术分析。
          </p>

          {/* 装饰性参与徽章（不含任何诊断细节） */}
          <div className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-sm font-medium mb-8">
            <Award className="w-5 h-5" />
            参与完成
          </div>

          <div className="border-t border-slate-100 pt-5 text-xs text-slate-400 space-y-1">
            <p>被试编号：{results.subjectId || subject.id || '-'}</p>
            <p>感谢您的贡献，祝您生活愉快。</p>
          </div>
        </div>
      </div>

      {/* 工作人员专用：再次测试（低调，被试不易察觉） */}
      <button
        onClick={() => {
          if (window.confirm('确认重置并重新开始？本机已记录的数据不受影响。')) reset();
        }}
        className="absolute bottom-3 left-3 opacity-15 hover:opacity-60 transition-opacity p-1"
        title="重新测试（工作人员专用）"
        aria-label="重新测试"
      >
        <RotateCcw className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}
