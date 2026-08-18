/**
 * Export test results as SPSS-compatible CSV (UTF-8 BOM).
 * Includes per-question scores, dimension scores, and drawn item IDs.
 */
export function exportSPSS(results) {
  const BOM = '﻿';

  // Build per-question score columns from the ordered arrays
  const aScores = results.aQuestionScores || [];
  const bScores = results.bQuestionScores || [];
  const dims = results.dimensions || {};

  const aScoreCols = [];
  for (let i = 0; i < 6; i++) {
    aScoreCols.push(aScores[i]?.total ?? '');
  }
  const bScoreCols = [];
  for (let i = 0; i < 10; i++) {
    bScoreCols.push(bScores[i]?.score ?? '');
  }

  const header = [
    'Subject_ID',
    'Name',
    'Role',
    'Start_Time',
    'Time_Used_Sec',
    'Energy_Remaining',
    'Drawn_ModuleA_IDs',
    'Drawn_ModuleB_IDs',
    'A1_Score', 'A2_Score', 'A3_Score', 'A4_Score', 'A5_Score', 'A6_Score',
    'B1_Score', 'B2_Score', 'B3_Score', 'B4_Score', 'B5_Score',
    'B6_Score', 'B7_Score', 'B8_Score', 'B9_Score', 'B10_Score',
    'Dim_Calibrated_Reliance',
    'Dim_Verification_Supervision',
    'Dim_Compliance_Boundary',
    'Score_A_Raw',
    'Score_B_Raw',
    'RES_Score',
    'Total_Score',
    'User_Profile',
    'Behavioral_Logs_Summary',
  ];

  const logSummary = (results.behavioralLogs || [])
    .slice(0, 50)
    .map(l => `${l.action}:${(l.detail || '').substring(0, 30)}`)
    .join('; ');

  const row = [
    results.subjectId,
    results.name,
    results.role,
    results.startTime,
    results.timeUsedSec,
    results.energyRemaining,
    results.drawnAIds || '',
    results.drawnBIds || '',
    ...aScoreCols,
    ...bScoreCols,
    // Support both new {total,fromA,fromB} object format and legacy number format
    (dims.calibratedReliance?.total ?? dims.calibratedReliance ?? ''),
    (dims.verificationSupervision?.total ?? dims.verificationSupervision ?? ''),
    (dims.complianceBoundary?.total ?? dims.complianceBoundary ?? ''),
    results.scoreA,
    results.scoreB,
    results.resScore,
    results.totalScore,
    `"${results.profile || ''}"`,
    `"${logSummary}"`,
  ];

  const csv = BOM + header.join(',') + '\n' + row.join(',');

  downloadFile(csv, `AI_Supervision_Test_${results.subjectId || 'export'}.csv`, 'text/csv;charset=utf-8');
}

/**
 * Export full behavioral logs and per-question details as JSON.
 */
