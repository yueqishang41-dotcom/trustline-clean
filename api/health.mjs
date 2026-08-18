/**
 * 正式实验数据链路自检端点（诊断用）。
 *
 * 浏览器直接打开 /api/health 即可：
 *   1. 报告 BLOB_READ_WRITE_TOKEN 环境变量是否已配置（不泄露值）
 *   2. 尝试向 Blob 写入一个微型探测文件
 *   3. 尝试读回该文件
 *   4. 尝试删除该文件（清理）
 *
 * 输出 JSON，一次打开即可判断「提交失败/网络异常」是否由 Blob 配置导致。
 * 若 put=false：数据写入链路有问题（最常见原因：BLOB_READ_WRITE_TOKEN
 * 未配置 / 配置成只读 / 未重新部署）。若全 true，问题在前端上传链路。
 */
import { put, get, del } from '@vercel/blob';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  const out = {
    ok: false,
    env: { blobReadWriteTokenSet: !!process.env.BLOB_READ_WRITE_TOKEN },
    steps: {},
    ts: new Date().toISOString(),
  };
  try {
    const key = `health-probe-${Date.now()}.json`;
    // 1) 写入
    try {
      const blob = await put(key, JSON.stringify({ probe: true, t: Date.now() }), {
        access: 'private',
        addRandomSuffix: false,
        contentType: 'application/json',
      });
      out.steps.put = { ok: true, url: blob.url };
    } catch (e) {
      out.steps.put = { ok: false, error: String((e && e.message) || e) };
    }

    // 2) 读回（v2 SDK：私有 Blob 传 access 选项，结果用 stream 读）
    if (out.steps.put && out.steps.put.ok) {
      try {
        const r = await get(out.steps.put.url, { access: 'private', useCache: false });
        if (!r || !r.stream) throw new Error('get 返回空');
        const txt = await new Response(r.stream).text();
        out.steps.get = { ok: true, bytes: txt.length };
      } catch (e) {
        out.steps.get = { ok: false, error: String((e && e.message) || e) };
      }
    }

    // 3) 清理探测文件
    if (out.steps.put && out.steps.put.ok) {
      try {
        await del(out.steps.put.url);
        out.steps.del = { ok: true };
      } catch (e) {
        out.steps.del = { ok: false, error: String((e && e.message) || e) };
      }
    }

    out.ok = !!(out.steps.put && out.steps.put.ok && out.steps.get && out.steps.get.ok);
    return res.status(200).json(out);
  } catch (err) {
    out.error = String((err && err.message) || err);
    return res.status(200).json(out);
  }
}
