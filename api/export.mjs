/**
 * 正式实验数据导出（Vercel Serverless Function）。
 *
 * 把 api/collect.mjs 收集的全部数据聚合导出：
 *   - 默认 /  ?format=csv  → 宽表 CSV（每人一行，所有被试同一张大表格）
 *       含：核心对齐字段 + 模块A逐题得分 + 行为动作标志 + 参考答稿/AI初稿/被试最终文本
 *         + 模块B逐题 + 全量行为日志
 *   -      ?format=json   → 完整 JSON 数组（最高保真，供 R/Python/SPSS 深入分析）
 *
 * 访问示例：
 *   https://你的vercel域名/api/export               （CSV 宽表，含行为日志）
 *   https://你的vercel域名/api/export?format=json   （完整 JSON）
 *
 * 需要配置 BLOB_READ_WRITE_TOKEN（与 collect 相同）。
 */
import { list, get } from '@vercel/blob';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  try {
    const fmt = (req.query.format || 'csv').toLowerCase();

    // 1) 列出 subjects/ 前缀下全部 blob
    const blobs = [];
    let cursor;
    do {
      const page = await list({ prefix: 'subjects/', limit: 1000, cursor });
      blobs.push(...(page.blobs || []));
      cursor = page.cursor;
    } while (cursor);

    // 2) 逐个读取并解析（损坏项跳过）
    const payloads = [];
    for (const b of blobs) {
      try {
        // @vercel/blob v2：私有 Blob 必须传 access 选项；返回 { stream, ... } 而非 download()
        const r = await get(b.url, { access: 'private', useCache: false });
        if (!r || !r.stream) continue;
        const text = await new Response(r.stream).text();
        payloads.push(JSON.parse(text));
      } catch (e) { /* 跳过损坏项 */ }
    }

    // 3) 按开始时间排序
    payloads.sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));

    if (fmt === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="formal-data.json"');
      return res.status(200).send(JSON.stringify(payloads, null, 2));
    }

    const csv = buildWideCSV(payloads);
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="formal-data.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String((err && err.message) || err) });
  }
}

/* ---------------- 宽表 CSV 构建（与 pilot-export 对齐，字段全量保留） ---------------- */

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
