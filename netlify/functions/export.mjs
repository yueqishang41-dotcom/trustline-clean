/**
 * 正式实验数据导出（Netlify Function）。
 *
 * 把 collect.mjs（store: formal-data）收集的全部数据聚合导出：
 *   - 默认 /  ?format=csv  → 宽表 CSV（每人一行，所有被试同一张大表格）
 *       含：核心对齐字段 + 模块A逐题得分 + 行为动作标志 + 参考答稿/AI初稿/被试最终文本
 *         + 模块B逐题 + 全量行为日志
 *   -      ?format=json   → 完整 JSON 数组（最高保真，供 R/Python/SPSS 深入分析）
 *
 * 访问示例（部署后，浏览器直接打开即下载）：
 *   https://你的站点.netlify.app/api/export               （CSV 宽表，含行为日志）
 *   https://你的站点.netlify.app/api/export?format=json   （完整 JSON）
 * 若设置了环境变量 FORMAL_EXPORT_TOKEN，访问需加 ?token=你的TOKEN（防止无关人员下载被试数据）。
 */
import { connectLambda, getStore } from '@netlify/blobs';

const STORE = 'formal-data';

export async function handler(event) {
  // v1 函数需手动接线 Netlify Blobs 环境上下文
  try { connectLambda(event); } catch (e) { /* 忽略 */ }

  try {
    // 鉴权：设置 FORMAL_EXPORT_TOKEN 后必须携带正确 token 才能下载
    const exportToken = process.env.FORMAL_EXPORT_TOKEN;
    const qp = event.queryStringParameters || {};
    const given = (qp.token || '').trim();
    if (exportToken && given !== exportToken) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'unauthorized' }) };
    }

    // 读取全部存储数据
    const store = getStore(STORE);
    const payloads = [];
    let cursor;
    do {
      const page = await store.list({ cursor });
      for (const blob of page.blobs || []) {
        try {
          const raw = await store.get(blob.key, { type: 'text' });
          payloads.push(JSON.parse(raw));
        } catch (e) { /* 跳过损坏项 */ }
      }
      cursor = page.cursor;
    } while (cursor);

    // 按开始时间排序
    payloads.sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));

    const fmt = (qp.format || 'csv').toLowerCase();
    if (fmt === 'json') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="formal-data.json"',
        },
        body: JSON.stringify(payloads, null, 2),
      };
    }

    const csv = buildWideCSV(payloads);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': 'attachment; filename="formal-data.csv"',
      },
      body: csv,
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String((err && err.message) || err) }) };
  }
}

/* ---------------- 宽表 CSV 构建（与 Vercel api/export.mjs 对齐，字段全量保留） ---------------- */

/** 自然排序：先按来源（dsh/hr/zxy）再按模块再按题号数字 */
const PREFIX_ORDER = { dsh: 0, hr: 1, zxy: 2 };
function idSortKey(id) {
  const m = String(id).match(/^(.*)-([A-Z])(\d+)$/);
  if (!m) return String(id);
  return `${PREFIX_ORDER[m[1]] ?? 9}-${m[2]}-${String(Number(m[3])).padStart(2, '0')}`;
}

