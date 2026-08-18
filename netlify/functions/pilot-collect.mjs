/**
 * 预实验数据收集器（Netlify Function）。
 *
 * 浏览器把完整 Payload（含逐题作答/逐题得分/全量行为日志）POST 到此函数：
 *   1.（可选）鉴权：若设置环境变量 PILOT_COLLECT_TOKEN，请求头须带 x-collect-token
 *   2. 完整数据写入 Netlify Blobs（免费持久存储，store: pilot-data），一份不丢
 *   3.（可选）若设置 PILOT_FEISHU_WEBHOOK，服务器端转发一条飞书摘要（实时监控）
 *
 * 前端端点配置：VITE_PILOT_DATA_ENDPOINT=/.netlify/functions/pilot-collect
 */
import { connectLambda, getStore } from '@netlify/blobs';

const STORE = 'pilot-data';

export async function handler(event) {
  // v1 函数需手动接线 Netlify Blobs 环境上下文（从 event.blobs + 请求头注入）
  try { connectLambda(event); } catch (e) { /* 无 blobs 上下文时忽略，后续会明确报错 */ }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  try {
    // 1) 可选鉴权（防陌生人刷数据；未配置则开放）
    const collectToken = process.env.PILOT_COLLECT_TOKEN;
    const auth = (event.headers['x-collect-token'] || '').trim();
    if (collectToken && auth !== collectToken) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'unauthorized' }) };
    }

    // 2) 解析 Payload（兼容 v1 字符串 / v2 自动解析对象）
    let payload = event.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload || '{}'); } catch { payload = {}; }
    }
    if (!payload || typeof payload.subjectId !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid payload' }) };
    }

    // 3) 写入 Netlify Blobs（持久化存储）
    const store = getStore(STORE);
    const key = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await store.set(key, JSON.stringify(payload));

    // 4) 服务器端转发飞书摘要（失败不影响存储结果）
    const feishuWebhook = process.env.PILOT_FEISHU_WEBHOOK;
    if (feishuWebhook) {
      try {
        const keyword = process.env.PILOT_FEISHU_KEYWORD || '汇报';
        await fetch(feishuWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msg_type: 'text',
            content: { text: buildSummary(payload, keyword) },
          }),
        });
      } catch (e) { /* 飞书失败可忽略，数据已在 Blobs 中 */ }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, key }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(err && err.message || err) }) };
  }
}

/** 飞书监控摘要（字段与前端 pilotUpload.js 保持一致） */
function buildSummary(p, kw) {
  const s = p.scores || {};
  const d = s.dimensions || {};
  const lines = [
    `【${kw}】`,
    `被试ID: ${p.subjectId || ''}`,
    `姓名: ${p.name || ''}`,
    `角色: ${p.role || ''}`,
    `卷型: ${p.formLabel || ('Form_' + (p.formType || 'A'))}`,
    `开始时间: ${p.startTime || ''}`,
    `结束时间: ${p.endTime || ''}`,
    `总耗时(秒): ${p.timeUsedSec ?? ''}`,
    `剩余精力: ${s.energyRemaining ?? ''}`,
    `切屏次数: ${p.pageBlurCount ?? 0}`,
    `大段粘贴次数: ${p.bulkPasteCount ?? 0}`,
    `A卷原始分: ${s.scoreA ?? ''}`,
    `B卷原始分: ${s.scoreB ?? ''}`,
    `RES分数: ${s.resScore ?? ''}`,
    `最终总分: ${s.totalScore ?? ''}`,
    `校准依赖维度: ${d.calibratedReliance ?? ''}`,
    `核验监督维度: ${d.verificationSupervision ?? ''}`,
    `合规边界维度: ${d.complianceBoundary ?? ''}`,
    '',
    '===== CSV 完整数据（含行为日志） =====',
    p.csvText || '',
  ];
  return lines.join('\n');
}