export function exportJSON(results) {
  const dims = results.dimensions || {};

  // Build enriched module A response array with metadata
  const moduleADetail = (results.aQuestionScores || []).map(qs => {
    const qMeta = (results.moduleAQuestionsInfo || []).find(q => q.id === qs.id);
    const resp = (results.moduleAResponses || {})[qs.id] || {};
    const draftLen = (qMeta?.aiDraft || '').length;
    const editedLen = (resp.editedText || '').length;
    return {
      questionId: qs.id,
      category: qMeta ? (qMeta.sceneType || '') : '',
      aiStatus: qMeta ? (qMeta.aiStatus || '') : '',
      aiDraftOriginal: qMeta ? (qMeta.aiDraft || '') : '',
      editedTextFinal: resp.editedText || '',
      textLengthChange: editedLen - draftLen,           // 字数变化量 (终稿 - 原稿)
      timeUsedSec: resp.timeUsed ?? null,               // 本题耗时（秒）
      actionsUsed: resp.actionsUsed || {},
      scoreDetail: {
        aiInitialScore: qs.total ?? 0,                   // AI 初评分
        humanAuditedScore: qs.total ?? 0,                // 人工复核分（默认=初评分，待复核）
        humanAudited: false,                             // 是否已人工复核
        correctness: qs.correctness ?? 0,
        evidenceBoundary: qs.evidenceBoundary ?? 0,
        compliance: qs.compliance ?? 0,
        resourceEfficiency: qs.resourceEfficiency ?? 0,
        totalItemScore: qs.total ?? 0,
        scoringRationale: qs.rationale || [],            // AI 评分理由/判定依据
      },
    };
  });

  // Build enriched module B response array with metadata
  const moduleBDetail = (results.bQuestionScores || []).map(qs => {
    const qMeta = (results.moduleBQuestionsInfo || []).find(q => q.id === qs.id);
    const resp = (results.moduleBResponses || {})[qs.id] || {};
    const options = qMeta ? (qMeta.options || []) : [];
    const selectedOption = options.find(o => o.score === qs.score);
    return {
      questionId: qs.id,
      coreDimension: qs.dimension || '',
      sceneType: qMeta ? (qMeta.sceneType || '') : '',
      selectedScore: qs.score ?? 0,
      selectedText: resp.selectedText || (selectedOption ? selectedOption.text : ''),
      timeUsedSec: resp.timeUsed ?? null,
    };
  });

  const json = JSON.stringify(
    {
      exportTime: new Date().toISOString(),
      testInfo: {
        subjectId: results.subjectId,
        name: results.name,
        role: results.role,
        startTime: results.startTime,
        endTime: results.endTime,
        timeUsedSec: results.timeUsedSec,
        energyRemaining: results.energyRemaining,
        drawnModuleAIds: results.drawnAIds || '',
        drawnModuleBIds: results.drawnBIds || '',
      },
      scores: {
        scoreA_raw: results.scoreA,
        scoreB_raw: results.scoreB,
        resScore: results.resScore,
        totalScore: results.totalScore,
        profile: results.profile,
        energyRemaining: results.energyRemaining,
        dimensions: {
          calibratedReliance: dims.calibratedReliance?.total ?? dims.calibratedReliance ?? 0,
          verificationSupervision: dims.verificationSupervision?.total ?? dims.verificationSupervision ?? 0,
          complianceBoundary: dims.complianceBoundary?.total ?? dims.complianceBoundary ?? 0,
          dimensionBreakdown: {
            calibratedReliance: {
              total: dims.calibratedReliance?.total ?? 0,
              fromModuleA: dims.calibratedReliance?.fromA ?? 0,
              fromModuleB: dims.calibratedReliance?.fromB ?? 0,
            },
            verificationSupervision: {
              total: dims.verificationSupervision?.total ?? 0,
              fromModuleA: dims.verificationSupervision?.fromA ?? 0,
              fromModuleB: dims.verificationSupervision?.fromB ?? 0,
            },
            complianceBoundary: {
              total: dims.complianceBoundary?.total ?? 0,
              fromModuleA: dims.complianceBoundary?.fromA ?? 0,
              fromModuleB: dims.complianceBoundary?.fromB ?? 0,
            },
          },
        },
      },
      moduleADetail,
      moduleBDetail,
      behavioralTimeline: (results.behavioralLogs || []).map(l => ({
        timestamp: l.timestamp,
        action: l.action,
        detail: l.detail,
        energyCost: l.energyCost,
        questionId: l.questionId || null,
      })),
      behavioralLogs: results.behavioralLogs || [],
    },
    null,
    2
  );

  downloadFile(json, `AI_Supervision_Logs_${results.subjectId || 'export'}.json`, 'application/json');
}

/**
 * Export a visually-rich Chinese report (HTML poster) summarizing the subject.
 * Prints nicely to PDF / can be screenshot for quick review.
 */
