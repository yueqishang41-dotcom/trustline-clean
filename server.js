/**
 * All-in-one Server — serves the built frontend + AI API proxy.
 *
 * Usage:
 *   1. npm run build          (构建前端)
 *   2. node server.js         (启动服务)
 *   3. 打开 http://你的IP:3000
 *
 * 环境变量: 在 .env 文件中设置 DEEPSEEK_API_KEY
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===== API 代理 =====
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'DEEPSEEK_API_KEY not configured. Set it in .env file.',
      });
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一位专业的职场AI助理。请根据用户的要求生成或修改工作文档。输出应专业、简洁、实用，使用中文。',
          },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek API error:', response.status, errText);
      return res.status(response.status).json({ error: `API error: ${response.status}` });
    }

    const data = await response.json();
    res.json({ content: data.choices[0].message.content });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== 前端静态文件 =====
const distPath = join(__dirname, 'dist');
app.use(express.static(distPath));

// 所有非 API 请求返回 index.html（SPA 支持）
app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

// ===== 启动 =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`  厚粲杯 · AI监督校准测验`);
  console.log(`  服务已启动`);
  console.log(`========================================`);
  console.log(`  本机访问:     http://localhost:${PORT}`);
  console.log(`  局域网访问:   http://<本机IP>:${PORT}`);
  console.log(`  API代理状态:  ${process.env.DEEPSEEK_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`========================================\n`);
});