function esc(v) {
  const s = v === undefined || v === null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function buildWideCSV(payloads) {
  const coreHeaders = [
    'Subject_ID', 'Name', 'Role', 'Start_Time', 'End_Time', 'Time_Used_Sec', 'Form_Type',
    'Page_Blur_Count', 'Bulk_Paste_Count',
    'Score_A_Raw', 'Score_B_Raw', 'RES_Score', 'Total_Score', 'Energy_Remaining',
    'Dim_Calibrated_Reliance', 'Dim_Verification_Supervision', 'Dim_Compliance_Boundary',
    'Behavioral_Logs_JSON',
  ];

  // 收集全部出现的逐题 ID（并集，含 A/B 两模块）
  const aIds = new Set();
  const bIds = new Set();
  for (const p of payloads) {
    for (const qs of (p.scores?.aQuestionScores || [])) if (qs.id) aIds.add(qs.id);
    for (const qs of (p.scores?.bQuestionScores || [])) if (qs.id) bIds.add(qs.id);
  }
  // 没有任何数据时也输出正式卷全量逐题列（保证结构始终可见，值留空）
  const FALLBACK_A = ['dsh-A1', 'dsh-A2', 'dsh-A3', 'dsh-A4', 'dsh-A5', 'dsh-A7'];
  const FALLBACK_B = [
    'zxy-B1', 'zxy-B2', 'zxy-B3', 'zxy-B4', 'zxy-B5',
    'zxy-B6', 'zxy-B7', 'zxy-B8', 'zxy-B9', 'zxy-B10',
  ];
  const aIdList = (aIds.size ? [...aIds] : FALLBACK_A).sort((x, y) => idSortKey(x).localeCompare(idSortKey(y)));
  const bIdList = (bIds.size ? [...bIds] : FALLBACK_B).sort((x, y) => idSortKey(x).localeCompare(idSortKey(y)));

  // 模块 A 每题：AI 得分(5) + 行为动作标志(4) + 参考答稿 / AI初稿 / 被试最终文本
  const aHeaders = [];
  for (const id of aIdList) {
    for (const h of ['total', 'correctness', 'evidence', 'compliance', 'resource']) aHeaders.push(`${id}__${h}`);
    for (const h of ['edit', 'act_evidence', 'act_template', 'act_regen']) aHeaders.push(`${id}__${h}`);
    aHeaders.push(`${id}__answer`, `${id}__draft`, `${id}__final_text`);
  }
  const bHeaders = [];
  for (const id of bIdList) bHeaders.push(`${id}__score`, `${id}__choice`, `${id}__dimension`);

  const header = [...coreHeaders, ...aHeaders, ...bHeaders];
  const rows = [];

  for (const p of payloads) {
    const s = p.scores || {};
    const d = s.dimensions || {};
    const aScoreMap = {};
    for (const qs of (s.aQuestionScores || [])) aScoreMap[qs.id] = qs;
    const bScoreMap = {};
    for (const qs of (s.bQuestionScores || [])) bScoreMap[qs.id] = qs;
    const aRespMap = p.moduleA?.responses || {};
    const bRespMap = p.moduleB?.responses || {};
    const aInfoMap = {};
    for (const q of (p.moduleA?.questionsInfo || [])) aInfoMap[q.id] = q;

    const row = [
      p.subjectId ?? '', p.name ?? '', p.role ?? '',
      p.startTime ?? '', p.endTime ?? '', p.timeUsedSec ?? '',
      p.formLabel ?? ('Form_' + (p.formType || 'F')),
      p.pageBlurCount ?? 0, p.bulkPasteCount ?? 0,
      s.scoreA ?? '', s.scoreB ?? '', s.resScore ?? '', s.totalScore ?? '',
      s.energyRemaining ?? '',
      d.calibratedReliance ?? '', d.verificationSupervision ?? '', d.complianceBoundary ?? '',
      JSON.stringify(p.behavioralLogs || []),
    ];

    for (const id of aIdList) {
      const qs = aScoreMap[id];
      if (qs) {
        row.push(qs.total ?? '', qs.correctness ?? '', qs.evidenceBoundary ?? '', qs.compliance ?? '', qs.resourceEfficiency ?? '');
      } else {
        row.push('', '', '', '', '');
      }
      const resp = aRespMap[id] || {};
      const acts = resp.actionsUsed || {};
      row.push(acts.editPerformed ? 1 : 0);
      row.push(acts.viewEvidence ? 1 : 0);
      row.push(acts.viewTemplate ? 1 : 0);
      row.push(acts.regenerate ? 1 : 0);
      const info = aInfoMap[id] || {};
      row.push(info.correctOutput ?? '');       // 参考答稿（人工打分依据）
      row.push(info.aiDraft ?? '');             // AI 初稿（被试拿到手的内容）
      row.push(resp.editedText ?? '');          // 被试最终提交文本（final_text）
    }

    for (const id of bIdList) {
      const qs = bScoreMap[id];
      const resp = bRespMap[id];
      row.push(qs ? (qs.score ?? '') : '');
      row.push(resp ? (resp.selectedText ?? resp.selectedIndex ?? '') : '');
      row.push(qs ? (qs.dimension || '') : '');
    }

    rows.push(row);
  }

  return '﻿' + header.map(esc).join(',') + '\n' + rows.map((r) => r.map(esc).join(',')).join('\n');
}
