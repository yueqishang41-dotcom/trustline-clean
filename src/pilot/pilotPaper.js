import itemBank from '../data/itemBank.json' with { type: 'json' };

function norm(t) {
  if (!t) return 'unknown';
  if (/数据/.test(t)) return 'data';
  if (/制度|合规/.test(t)) return 'compliance';
  if (/沟通|对外/.test(t)) return 'communication';
  return 'unknown';
}

function shuffle(arr) {
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const SOURCE_BY_FORM = {
  A: '测验题目_dsh',
  B: '题库-hr',
  C: '题库-zxy(1)',
};

/**
 * 构建 A/B/C 固定试卷：
 *  - 模块 A：取对应来源的前 6 题（A: dsh-A1..A6, B: hr-A1..A6, C: zxy-A1..A6），呈现顺序打乱
 *  - 模块 B：取对应来源的前 10 题（A: dsh-B1..B10, B: hr-B1..B10, C: zxy-B1..B10）
 * 试卷内容固定（同一卷所有被试完全一致），仅模块A呈现顺序随机以消除位置效应。
 */
export function buildFixedPaper(formType) {
  const source = SOURCE_BY_FORM[formType] || '测验题目_dsh';

  const allA = (itemBank.moduleA.questions || []).map((q) => ({
    ...q,
    sceneType: norm(q.sceneType),
  }));
  const allB = (itemBank.moduleB.questions || []).map((q) => ({
    ...q,
    options: (q.options || []).filter((o) => o.text && o.text.trim() !== ''),
  }));

  const formA = allA.filter((q) => q.source === source).slice(0, 6);
  const formB = allB.filter((q) => q.source === source).slice(0, 10);

  return {
    moduleA: shuffle(formA), // 呈现顺序随机化（任务二第4项）
    moduleB: formB,
  };
}

export default buildFixedPaper;
