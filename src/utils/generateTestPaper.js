import itemBank from '../data/itemBank.json' with { type: 'json' };

function norm(t) {
  if (!t) return 'unknown';
  if (/数据/.test(t)) return 'data';
  if (/制度|合规/.test(t)) return 'compliance';
  if (/沟通|对外/.test(t)) return 'communication';
  return 'unknown';
}

function aiHasError(q) {
  const s = (q.aiStatus || '').trim();
  if (s === '基本正确' || s === 'AI正确') return false;
  if (s !== '' && s !== '基本正确' && s !== 'AI正确') return true;
  const d = q.aiDraft || '';
  if (d.startsWith('[AI正确]')) return false;
  if (d.startsWith('[AI错误]')) return true;
  return false;
}

function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function generateTestPaper() {
  // IDs are already unique in the JSON (e.g. "dsh-A1", "hr-A1")
  const allA = (itemBank.moduleA.questions || []).map(q => ({
    ...q,
    sceneType: norm(q.sceneType),
  }));
  const allB = (itemBank.moduleB.questions || []).map(q => ({
    ...q,
    options: (q.options || []).filter(o => o.text && o.text.trim() !== ''),
  }));

  // --- Module A: strictly stratified selection ---
  // HARD RULES:
  //   每类 (data / compliance / communication) 严格抽 2 题
  //   全局错误题 3 道、正确题 3 道
  const CATS = ['data', 'compliance', 'communication'];
  const byCat = { data: [], compliance: [], communication: [] };
  for (const q of allA) {
    if (byCat[q.sceneType]) byCat[q.sceneType].push(q);
  }

  // Each category draws exactly 2 questions. dist[i] = #error questions drawn from category i.
  // v3.1 对称设计：严格 3 错 3 对 —— 每类 1 错 1 对（申报书"正确/错误条件随机对称"）。
  // 要求每类至少有 1 道正确题 + 1 道错误题（题库已含 hr-A7/zxy-A7/dsh-A7 三题正确情境题）。
  const DISTRIBUTIONS = [[1, 1, 1]];

  let selectedA = null;

  // Try random feasible distribution until one works
  const distPool = shuffle(DISTRIBUTIONS);
  for (const dist of distPool) {
    const attempt = [];
    let feasible = true;
    for (let i = 0; i < CATS.length; i++) {
      const cat = CATS[i];
      const pool = byCat[cat] || [];
      const errPool = pool.filter(q => aiHasError(q));
      const okPool = pool.filter(q => !aiHasError(q));
      const needErr = dist[i];
      const needOk = 2 - needErr;
      if (errPool.length < needErr || okPool.length < needOk) {
        feasible = false;
        break;
      }
      attempt.push(...shuffle(errPool).slice(0, needErr));
      attempt.push(...shuffle(okPool).slice(0, needOk));
    }
    if (feasible) {
      selectedA = attempt;
      break;
    }
  }

  // Safety fallback: if no distribution feasible, take 2 from each category anyway
  if (!selectedA) {
    selectedA = [];
    for (const cat of CATS) {
      selectedA.push(...shuffle(byCat[cat] || []).slice(0, 2));
    }
  }

  // --- Module B: stratified 10 covering all three constructs ---
  // 每人 10 题必须覆盖 校准/核验/合规 三个构念（否则该构念维度分缺失，无法做三构念相关与 EFA）。
  // 在可行分布中随机选一个（[3,4,3] / [4,3,3] / [3,3,4]），保证每个构念 3–4 题。
  const BDIMS = ['校准式依赖能力', '核验监督能力', '合规边界执行力'];
  const B_DISTRIBUTIONS = [[3, 4, 3], [4, 3, 3], [3, 3, 4]];
  let selectedB = null;
  for (const dist of shuffle(B_DISTRIBUTIONS)) {
    const attempt = [];
    let feasible = true;
    for (let i = 0; i < BDIMS.length; i++) {
      const pool = allB.filter(q => (q.coreDimension || '') === BDIMS[i]);
      if (pool.length < dist[i]) { feasible = false; break; }
      attempt.push(...shuffle(pool).slice(0, dist[i]));
    }
    if (feasible) { selectedB = attempt; break; }
  }
  // 兜底：若均不可行（题库构念题不足），退回随机 10
  if (!selectedB) selectedB = shuffle(allB).slice(0, 10);

  return {
    moduleA: shuffle(selectedA),
    moduleB: selectedB,
  };
}

/**
 * 正式卷固定抽题（老师批准的组装方案）：
 *   模块A = dsh-A1/A2/A3/A4/A5/A7（3 错 3 对，每类各 1 错 1 对；丢弃 dsh-A6）
 *   模块B = zxy-B1..B10（核验4 / 合规4 / 校准2，三构念全覆盖）
 * 同一卷所有被试完全一致，仅模块A呈现顺序随机以消除位置效应。
 */
export function buildFormalPaper() {
  const FORMAL_A_IDS = ['dsh-A1', 'dsh-A2', 'dsh-A3', 'dsh-A4', 'dsh-A5', 'dsh-A7'];
  const FORMAL_B_IDS = [
    'zxy-B1', 'zxy-B2', 'zxy-B3', 'zxy-B4', 'zxy-B5',
    'zxy-B6', 'zxy-B7', 'zxy-B8', 'zxy-B9', 'zxy-B10',
  ];

  const allA = (itemBank.moduleA.questions || []).map((q) => ({
    ...q,
    sceneType: norm(q.sceneType),
  }));
  const allB = (itemBank.moduleB.questions || []).map((q) => ({
    ...q,
    options: (q.options || []).filter((o) => o.text && o.text.trim() !== ''),
  }));

  const aMap = Object.fromEntries(allA.map((q) => [q.id, q]));
  const bMap = Object.fromEntries(allB.map((q) => [q.id, q]));

  const formA = FORMAL_A_IDS.map((id) => aMap[id]);
  const formB = FORMAL_B_IDS.map((id) => bMap[id]);

  if (formA.some((q) => !q) || formB.some((q) => !q)) {
    throw new Error('buildFormalPaper: 正式卷题目 id 在题库中缺失');
  }

  return {
    moduleA: shuffle(formA), // 呈现顺序随机化
    moduleB: formB,          // 模块B固定顺序（标准化）
  };
}

export default generateTestPaper;
