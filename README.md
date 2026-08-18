# Trustline · AI 监督校准测验

> 第二届全国大学生心理与认知智能测评挑战赛（厚粲杯）参赛作品

人机协同情境下个体对 AI 监督校准与合规执行力测验系统。

## 功能

- **模块 A**：沉浸式工作台任务（6 题）——审阅 AI 初稿、核查证据、编辑提交
- **模块 B**：微决策情境判断题（10 题）——四选一最优行动方案
- **精力点系统**：20 点初始精力，操作消耗不同点数，考察资源分配策略
- **RES 算法**：基于剩余精力的加权评分
- **自动数据保存**：完成后自动下载 CSV + JSON 双文件，可直接导入 SPSS

## 本地开发

```bash
npm install
npm run dev        # 前端 http://localhost:3000
node server.js     # AI 代理 http://localhost:3001 (可选)
```

## 部署到 Vercel（推荐）

1. 推送本目录到 GitHub
2. 在 [vercel.com](https://vercel.com) 导入该仓库（选择 杯子/ 文件夹）
3. 添加环境变量：
   ```
   DEEPSEEK_API_KEY = sk-你的key
   ```
4. 点击 Deploy

Vercel 会自动识别 `vercel.json` 与 `api/chat.mjs`，前端与 API 同域名部署。

## 部署到 Netlify

1. 推送本目录到 GitHub
2. 在 [netlify.com](https://netlify.com) 导入该仓库（选择 杯子/ 文件夹）
3. Site settings → Environment variables 添加：
   ```
   DEEPSEEK_API_KEY = sk-你的key
   ```
4. Deploy

## 数据说明

测验完成后浏览器自动下载两个文件：

| 文件 | 用途 |
|------|------|
| `AI_Supervision_Test_*.csv` | 逐题得分 + 三维度得分 + 抽题号，直接导入 SPSS |
| `AI_Supervision_Logs_*.json` | 全量行为日志、编辑记录，用于质性分析 |

## 技术栈

React 18 · Vite · TailwindCSS · Express（本地代理）· DeepSeek API
