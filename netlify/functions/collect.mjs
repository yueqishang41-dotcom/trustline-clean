/**
 * 正式实验数据收集器（Netlify Function）。
 *
 * 浏览器把完整 Payload（含逐题作答/逐题得分/全量行为日志/切屏·粘贴计数）POST 到此函数：
 *   1. 校验必填字段（subjectId）
 *   2. 完整数据写入 Netlify Blobs（平台自带持久存储，store: formal-data），一份不丢
 *   3. 返回 ok（含存储 key）
 *
 * 前端端点：前端默认 POST /api/collect，由 netlify.toml 重写到本函数（同源，无需额外配置）。
 * 数据存储：Netlify Blobs 随站点自动开通，部署后即可用，无需配置任何环境变量。
 */
import { connectLambda, getStore } from '@netlify/blobs';

const STORE = 'formal-data';

export async function handler(event) {
  // v1 函数需手动接线 Netlify Blobs 环境上下文（从 event.blobs + 请求头注入）
  try { connectLambda(event); } catch (e) { /* 无 blobs 上下文时忽略，后续会明确报错 */ }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  try {
    // 解析 Payload（兼容 v1 字符串 / v2 自动解析对象）
    let payload = event.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload || '{}'); } catch { payload = {}; }
    }
    if (!payload || typeof payload.subjectId !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid payload' }) };
    }

    const store = getStore(STORE);
    const key = `subjects/${payload.subjectId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    await store.set(key, JSON.stringify(payload));

    console.log(`[collect] saved subject=${payload.subjectId} key=${key} bytes=${JSON.stringify(payload).length}`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, key }) };
  } catch (err) {
    // 关键失败信息写入 Netlify 函数日志（Functions → Logs），便于后台排查
    console.error(`[collect] FAILED: ${(err && err.message) || err}`);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String((err && err.message) || err) }) };
  }
}
