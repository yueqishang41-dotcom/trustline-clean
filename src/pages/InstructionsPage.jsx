import React from 'react';
import { Zap, Clock, ArrowRight, FileText, RefreshCw, Edit3, Send, BookOpen, Eye } from 'lucide-react';
import { useTestActions } from '../store/testStore';
import { requestKioskFullscreen } from '../utils/kiosk';

export default function InstructionsPage() {
  const { startTest } = useTestActions();

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl animate-fadeIn space-y-6">
        {/* Title - workplace briefing */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-2xl mb-4">
            <span className="text-2xl font-bold text-blue-600">AI</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">办公协作平台 · 入职指引</h1>
          <p className="text-base text-slate-500">请熟悉以下工作流程后开始您的任务</p>
        </div>

        {/* Two modules - presented as work phases */}
        <div className="panel overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              工作流程概览
              <span className="ml-auto text-sm font-normal text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />模块 A 约 15 分钟 · 模块 B 约 10 分钟
              </span>
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
                您将收到 AI 助理生成的初稿，需结合原始材料进行审阅、
                核查关键信息并修订，最终提交合格的交付版本。共 <strong>6</strong> 项任务，<strong>建议用时约 15 分钟</strong>。
              </p>
              <ul className="space-y-1.5 text-sm text-slate-500">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>涵盖数据分析、制度合规、对外沟通等日常场景</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>部分操作需消耗工作精力，请合理分配</span>
                </li>
              </ul>
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
                您将面对一系列日常工作情境及 AI 助理的回应，
                请从选项中选出您认为最合适的处理方式。共 <strong>10</strong> 道题，<strong>建议用时约 10 分钟</strong>。
              </p>
              <ul className="space-y-1.5 text-sm text-slate-500">
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5">•</span>
                  <span>快速判断，依据您的工作经验作答</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5">•</span>
                  <span>完成第一阶段后自动进入</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
            注：全场统一倒计时 25 分钟，两模块用时为建议分配，请合理掌握节奏。
          </div>
        </div>

        {/* Feature demo */}
        <div className="panel overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-slate-500" />
              功能演示 · 先看这里
              <span className="ml-auto text-xs font-normal text-slate-400">实际作答中，以下内容需消耗精力才能查看</span>
            </h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-600 mb-4">
              工作时，AI 助理会先给出一份初稿。您可消耗精力查看两类辅助信息来核查它：
            </p>
            <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 mb-4">
              <p className="text-xs text-slate-400 mb-1">AI 初稿（示例）</p>
              <p className="text-sm text-slate-600">“Q2 整体转化率稳步上升，6 月达到季度峰值，建议继续加大投放。”</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-violet-50 rounded-xl border-2 border-violet-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-violet-600" />
                  <span className="font-medium text-violet-900 text-sm">查阅原始材料 · 3 点</span>
                </div>
                <p className="text-xs text-violet-600 mb-1">点击后显示 AI 初稿所依据的材料全文：</p>
                <div className="bg-white/70 rounded-lg border border-violet-100 p-2.5 text-xs text-slate-600 leading-relaxed">
                  【数据库记录】<br/>4月转化率：3.5%　5月转化率：3.2%　6月转化率：2.8%<br/>（备注：6月促销结束后，大促后用户疲劳导致转化率明显下滑）
                </div>
              </div>
              <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-900 text-sm">查看工作规范 · 2 点</span>
                </div>
                <p className="text-xs text-blue-600 mb-1">点击后显示本类任务的交付规范要求：</p>
                <div className="bg-white/70 rounded-lg border border-blue-100 p-2.5 text-xs text-slate-600 leading-relaxed">
                  【数据简报撰写规范】<br/>1. 趋势描述必须严格依据数据，不得颠倒方向<br/>2. 结论应与数据一致，不得凭空建议“加大投放”
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">对照可见：材料显示转化率逐月下滑，而 AI 初稿却称“稳步上升”——这正是需要您核查修正的地方。</p>
          </div>
        </div>

        {/* Energy rules */}
        <div className="panel overflow-hidden border-2 border-amber-200">
          <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-200">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              工作精力说明
            </h2>
          </div>
          <div className="p-6">
            <p className="text-base text-slate-600 mb-4">
              您在文书审阅阶段共有 <strong className="text-amber-600 text-lg">20 点工作精力</strong>，
              全场共享，用完后<strong className="text-slate-800">不可补充</strong>。
              <br />
              精力点数<strong className="text-slate-800">仅在模块 A 使用</strong>，模块 B 不消耗精力，
              请按需分配，无需为后续环节预留。以下操作会消耗不同精力：
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-violet-50 rounded-xl border-2 border-violet-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-violet-600" />
                  <span className="font-medium text-violet-900 text-sm">查阅原始材料</span>
                </div>
                <p className="text-sm text-violet-600 mb-1">获取原始材料全文（含制度条款等完整上下文）</p>
                <span className="inline-flex items-center px-3 py-1 rounded-md bg-violet-200 text-violet-800 text-sm font-bold">消耗 3 点</span>
              </div>
              <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-900 text-sm">查看工作规范</span>
                </div>
                <p className="text-sm text-blue-600 mb-1">查看本类任务的交付规范要求</p>
                <span className="inline-flex items-center px-3 py-1 rounded-md bg-blue-200 text-blue-800 text-sm font-bold">消耗 2 点</span>
              </div>
              <div className="bg-amber-50 rounded-xl border-2 border-amber-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Edit3 className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-amber-900 text-sm">追问 AI 调整</span>
                </div>
                <p className="text-sm text-amber-600 mb-1">输入新要求，让 AI 重新生成</p>
                <span className="inline-flex items-center px-3 py-1 rounded-md bg-amber-200 text-amber-800 text-sm font-bold">消耗 1 点</span>
              </div>
              <div className="bg-emerald-50 rounded-xl border-2 border-emerald-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Send className="w-4 h-4 text-emerald-600" />
                  <span className="font-medium text-emerald-900 text-sm">编辑 / 提交</span>
                </div>
                <p className="text-sm text-emerald-600 mb-1">直接手动修改文本并提交成果</p>
                <span className="inline-flex items-center px-3 py-1 rounded-md bg-emerald-200 text-emerald-800 text-sm font-bold">消耗 0 点</span>
              </div>
            </div>
            <div className="mt-4 bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
              <strong className="text-slate-800">注意：</strong>精力耗尽后您仍可编辑和提交，但无法再查阅新材料。
              请在关键环节合理分配精力。
            </div>
          </div>
        </div>

        {/* Start */}
        <div className="panel p-6">
          <button
            onClick={() => {
              requestKioskFullscreen(); // 机考模式：进入测验即请求全屏（需用户手势）
              startTest();
            }}
            className="btn-primary w-full text-base py-3"
          >
            开始工作 <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
