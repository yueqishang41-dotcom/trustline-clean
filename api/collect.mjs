/**
 * 正式实验数据收集器（Vercel Serverless Function）。
 *
 * 浏览器把完整 Payload（含逐题作答/逐题得分/全量行为日志/切屏·粘贴计数）POST 到此函数：
 *   1. 校验必填字段（subjectId）
 *   2. 完整数据写入 Vercel Blob（key: subjects/<subjectId>-<ts>-<rand>.json），一份不丢
 *   3. 返回 ok（含 blob url）
 *
 * 需要一次性配置：在 Vercel 项目 Storage 中新建一个 Blob Store，
 * 并把生成的 BLOB_READ_WRITE_TOKEN 填入项目环境变量。
 *
 * 前端端点配置：VITE_FORMAL_DATA_ENDPOINT（默认 /api/collect，同源无需配置）。
 */
import { put } from '@vercel/blob';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    if (!payload || typeof payload.subjectId !== 'string') {
      return res.status(400).json({ ok: false, error: 'invalid payload' });
    }

    const key = `subjects/${payload.subjectId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    const blob = await put(key, JSON.stringify(payload), {
      // 存储为「私有」模式：必须用 private，否则 put 报 "Cannot use public access on a private store"
      // 私有 Blob 需 Token 才能读，导出端 /api/export 走 get() 内部自动带 Token，不受影响，且被试数据更安全
      access: 'private',
      addRandomSuffix: false,
      contentType: 'application/json',
    });

    console.log(`[collect] saved subject=${payload.subjectId} key=${key} bytes=${JSON.stringify(payload).length}`);
    return res.status(200).json({ ok: true, url: blob.url });
  } catch (err) {
    // 关键失败信息同时写入 Vercel 函数日志（Function Logs），便于后台排查
    const msg = String((err && err.message) || err);
    const hint = !process.env.BLOB_READ_WRITE_TOKEN
      ? '（BLOB_READ_WRITE_TOKEN 未配置，请在 Vercel → Settings → Environment Variables 添加并重新部署）'
      : '';
    console.error(`[collect] FAILED: ${msg} ${hint}`);
    return res.status(500).json({ ok: false, error: msg, hint });
  }
}
