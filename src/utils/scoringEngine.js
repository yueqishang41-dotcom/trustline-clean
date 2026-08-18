import itemBank from '../data/itemBank.json' with { type: 'json' };

const rubric = itemBank.scoringRubric;
const params = rubric.resAlgorithm?.parameters || {};
const PASS_LINE = params.S_pass ?? 36;
const GAMMA = params.gamma ?? 0.1;
const E0 = params.E_0 ?? 20;
const MAX_A = 60;
const MAX_B = 20;

/**
 * Compute text similarity (0-1) between two strings.
 * 字符集 Jaccard —— 用于"是否发生实质修改"的判定（hasSignificantEdit）。
 */
function textSimilarity(a, b) {
  if (!a || !b) return 0;
  const aClean = a.trim();
  const bClean = b.trim();
  if (aClean === bClean) return 1;
  if (aClean.length < 5 || bClean.length < 5) return aClean === bClean ? 1 : 0;
  const setA = new Set(aClean);
  const setB = new Set(bClean);
  const intersection = new Set([...setA].filter(c => setB.has(c)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/**
 * Compute character-bigram Jaccard similarity (0-1) between two strings.
 * 二元组 Jaccard —— 比字符集更敏感，能区分"上升/下降"这类局部改动，
 * 用于提交文本与参考答案（correctOutput）的正确性比对。
 */
function bigramSimilarity(a, b) {
  if (!a || !b) return 0;
  const aClean = a.trim();
  const bClean = b.trim();
  if (aClean === bClean) return 1;
  if (aClean.length < 5 || bClean.length < 5) return aClean === bClean ? 1 : 0;
  const bigrams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const setA = bigrams(aClean);
  const setB = bigrams(bClean);
  const intersection = new Set([...setA].filter(c => setB.has(c)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

// 否定式修正标记：短语前 4 字内出现任一否定词，视为"已修正"而非"残留错误"
// （例如正解"尚未获得最高级安全认证"不得被 mustFix"最高级安全认证"误判为残留）
const NEG_RE = /(不|未|无|非|别|勿|莫|并没有|并无|切勿|不再|不可|不应|不宜|不得|无需|无须|拒绝|否认|取消|避免|放弃|并非)/;

/**
 * 判断文本中是否"肯定式"出现了目标短语（前 4 字内无否定词）。
 * 否定式提及（如"并非平稳态势"）不计为残留。
 */
function containsNotNegated(text, phrase) {
  if (!phrase) return false;
  let idx = text.indexOf(phrase);
  while (idx >= 0) {
    const before = text.slice(Math.max(0, idx - 4), idx);
    if (!NEG_RE.test(before)) return true;
    idx = text.indexOf(phrase, idx + 1);
  }
  return false;
}

/**
 * complianceHints 支持正则（如 \\d{11}）或字面短语，同样排除否定式提及。
 */
function hintMatches(text, hint) {
  let re;
  try { re = new RegExp(hint); } catch { re = new RegExp(hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); }
  const m = re.exec(text);
  if (!m) return false;
  const before = text.slice(Math.max(0, m.index - 4), m.index);
  return !NEG_RE.test(before);
}

/**
 * Score a Module A question with sub-dimension breakdown.
 * 2026-08 预实验修订：正确性改为「关键事实命中率 + 二元组相似度」取高，
 * 并增加「保留 AI 植入错误（mustFix）」「合规残留（complianceHints）」定向扣分，
 * 以拉开高/低分组得分差距，改善模块A区分度。
 * Returns { total, correctness, evidenceBoundary, compliance, resourceEfficiency }
 */
export function scoreModuleAQuestion(question, response) {
  if (!response) return { total: 0, correctness: 0, evidenceBoundary: 0, compliance: 0, resourceEfficiency: 0, rationale: [] };

  const { editedText, actionsUsed = {} } = response;
  const originalDraft = question.aiDraft || '';
  const correctOutput = question.correctOutput || '';

  const draftClean = originalDraft.replace(/^\[AI[^\]]*\]\s*/, '').trim();
  const editedClean = (editedText || '').trim();

  const hasSignificantEdit = editedClean.length > 0 &&
    editedClean !== draftClean &&
    textSimilarity(draftClean, editedClean) < 0.95;

  const submitted = editedClean || draftClean;

  // 中文数字/单位间空格可能缺失，统一去除空白后匹配
  const denorm = (s) => s.replace(/\s+/g, '');
  const submittedNorm = denorm(submitted);
  const keyFacts = (question.keyFacts || []).map(denorm).filter(Boolean);
  const mustFix = (question.mustFix || []).map(denorm).filter(Boolean);
  const complianceHints = (question.complianceHints || []).map(denorm).filter(Boolean);

  const factHit = keyFacts.filter((k) => submittedNorm.includes(k)).length;
  const factRatio = keyFacts.length ? factHit / keyFacts.length : 0;
  const bigram = bigramSimilarity(submitted, (correctOutput || '').trim());

  // 1. Correctness & Accuracy (0-3)：关键事实命中率 与 二元组相似度 取高
  const factScore = factRatio >= 0.85 ? 3 : factRatio >= 0.6 ? 2.5 : factRatio >= 0.4 ? 2 : factRatio >= 0.2 ? 1.5 : 1;
  const bigramScore = bigram > 0.8 ? 3 : bigram > 0.65 ? 2.5 : bigram > 0.5 ? 2 : bigram > 0.35 ? 1.5 : 1;
  let correctness = Math.max(factScore, bigramScore);

  // 保留 AI 植入错误 → 正确性降至最低档（1分封顶）
  // 否定式修正（如"并未企稳回升"）不计为残留错误
  const retainedFlaw = mustFix.some((m) => containsNotNegated(submittedNorm, m));
  if (retainedFlaw) correctness = Math.min(correctness, 1);

  // 2. Evidence Boundary (0-3)：看过材料且关键事实命中良好才拿满
  const viewedEvidence = actionsUsed.viewEvidence || false;
  const usedTemplate = actionsUsed.viewTemplate || false;
  const usedRegenerate = actionsUsed.regenerate || false;

  let evidenceBoundary = 0;
  if (viewedEvidence) evidenceBoundary += factRatio >= 0.5 ? 1.5 : 1;
  if (usedTemplate) evidenceBoundary += 1;
  if (usedRegenerate && !viewedEvidence) evidenceBoundary += 0.5;

  // 3. Compliance Boundary (0-2)：合规残留（PII/越权/敏感信息）一票扣到底
  const complianceViolation = complianceHints.length > 0 && complianceHints.some((h) => hintMatches(submittedNorm, h));
  let compliance = 0;
  if (!complianceViolation) {
    if (hasSignificantEdit) compliance += 1;
    if (viewedEvidence || usedTemplate) compliance += 0.5;
  }
  if (complianceViolation) correctness = Math.min(correctness, 1);

  // 4. Resource Efficiency (0-2)
  const totalActions = Object.values(actionsUsed).filter(Boolean).length;
  let resourceEfficiency = 0;
  if (totalActions <= 1) resourceEfficiency = 1.5;
  else if (totalActions === 2) resourceEfficiency = 1;
  else resourceEfficiency = 0.5;

  // Clamp sub-dimensions
  correctness = Math.min(correctness, 3);
  evidenceBoundary = Math.min(evidenceBoundary, 3);
  compliance = Math.min(compliance, 2);
  resourceEfficiency = Math.min(resourceEfficiency, 2);

  const total = Math.min(Math.round((correctness + evidenceBoundary + compliance + resourceEfficiency) * 10) / 10, 10);

  // Build AI scoring rationale for auditability
  const rationale = [];
  if (hasSignificantEdit) {
    rationale.push(`检测到对AI初稿的有效修改（相似度 ${(textSimilarity(draftClean, editedClean) * 100).toFixed(0)}%）`);
  } else {
    rationale.push('未对AI初稿进行实质修改，直接采纳AI输出');
  }
  rationale.push(`交付正确性评分 ${correctness}/3（关键事实命中 ${keyFacts.length ? `${Math.round(factRatio * 100)}%` : '无'}，文本相似度 ${(bigram * 100).toFixed(0)}%）`);
  if (retainedFlaw) rationale.push('⚠ 仍保留AI初稿中的错误表述，正确性受限');
  if (viewedEvidence) rationale.push(`查阅了原始材料（证据边界 ${factRatio >= 0.5 ? '+1.5' : '+1'}）`);
  if (usedTemplate) rationale.push('查看了工作规范（证据边界 +1）');
  if (usedRegenerate && !viewedEvidence) rationale.push('仅使用重新生成，未查阅证据（证据边界 +0.5）');
  if (hasSignificantEdit && !complianceViolation) rationale.push('进行了有效修正（合规边界 +1）');
  if (complianceViolation) rationale.push('⚠ 最终文本仍含敏感/越权/错误残留（合规边界 0）');
  rationale.push(`共执行 ${totalActions} 项辅助操作（资源效率 ${resourceEfficiency}/2）`);

  return { total, correctness, evidenceBoundary, compliance, resourceEfficiency, rationale };
}

/**
 * Calculate Module A total score (0-60) with per-question breakdown.
 * Returns { total, questions: [{ id, total, correctness, evidenceBoundary, compliance, resourceEfficiency }] }
 */
export function calculateModuleAScore(questions, responses) {
  let total = 0;
  const questionScores = [];
  for (const q of questions) {
    const scored = scoreModuleAQuestion(q, responses[q.id]);
    questionScores.push({ id: q.id, ...scored });
    total += scored.total;
  }
  return { total: Math.min(total, MAX_A), questionScores };
}

/**
 * Calculate Module B total score (0-20) with per-question breakdown.
 * Returns { total, questionScores: [{ id, score, dimension }] }
 */
export function calculateModuleBScore(questions, responses) {
  let total = 0;
  const questionScores = [];
  for (const q of questions) {
    const resp = responses[q.id];
    const score = (resp && resp.selectedScore !== undefined) ? resp.selectedScore : 0;
    total += score;
    questionScores.push({
      id: q.id,
      score,
      dimension: q.coreDimension || '',
    });
  }
  return { total: Math.min(Math.max(total, 0), MAX_B), questionScores };
}

/**
 * Calculate three construct dimension scores from BOTH Module A and Module B.
 *
 * Mapping of Module A rubric sub-scores to the three constructs:
 *   - 校准式依赖 (Calibrated Reliance)      ← correctness + resourceEfficiency
 *   - 核验监督 (Verification Supervision)   ← evidenceBoundary
 *   - 合规边界 (Compliance Boundary)        ← compliance
 *
 * Module B contributes via each question's coreDimension tag.
 *
 * Returns { total, fromA, fromB } per dimension.
 */
export function calculateDimensionScores(aQuestionScores, bQuestionScores) {
  const dims = {
    calibratedReliance: { total: 0, fromA: 0, fromB: 0 },
    verificationSupervision: { total: 0, fromA: 0, fromB: 0 },
    complianceBoundary: { total: 0, fromA: 0, fromB: 0 },
  };
  const counts = { calibratedReliance: 0, verificationSupervision: 0, complianceBoundary: 0 };

  // --- Module A contribution ---
  for (const qs of aQuestionScores || []) {
    dims.calibratedReliance.fromA += (qs.correctness ?? 0) + (qs.resourceEfficiency ?? 0);
    dims.verificationSupervision.fromA += qs.evidenceBoundary ?? 0;
    dims.complianceBoundary.fromA += qs.compliance ?? 0;
  }

  // --- Module B contribution ---
  for (const qs of bQuestionScores || []) {
    const dim = qs.dimension || '';
    let key = null;
    if (dim.includes('校准式依赖')) key = 'calibratedReliance';
    else if (dim.includes('核验监督')) key = 'verificationSupervision';
    else if (dim.includes('合规边界')) key = 'complianceBoundary';

    if (key) {
      dims[key].fromB += qs.score;
      counts[key]++;
    }
  }

  // Sum + round
  for (const key of Object.keys(dims)) {
    dims[key].fromA = Math.round(dims[key].fromA * 10) / 10;
    dims[key].fromB = Math.round(dims[key].fromB * 10) / 10;
    dims[key].total = Math.round((dims[key].fromA + dims[key].fromB) * 10) / 10;
  }

  return {
    calibratedReliance: dims.calibratedReliance,
    verificationSupervision: dims.verificationSupervision,
    complianceBoundary: dims.complianceBoundary,
    calibratedRelianceCount: counts.calibratedReliance,
    verificationSupervisionCount: counts.verificationSupervision,
    complianceBoundaryCount: counts.complianceBoundary,
  };
}

/**
 * Compute RES score.
 */
export function computeRES(rawScoreA, energyRemaining) {
  if (rawScoreA >= PASS_LINE) {
    const bonus = 1 + GAMMA * (energyRemaining / E0);
    return Math.round(rawScoreA * bonus * 100) / 100;
  }
  return rawScoreA;
}

/**
 * Compute total score (0-100).
 */
export function computeTotalScore(resScore, scoreB) {
  const partA = (resScore / MAX_A) * 80;
  const partB = (scoreB / MAX_B) * 20;
  return Math.round((partA + partB) * 100) / 100;
}

/**
 * Determine user profile.
 */
export function determineProfile(scoreA, scoreB, energyRemaining) {
  if (scoreA < PASS_LINE * 0.7 && energyRemaining <= 5) {
    return '盲信风险型 — 对AI输出缺乏有效核验，在AI错误时未能识别修正，容易造成事实性错误与合规风险。';
  }
  if (energyRemaining <= 5 && scoreA >= PASS_LINE * 0.7 && scoreA < PASS_LINE * 1.1) {
    return '过疑低效型 — 虽然完成了修正，但消耗了过多精力点数，资源分配策略有待优化。';
  }
  if (scoreA >= PASS_LINE && energyRemaining >= 10) {
    return '校准良好型 — 在高效核验AI输出与合理分配精力资源之间取得了优秀平衡，具备良好的元认知监控与合规执行力。';
  }
  if (scoreA >= PASS_LINE) {
    return '中等校准型 — 具备一定核验能力，但在资源分配效率或风险敏感度方面仍有提升空间。';
  }
  return '需提升型 — 在AI监督校准与合规执行方面需加强训练，建议关注数据核验、合规边界与精力分配策略。';
}

/**
 * Run full scoring pipeline — returns everything needed for export.
 */
export function runFullScoring(moduleAQuestions, moduleAResponses, moduleBQuestions, moduleBResponses, energyRemaining) {
  const { total: scoreARaw, questionScores: aQuestionScores } = calculateModuleAScore(moduleAQuestions, moduleAResponses);
  const { total: scoreBRaw, questionScores: bQuestionScores } = calculateModuleBScore(moduleBQuestions, moduleBResponses);
  const resScore = computeRES(scoreARaw, energyRemaining);
  const totalScore = computeTotalScore(resScore, scoreBRaw);
  const profile = determineProfile(scoreARaw, scoreBRaw, energyRemaining);
  const dimensions = calculateDimensionScores(aQuestionScores, bQuestionScores);

  // Build drawn question ID strings
  const drawnAIds = moduleAQuestions.map(q => q.id).join(';');
  const drawnBIds = moduleBQuestions.map(q => q.id).join(';');

  // Build per-question score arrays for CSV export
  const aScores = {};
  aQuestionScores.forEach(qs => { aScores[qs.id] = qs.total; });
  const bScores = {};
  bQuestionScores.forEach(qs => { bScores[qs.id] = qs.score; });

  return {
    scoreA: Math.round(scoreARaw * 100) / 100,
    scoreB: Math.round(scoreBRaw * 100) / 100,
    resScore: Math.round(resScore * 100) / 100,
    totalScore: Math.round(totalScore * 100) / 100,
    profile,
    dimensions,
    drawnAIds,
    drawnBIds,
    aScores,          // { 'dsh-A1': 8.5, 'hr-A3': 6.0, ... }
    bScores,          // { 'dsh-B1': 2, 'hr-B3': 1, ... }
    aQuestionScores,  // detailed breakdown with sub-dimensions
    bQuestionScores,  // per-question with dimension tags
  };
}
