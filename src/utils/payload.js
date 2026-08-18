/**
 * 正式版导出数据结构（与 pilot 的 pilotExport.js 对齐）。
 * 生成符合规范的 CSV 与完整 JSON Payload（供云端上传 / 备份）。
 * 数据只进不收：被试浏览器不下载任何文件。
 */
import { runFullScoring, calculateModuleAScore, calculateModuleBScore } from './scoringEngine.js';

const BOM = '﻿';

function safe(s) {
  if (s === undefined || s === null) return '';
  return String(s);
}

/** 从 results 重建完整评分结果（复用评分引擎，保持与完成页一致） */
export function computeScores(results) {
  const a = calculateModuleAScore(results.moduleAQuestionsInfo || [], results.moduleAResponses || {});
  const b = calculateModuleBScore(results.moduleBQuestionsInfo || [], results.moduleBResponses || {});
  const full = runFullScoring(
    results.moduleAQuestionsInfo || [],
    results.moduleAResponses || {},
    results.moduleBQuestionsInfo || [],
    results.moduleBResponses || {},
    results.energyRemaining ?? 20
  );
  return { a, b, full };
}

export function buildCSV(results) {
  const { full } = computeScores(results);
  const dims = full.dimensions || {};

  const header = [
    'Subject_ID', 'Name', 'Role', 'Start_Time', 'Time_Used_Sec',
    'Form_Type',
    'Page_Blur_Count', 'Bulk_Paste_Count',
    'Score_A_Raw', 'Score_B_Raw', 'RES_Score', 'Total_Score',
    'Dim_Calibrated_Reliance', 'Dim_Verification_Supervision', 'Dim_Compliance_Boundary',
    'Behavioral_Logs_JSON',
  ];

  const logs = results.behavioralLogs || [];
  const row = [
    safe(results.subjectId), safe(results.name), safe(results.role),
    safe(results.startTime), safe(results.timeUsedSec),
    safe(results.formLabel || ('Form_' + (results.formType || 'F'))),
    safe(results.pageBlurCount || 0), safe(results.bulkPasteCount || 0),
    safe(full.scoreA), safe(full.scoreB), safe(full.resScore), safe(full.totalScore),
    safe(dims.calibratedReliance?.total ?? ''), safe(dims.verificationSupervision?.total ?? ''),
    safe(dims.complianceBoundary?.total ?? ''),
    '"' + (logs.map((l) => `${l.action}:${(l.detail || '').substring(0, 40)}`).join('; ')).replace(/"/g, '""') + '"',
  ];

  return BOM + header.join(',') + '\n' + row.join(',');
}

/**
 * 构建完整 JSON Payload（用于云端上传）。
 * 包含：被试信息、试卷类型、各模块得分明细、三大维度分、全量行为日志、
 * 切屏/粘贴计数、CSV 格式文本。
 */
export function buildPayload(results) {
  const { full } = computeScores(results);
  return {
    subjectId: results.subjectId,
    name: results.name,
    role: results.role,
    startTime: results.startTime,
    endTime: results.endTime,
    timeUsedSec: results.timeUsedSec,
    formType: results.formType || 'F',
    formLabel: results.formLabel || '正式卷',
    pageBlurCount: results.pageBlurCount || 0,
    bulkPasteCount: results.bulkPasteCount || 0,
    scores: {
      scoreA: full.scoreA,
      scoreB: full.scoreB,
      resScore: full.resScore,
      totalScore: full.totalScore,
      energyRemaining: results.energyRemaining,
      dimensions: {
        calibratedReliance: full.dimensions?.calibratedReliance?.total ?? 0,
        verificationSupervision: full.dimensions?.verificationSupervision?.total ?? 0,
        complianceBoundary: full.dimensions?.complianceBoundary?.total ?? 0,
      },
      aQuestionScores: full.aQuestionScores,
      bQuestionScores: full.bQuestionScores,
    },
    moduleA: {
      questionsInfo: results.moduleAQuestionsInfo,
      responses: results.moduleAResponses,
    },
    moduleB: {
      questionsInfo: results.moduleBQuestionsInfo,
      responses: results.moduleBResponses,
    },
    behavioralLogs: results.behavioralLogs || [],
    behavioralLogsJson: JSON.stringify(results.behavioralLogs || []),
    csvText: buildCSV(results),
  };
}
