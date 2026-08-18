/**
 * Netlify Serverless Function — DeepSeek API 代理
 *
 * 网关保护：
 *  - 同步函数默认超时 10s（netlify.toml 已把本函数提到 26s）
 *  - 这里再用 AbortController 给上游 24s 主动超时，超时返回 504 而非被网关静默杀掉
 *  - 上游 502/503/429 等错误状态透传给前端，前端会自动重试一次
 */
const UPSTREAM_TIMEOUT_MS = 24000;

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // Netlify Functions v2 自动解析 JSON body（event.body 已是对象）；
    // v1 传的是字符串。这里兼容两种格式。
    let payload = event.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload || '{}');
      } catch {
        payload = {};
      }
    } else if (!payload) {
      payload = {};
    }

    const { messages } = payload;
    if (!messages || !Array.isArray(messages)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'messages array is required' }) };
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'DEEPSEEK_API_KEY not configured in Netlify env vars' }) };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    let response;
    try {
      response = await fetch('https://api.deepseek.com/v1/chat/completions', {
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
    } catch (e) {
      // 主动超时 → 返回 504，让前端可以识别并重试
      if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
        return { statusCode: 504, body: JSON.stringify({ error: 'AI 服务响应超时，请稍后重试' }) };
      }
      return { statusCode: 502, body: JSON.stringify({ error: `AI 服务连接失败：${e && e.message || 'network error'}` }) };
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errText = (await response.text().catch(() => '')).slice(0, 300);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `AI 服务出错（${response.status}）：${errText}` }),
      };
    }

    const data = await response.json();
    return { statusCode: 200, body: JSON.stringify({ content: data.choices[0].message.content }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
