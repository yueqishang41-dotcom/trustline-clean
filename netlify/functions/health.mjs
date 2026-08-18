/**
 * 正式实验数据链路自检端点（Netlify Function，诊断用）。
 *
 * 浏览器直接打开 /api/health 即可（netlify.toml 重写到本函数）：
 *   1. 报告关键环境变量是否已配置（不泄露值：DeepSeek key / 导出保护 token）
 *   2. 尝试向 Netlify Blobs 写入一个微型探测文件
 *   3. 尝试读回该文件
 *   4. 尝试删除该文件（清理）
 *
 * 输出 JSON，一次打开即可判断「提交失败/网络异常」是否由数据存储配置导致。
 * 若 steps.put=false：数据写入链路有问题（最常见：站点未在 Netlify 部署函数 / Blobs 未开通）。
 * 若全部 true，数据链路正常，问题在前端上传环节。
 */
import { connectLambda, getStore } from '@netlify/blobs';

const STORE = 'formal-data';

export async function handler(event) {
  // v1 函数需手动接线 Netlify Blobs 环境上下文
  try { connectLambda(event); } catch (e) { /* 忽略 */ }

  const out = {
    ok: false,
    platform: 'netlify',
    env: {
      deepseekKeySet: !!process.env.DEEPSEEK_API_KEY,
      formalExportTokenSet: !!process.env.FORMAL_EXPORT_TOKEN,
    },
    steps: {},
    ts: new Date().toISOString(),
  };

  try {
    const store = getStore(STORE);
    const key = `health-probe-${Date.now()}.json`;

    // 1) 写入
    try {
      await store.set(key, JSON.stringify({ probe: true, t: Date.now() }));
      out.steps.put = { ok: true };
    } catch (e) {
      out.steps.put = { ok: false, error: String((e && e.message) || e) };
    }

    // 2) 读回
    if (out.steps.put && out.steps.put.ok) {
      try {
        const txt = await store.get(key, { type: 'text' });
        out.steps.get = { ok: true, bytes: (txt || '').length };
      } catch (e) {
        out.steps.get = { ok: false, error: String((e && e.message) || e) };
      }
    }

    // 3) 清理探测文件
    if (out.steps.put && out.steps.put.ok) {
      try {
        await store.delete(key);
        out.steps.del = { ok: true };
      } catch (e) {
        out.steps.del = { ok: false, error: String((e && e.message) || e) };
      }
    }

    out.ok = !!(out.steps.put && out.steps.put.ok && out.steps.get && out.steps.get.ok);
    return { statusCode: 200, body: JSON.stringify(out) };
  } catch (err) {
    out.error = String((err && err.message) || err);
    return { statusCode: 200, body: JSON.stringify(out) };
  }
}