export function exportReport(results) {
  const dims = results.dimensions || {};
  const dimTotal = (d) => d?.total ?? d ?? 0;
  const dimFromA = (d) => d?.fromA ?? 0;
  const dimFromB = (d) => d?.fromB ?? 0;

  const calibrated = dims.calibratedReliance;
  const verification = dims.verificationSupervision;
  const compliance = dims.complianceBoundary;

  // Behavioral log counts
  const logs = results.behavioralLogs || [];
  const countAction = (name) => logs.filter(l => (l.action || '').toLowerCase().includes(name.toLowerCase())).length;
  const viewEvidenceCount = countAction('view_evidence');
  const viewTemplateCount = countAction('view_template');
  const regenerateCount = countAction('regenerate_prompt');

  // Module A per-question table rows (with time + scoring rationale)
  const aRows = (results.aQuestionScores || []).map(qs => {
    const qMeta = (results.moduleAQuestionsInfo || []).find(q => q.id === qs.id);
    const resp = (results.moduleAResponses || {})[qs.id] || {};
    const edited = resp.editedText && resp.editedText.trim() !== (qMeta?.aiDraft || '').trim();
    const time = resp.timeUsed;
    return {
      id: qs.id,
      category: qMeta ? (qMeta.sceneType || '') : '',
      aiStatus: qMeta ? (qMeta.aiStatus || '') : '',
      total: qs.total ?? 0,
      edited: !!edited,
      time: time,
      rationale: (qs.rationale || []).join('；'),
    };
  });

  // Module B per-question rows (with time)
  const bRows = (results.bQuestionScores || []).map((qs, i) => {
    const resp = (results.moduleBResponses || {})[qs.id] || {};
    const time = resp.timeUsed;
    return {
      id: qs.id,
      dim: qs.dimension || '',
      score: qs.score ?? 0,
      num: i + 1,
      time: time,
    };
  });

  const catLabels = { data: '数据分析', compliance: '制度合规', communication: '对外沟通' };

  // Energy usage detail: how many points spent on each purpose
  const energyTotal = results.energyRemaining !== undefined ? 20 - results.energyRemaining : null;
  const energyBreakdown = [
    { label: '查阅原始材料（3点/次）', cost: 3, count: viewEvidenceCount },
    { label: '查看工作规范（2点/次）', cost: 2, count: viewTemplateCount },
    { label: '微调 Prompt（1点/次）', cost: 1, count: regenerateCount },
  ];
  const energyRowsHtml = energyBreakdown
    .map(e => `<tr><td>${e.label}</td><td class="num">${e.count} 次</td><td class="num">${e.cost * e.count} 点</td></tr>`)
    .join('');

  // Behavioral timeline (last ~15 entries, reverse chronological)
  const timelineRows = [...logs].slice(-15).map(l => {
    const t = l.timestamp ? new Date(l.timestamp).toLocaleTimeString('zh-CN', { hour12: false }) : '';
    return `<tr><td>${t}</td><td>${l.action || ''}</td><td>${l.questionId || ''}</td><td class="num">${l.energyCost ? '-' + l.energyCost : ''}</td></tr>`;
  }).join('');

  const dimBar = (label, obj, color, max) => {
    const total = dimTotal(obj);
    const fromA = dimFromA(obj);
    const fromB = dimFromB(obj);
    const pct = max > 0 ? Math.min(100, Math.round(total / max * 100)) : 0;
    return `
    <div class="dim-row">
      <div class="dim-label">${label}</div>
      <div class="dim-bar-track">
        <div class="dim-bar" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="dim-num"><b>${total}</b><span class="dim-sub">A:${fromA} · B:${fromB}</span></div>
    </div>`;
  };

  const aRowHtml = aRows.map(r => `
    <tr>
      <td>${r.id}</td>
      <td><span class="tag ${catLabels[r.category] ? 'tag-blue' : 'tag-gray'}">${catLabels[r.category] || r.category || '-'}</span></td>
      <td>${r.edited ? '<span class="badge-green">已修正</span>' : '<span class="badge-gray">未修改</span>'}</td>
      <td class="num">${r.time != null ? r.time + 's' : '-'}</td>
      <td class="num">${r.total} / 10</td>
    </tr>`).join('');

  const bRowHtml = bRows.map(r => `
    <tr>
      <td>${r.id}</td>
      <td>${r.dim || '-'}</td>
      <td class="num">${r.time != null ? r.time + 's' : '-'}</td>
      <td class="num">${r.score}</td>
    </tr>`).join('');

  const totalPct = Math.min(100, Math.round((results.totalScore || 0)));

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<title>被试成绩单 ${results.subjectId || ''}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif; background:#f1f5f9; padding:32px; color:#1e293b; }
  .poster { max-width:840px; margin:0 auto; background:#fff; border-radius:20px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,.12); }
  .hero { background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 55%,#3b82f6 100%); color:#fff; padding:36px 40px; }
  .hero-top { display:flex; justify-content:space-between; align-items:flex-start; }
  .hero h1 { font-size:26px; font-weight:800; letter-spacing:1px; }
  .hero .sub { font-size:13px; opacity:.75; margin-top:4px; }
  .hero .badge { display:inline-block; padding:8px 18px; border-radius:999px; font-size:13px; font-weight:700; background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.35); }
  .subject-grid { display:flex; gap:28px; margin-top:24px; flex-wrap:wrap; }
  .subject-item { min-width:120px; }
  .subject-item .k { font-size:12px; opacity:.7; }
  .subject-item .v { font-size:18px; font-weight:700; margin-top:2px; }
  .body { padding:32px 40px 40px; }
  .section { margin-bottom:28px; }
  .section-title { font-size:15px; font-weight:800; color:#1e3a8a; margin-bottom:14px; padding-bottom:8px; border-bottom:2px solid #e2e8f0; display:flex; align-items:center; gap:8px; }
  .section-title .dot { width:8px; height:8px; border-radius:2px; background:#2563eb; display:inline-block; }
  /* 总分 */
  .total-card { display:flex; align-items:center; gap:32px; background:linear-gradient(135deg,#f8fafc,#eff6ff); border:1px solid #dbeafe; border-radius:16px; padding:24px 28px; margin-bottom:28px; }
  .total-big { text-align:center; }
  .total-big .score { font-size:52px; font-weight:900; color:#1e3a8a; line-height:1; }
  .total-big .label { font-size:13px; color:#64748b; margin-top:4px; }
  .total-meta { flex:1; display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
  .meta-cell { background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; }
  .meta-cell .k { font-size:11px; color:#94a3b8; }
  .meta-cell .v { font-size:17px; font-weight:700; color:#334155; margin-top:2px; }
  /* 维度 */
  .dim-row { display:flex; align-items:center; gap:14px; margin-bottom:12px; }
  .dim-label { width:110px; font-size:13px; font-weight:600; color:#475569; }
  .dim-bar-track { flex:1; height:16px; background:#eef2f7; border-radius:8px; overflow:hidden; }
  .dim-bar { height:100%; border-radius:8px; transition:width .5s; }
  .dim-num { width:92px; text-align:right; font-size:16px; }
  .dim-sub { display:block; font-size:10px; color:#94a3b8; font-weight:400; }
  /* 表格 */
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { background:#f8fafc; color:#64748b; font-weight:600; text-align:left; padding:9px 12px; border-bottom:2px solid #e2e8f0; }
  td { padding:9px 12px; border-bottom:1px solid #f1f5f9; }
  td.num { text-align:center; font-weight:600; }
  .tag { display:inline-block; padding:2px 10px; border-radius:999px; font-size:11px; font-weight:600; }
  .tag-blue { background:#dbeafe; color:#1d4ed8; }
  .tag-gray { background:#f1f5f9; color:#64748b; }
  .badge-green { display:inline-block; padding:2px 10px; border-radius:999px; font-size:11px; font-weight:600; background:#d1fae5; color:#047857; }
  .badge-gray { display:inline-block; padding:2px 10px; border-radius:999px; font-size:11px; font-weight:600; background:#f1f5f9; color:#94a3b8; }
  .footer { text-align:center; font-size:11px; color:#94a3b8; margin-top:20px; padding-top:16px; border-top:1px solid #f1f5f9; }
  @media print { body { background:#fff; padding:0; } .poster { box-shadow:none; border-radius:0; } }
</style>
</head>
<body>
<div class="poster">
  <div class="hero">
    <div class="hero-top">
      <div>
        <h1>🧠 AI 监督校准测验成绩单</h1>
        <div class="sub">Trustline · 第二届全国大学生心理与认知智能测评挑战赛</div>
      </div>
      <span class="badge">${results.profile || '待评估'}</span>
    </div>
    <div class="subject-grid">
      <div class="subject-item"><div class="k">被试编号</div><div class="v">${results.subjectId || '-'}</div></div>
      <div class="subject-item"><div class="k">姓名</div><div class="v">${results.name || '-'}</div></div>
      <div class="subject-item"><div class="k">岗位 / 专业</div><div class="v">${results.role || '-'}</div></div>
      <div class="subject-item"><div class="k">完成时间</div><div class="v">${results.endTime ? new Date(results.endTime).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}</div></div>
    </div>
  </div>

  <div class="body">
    <!-- 总分 -->
    <div class="total-card">
      <div class="total-big">
        <div class="score">${results.totalScore ?? '-'}</div>
        <div class="label">综合得分 / 100</div>
      </div>
      <div class="total-meta">
        <div class="meta-cell"><div class="k">模块 A（60分制）</div><div class="v">${results.scoreA ?? '-'}</div></div>
        <div class="meta-cell"><div class="k">模块 B（20分制）</div><div class="v">${results.scoreB ?? '-'}</div></div>
        <div class="meta-cell"><div class="k">RES 分数</div><div class="v">${results.resScore ?? '-'}</div></div>
        <div class="meta-cell"><div class="k">总用时</div><div class="v">${results.timeUsedSec ? Math.floor(results.timeUsedSec/60)+' 分 '+results.timeUsedSec%60+' 秒' : '-'}</div></div>
        <div class="meta-cell"><div class="k">精力消耗</div><div class="v">${energyTotal != null ? energyTotal : '-'} / 20 点</div></div>
        <div class="meta-cell"><div class="k">剩余精力</div><div class="v">${results.energyRemaining ?? '-'} / 20 点</div></div>
      </div>
    </div>

    <!-- 三大维度 -->
    <div class="section">
      <div class="section-title"><span class="dot"></span>三大核心维度得分</div>
      ${dimBar('校准式依赖能力', calibrated, '#2563eb', 30)}
      ${dimBar('核验监督能力', verification, '#7c3aed', 30)}
      ${dimBar('合规边界执行力', compliance, '#059669', 30)}
      <div style="font-size:11px;color:#94a3b8;margin-top:8px;">注：维度得分 = 模块A对应Rubric维度 + 模块B对应维度题目得分之和（A:模块A贡献 · B:模块B贡献）</div>
    </div>

    <!-- 模块A明细 -->
    <div class="section">
      <div class="section-title"><span class="dot"></span>模块 A · 沉浸式文书审阅（6 题）</div>
      <table>
        <thead><tr><th>题号</th><th>类别</th><th>修正情况</th><th class="num">耗时</th><th class="num">得分</th></tr></thead>
        <tbody>${aRowHtml}</tbody>
      </table>
      <div style="font-size:11px;color:#94a3b8;margin-top:6px;">模块 A 得分为 AI 自动初评（Rubric 四维度），提交后需人工复核校正。</div>
    </div>

    <!-- 模块B明细 -->
    <div class="section">
      <div class="section-title"><span class="dot"></span>模块 B · 微决策情境判断（10 题）</div>
      <table>
        <thead><tr><th>题号</th><th>所属维度</th><th class="num">耗时</th><th class="num">得分</th></tr></thead>
        <tbody>${bRowHtml}</tbody>
      </table>
    </div>

    <!-- 精力消耗 -->
    <div class="section">
      <div class="section-title"><span class="dot"></span>精力点数使用明细</div>
      <table>
        <thead><tr><th>用途</th><th class="num">使用次数</th><th class="num">消耗点数</th></tr></thead>
        <tbody>${energyRowsHtml}</tbody>
      </table>
    </div>

    <!-- 行为时间轴 -->
    <div class="section">
      <div class="section-title"><span class="dot"></span>行为轨迹时间轴（最近 15 条）</div>
      <table>
        <thead><tr><th>时间</th><th>操作</th><th>题目</th><th class="num">消耗</th></tr></thead>
        <tbody>${timelineRows}</tbody>
      </table>
      <div style="font-size:11px;color:#94a3b8;margin-top:6px;">完整行为轨迹（含每一步操作的先后顺序、题目归属、精力消耗）见 JSON 日志文件。</div>
    </div>

    <div class="footer">本报告由 Trustline 测验系统自动生成 · ${new Date().toLocaleString('zh-CN')} · 数据文件：CSV / JSON 随本报告一同导出</div>
  </div>
</div>
</body>
</html>`;

  downloadFile(html, `AI_Supervision_Report_${results.subjectId || 'report'}.html`, 'text/html;charset=utf-8');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
