import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { usePilotState, usePilotActions } from '../pilotStore';

export default function PilotSubjectInfoPage() {
  const { subject, formLabel } = usePilotState();
  const { setSubject, setPhase } = usePilotActions();
  const [form, setForm] = useState({ id: subject.id || '', name: subject.name || '', role: subject.role || '' });
  const [errors, setErrors] = useState({});

  const chg = (f, v) => { setForm(p => ({ ...p, [f]: v })); if (errors[f]) setErrors(p => ({ ...p, [f]: '' })); };

  const submit = () => {
    const e = {};
    if (!form.id.trim()) e.id = '请输入被试编号';
    if (!form.name.trim()) e.name = '请输入姓名';
    if (!form.role.trim()) e.role = '请输入岗位或专业';
    setErrors(e);
    if (Object.keys(e).length === 0) { setSubject(form); setPhase('instructions'); }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="panel p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-50 rounded-2xl mb-5">
              <span className="text-2xl font-bold text-violet-600">🧪</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">人机协同监督校准测验</h1>
            <p className="text-base text-slate-500">预实验 · 被试信息登记</p>
            <span className="inline-flex items-center px-3 py-1 rounded-md bg-slate-100 text-slate-500 text-xs font-medium mt-3">
              当前试卷：{formLabel}
            </span>
          </div>

          <div className="space-y-5">
            <div>
              <label className="lbl">被试编号 <span className="text-red-400">*</span></label>
              <input type="text" value={form.id} onChange={e => chg('id', e.target.value)}
                placeholder="如：S001" className={`ipt text-base ${errors.id ? 'border-red-300 bg-red-50' : ''}`} />
              {errors.id && <p className="text-sm text-red-400 mt-1">{errors.id}</p>}
            </div>
            <div>
              <label className="lbl">姓名 <span className="text-red-400">*</span></label>
              <input type="text" value={form.name} onChange={e => chg('name', e.target.value)}
                placeholder="请输入姓名" className={`ipt text-base ${errors.name ? 'border-red-300 bg-red-50' : ''}`} />
              {errors.name && <p className="text-sm text-red-400 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="lbl">岗位 / 专业 <span className="text-red-400">*</span></label>
              <input type="text" value={form.role} onChange={e => chg('role', e.target.value)}
                placeholder="如：心理学、人力资源管理" className={`ipt text-base ${errors.role ? 'border-red-300 bg-red-50' : ''}`} />
              {errors.role && <p className="text-sm text-red-400 mt-1">{errors.role}</p>}
            </div>
          </div>

          <button onClick={submit} className="btn-primary w-full mt-7 text-base py-3">
            下一步 <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
