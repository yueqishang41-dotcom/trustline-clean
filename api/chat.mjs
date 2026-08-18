/**
 * Vercel Serverless Function — DeepSeek API 代理
 * 部署方式: 将 杯子/ 文件夹上传到 Vercel 即可
 *
 * 与本地 Netlify 版行为对齐（以本地为标准）：
 *  - 主动 24s 超时（AbortController）→ 返回 504，前端识别后自动重试一次
 *  - 上游 502/503 等错误状态透传给前端
 *  - config.maxDuration 60：避免 Vercel 默认 10s 把慢请求提前掐断（前端就收不到可识别的 504）
 */
export const config = { maxDuration: 60 };

const UPSTREAM_TIMEOUT_MS = 24000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured in Vercel env vars' });
    }

    // 上游请求：单次调用，主动 24s 超时（AbortController）
    const callUpstream = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
      try {
        return await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: '你是一位专业的职场AI助理。请根据用户的要求生成或修改工作文档。输出应专业、简洁、实用，使用中文。' },
              ...messages,
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    };

    // 高峰时段 DeepSeek 常快速返回 429/502/503/504：上游快速失败时自动重试一次（前后端共三次兜底）
    const RETRYABLE = [429, 500, 502, 503, 504];
    let response = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await callUpstream();
      } catch (e) {
        const isTimeout = e && (e.name === 'AbortError' || e.name === 'TimeoutError');
        if (attempt === 1) { await new Promise((r) => setTimeout(r, 600)); continue; }
        return res.status(isTimeout ? 504 : 502).json({
          error: isTimeout ? 'AI 服务响应超时，请稍后重试' : `AI 服务连接失败：${(e && e.message) || 'network error'}`,
        });
      }
      if (response.ok) break;
      if (RETRYABLE.includes(response.status)) {
        if (attempt === 1) { await new Promise((r) => setTimeout(r, 600)); continue; }
        break; // 第二次仍失败 → 透传错误状态给前端
      }
      break; // 非可重试状态 → 直接透传
    }

    if (!response) {
      return res.status(502).json({ error: 'AI 服务连接失败' });
    }
    if (!response.ok) {
      const errText = (await response.text().catch(() => '')).slice(0, 300);
      return res.status(response.status).json({ error: `AI 服务出错（${response.status}）：${errText}` });
    }

    const data = await response.json();
    res.json({ content: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
