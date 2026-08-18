import React from 'react';
import { Clock } from 'lucide-react';

export default function PilotClosedPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center animate-fadeIn space-y-5">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-200 rounded-2xl mx-auto">
          <Clock className="w-8 h-8 text-slate-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">本次预实验已结束</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          感谢您的关注与参与。本次预实验的名额已满，报名通道已关闭，<br />
          请留意后续相关通知。
        </p>
      </div>
    </div>
  );
}
