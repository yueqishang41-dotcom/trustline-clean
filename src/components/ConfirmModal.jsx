import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * 轻量级精力扣除二次确认弹窗。
 * 使用方式：
 *   <ConfirmModal
 *     open={bool}
 *     cost={3} energy={20}
 *     label="解锁材料包"
 *     onConfirm={...} onCancel={...} />
 */
export default function ConfirmModal({ open, cost, energy, label, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">确认消耗精力</h3>
            <p className="text-sm text-slate-500 mt-1">
              确定消耗 <strong className="text-amber-600">{cost} 点精力</strong> 解锁该信息吗？
              <br />
              <span className="text-slate-400">（当前剩余精力：{energy} 点）</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
