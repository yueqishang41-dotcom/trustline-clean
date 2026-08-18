# 预实验专用版本（Pilot Test Version）运行说明

> 独立于生产主站，通过 `pilot.html` 多页面入口加载，**生产主站 `index.html` 完全不受影响**。
> 全部预实验代码位于 `src/pilot/` 目录。

---

## 一、如何运行

### 方式 A：本地开发（Vite dev server）

```bash
npm install        # 首次安装依赖
npm run dev        # 启动开发服务器 http://localhost:3000
```

浏览器访问预实验页面：

```
http://localhost:3000/pilot.html
```

生产主站仍在：

```
http://localhost:3000/
```

### 方式 B：生产构建

```bash
npm run build      # 产物 dist/ 同时包含 index.html 与 pilot.html
npm run preview    # 预览 http://localhost:3000
```

### 方式 C：部署（Vercel / Netlify）

直接推送到现有仓库即可。`vercel.json` / `netlify.toml` 已新增 `/pilot.html` 路由例外，
保证 SPA 兜底重写不会吞掉预实验页面。部署后访问：

```
https://你的域名/pilot.html
```

---

## 二、如何配置云端接收接口 URL

数据上传端点通过环境变量 `VITE_PILOT_DATA_ENDPOINT` 配置（Vite 前端环境变量）。

### 本地开发

在 `杯子/` 目录新建 `.env.local`：

```bash
VITE_PILOT_DATA_ENDPOINT=https://你的接收端点地址
```

`.env.local` 已被 `.gitignore` 排除，不会上传仓库。

### Vercel 部署

Settings → Environment Variables 添加：

```
Key:   VITE_PILOT_DATA_ENDPOINT
Value: https://你的接收端点地址
```

### Netlify 部署

Site settings → Environment variables 添加同名变量。

### Netlify 收集器（推荐，完整数据自动入库）

预实验完整数据（含**逐题作答、逐题得分、全量行为日志**）默认用 Netlify 函数收集，
存进免费云存储 Netlify Blobs，之后一键导出 CSV / JSON 用于统计分析。飞书消息保留作实时监控。

**1. 环境变量（Netlify → Site settings → Environment variables）**

| Key | Value | 说明 |
|-----|-------|------|
| `VITE_PILOT_DATA_ENDPOINT` | `/.netlify/functions/pilot-collect` | 前端把完整 Payload 发给收集器 |
| `PILOT_FEISHU_WEBHOOK` | `https://open.feishu.cn/open-apis/bot/v2/hook/…` | 服务器端转发飞书摘要（监控） |
| `PILOT_FEISHU_KEYWORD` | `汇报`（可选，默认值即 `汇报`） | 与飞书机器人自定义关键词一致 |
| `PILOT_EXPORT_TOKEN` | 自定一串字符（**强烈建议设置**） | 保护导出接口，下载时需带 `?token=` |
| `PILOT_COLLECT_TOKEN` | 自定一串字符（可选） | 防陌生人刷数据；设置后须同步设置 `VITE_PILOT_COLLECT_TOKEN` 为同值 |

> `PILOT_` 开头的变量只在服务器端使用，不会泄露到浏览器；`VITE_` 开头会被打进构建产物。

**2. 重新部署**

配完变量后到 Deploys → **Deploy site → Clear cache and deploy site**。

**3. 验证**

走完一遍预实验，飞书应收到 `【汇报】…` 摘要（说明已存储成功）。可在浏览器地址栏直接打开导出接口确认数据已入库：

```
https://你的站点.netlify.app/.netlify/functions/pilot-export?token=你的PILOT_EXPORT_TOKEN
```

**4. 导出数据**

| 链接 | 得到什么 |
|------|---------|
| `…/pilot-export?token=…` | 宽表 CSV：每人一行，含核心对齐字段 + 模块A逐题得分/动作标志/**参考答稿/AI初稿/被试最终文本** + 模块B逐题 + 全量行为日志（可直接用 Excel/SPSS 打开） |
| `…/pilot-export?format=json&token=…` | 完整 JSON 数组（最高保真，供 R / Python / SPSS 深加工） |

> 若未设置 `PILOT_EXPORT_TOKEN`，导出链接无需 `?token=`（不建议在生产收集数据时省略）。
> 数据存在 Netlify Blobs，可随时重复导出，不会丢。

**5. 人工依据 Rubric 打分（ICC 一致性检验）**

CSV 宽表已为模块 A 每题内置人工打分所需全部要素，抽 20% 样本可直接人工阅卷：

| 每列组 | 内容 |
|--------|------|
| `{题号}__answer` | 参考答稿（正确输出，判 correct 维度的标准） |
| `{题号}__draft` | AI 初稿（被试拿到的原文） |
| `{题号}__final_text` | **被试最终提交文本全文**（人工阅读打分的核心） |
| `{题号}__edit` / `act_evidence` / `act_template` / `act_regen` | 行为动作标志（编辑/查材料/看规范/微调），用于判 evidence/compliance 维度 |

人工对每份样本按 Rubric 打分后，与 CSV 中 AI 的逐题分（`{题号}__correctness` 等）做 ICC 一致性分析。
> JSON 导出中也含完整 `moduleA.responses[].editedText`（每份原始作答），可作为人工打分的原始凭证。

**⚠ 历史数据 act_regen 为 0 的处理（2026-08-11 前的数据）**

旧版本用「微调框是否打开」记录 `act_regen`，导致能量扣了但该列全为 0。
真实使用微调的题目可从全量行为日志反查（`regenerate_prompt` 条目含 `questionId`）。

**一键补回（推荐，直接产出修正后的分析表）：**

```bash
# ① 下载当前导出（浏览器打开导出链接保存）
#    https://你的站点.netlify.app/.netlify/functions/pilot-export?token=你的TOKEN
#    以及 ?format=json 那份
# ② 补回 act_regen（输出 <原文件>-fixed.csv，其余列原样保留）
python tools/fix_act_regen.py pilot-data.csv                  # → pilot-data-fixed.csv
python tools/fix_act_regen.py pilot-data.csv -o 修正后.csv    # 或指定输出文件名
#    也支持直接修 JSON 导出（重写 actionsUsed.regenerate）：
python tools/fix_act_regen.py pilot-data.json
```

**核对 / 逐人排查（可选）：**

```bash
python tools/recover_regen_usage.py pilot-data.json   # 打印每个被试实际用微调的题目清单 + 能量校验
```

> 说明：能量扣费日志（`regenerate_prompt`）从来都是完整保存的，所以旧数据
> 一定能恢复。只有 `act_regen` 列受影响；`act_evidence` / `act_template` 旧数据本来就对。
> 恢复出的标记语义 = 该题扣过微调能量 = 与被试总精力消耗完全对齐（2026-08-11 已确认）。

**新数据（修复后）：** `act_regen` 以每题扣费记录为准，无需任何后处理。
（该 bug 已于 2026-08-11 修复，预实验版与生产版同步推送。）

## 五、定时关闭预实验入口

名额已满时可按指定时间自动关闭 `pilot.html` 入口（数据收集器/导出接口不受影响，在测被试数据照常入库）。

**设置关闭时间（二选一）：**

```js
// src/pilot/pilotGate.js
export const PILOT_CLOSE_AT = '2026-08-11T23:59:00+08:00'; // 改这一行，push 后自动生效
```

或配环境变量 `VITE_PILOT_CLOSE_AT`（ISO 时间）+ Clear cache and deploy。设为 `null` 表示不关闭。

**到点后行为：**

| 策略 | 效果 |
|------|------|
| 默认（推荐） | 新访客/未开始者看到「预实验已结束」页；已在作答中的被试可做完提交 |
| 硬关闭（`pilotGate.js` 里 `PILOT_HARD_CLOSE=true`） | 除完成感恩页外全部显示关闭页（在测被试会被截断，未提交数据可能丢失） |

> 关闭只拦测试入口，`.netlify/functions/pilot-collect` 与 `pilot-export` 始终运行。

### 端点格式要求

系统会向该地址发送 `POST` 请求，`Content-Type: application/json`，
Body 为完整 Payload（见下），你的接收端需能接收 JSON POST。

支持以下常见端点：
- **飞书 Webhook**（`https://open.feishu.cn/open-apis/bot/v2/hook/你的TOKEN`）— 自动兼容，见下
- **Formspree**（`https://formspree.io/f/你的表单ID`）
- **自定义后端接口**（任一可接收 JSON POST 的 URL）

> **未配置端点时**：系统跳过上传。上传失败时，数据会**暂存在被试浏览器 localStorage**，
> 下次打开页面自动补传（被试完全无感）。**被试端绝不触发任何浏览器下载**。

### 飞书 Webhook（自动兼容）

当 `VITE_PILOT_DATA_ENDPOINT` 指向 `open.feishu.cn` 时，代码自动把 Payload
封装成飞书消息格式（`{msg_type, content}`），内容为 **精简摘要 + 完整 CSV**，
过长自动分条发送，无需任何代码改动。

飞书机器人侧若开启「自定义关键词」安全校验，**每条消息正文必须包含该关键词**：

| 项目 | 值 |
|------|-----|
| 默认关键词 | `汇报`（消息正文以 `【汇报】` 开头） |
| 覆盖关键词 | 环境变量 `VITE_PILOT_FEISHU_KEYWORD`（须与飞书机器人设置一致） |

> 建议飞书侧选择「自定义关键词」而非「加签/IP白名单」：关键词最省事，
> 且系统已默认带上；「加签」需额外签名逻辑，「IP 白名单」因被试 IP 不固定不适用。

---

## 三、预实验版功能清单

---

## 三、预实验版功能清单

| 功能 | 实现位置 |
|------|---------|
| A/B/C 固定试卷拆分（dsh/hr/zxy 各 6A+10B） | `src/pilot/pilotPaper.js` |
| 三保险分流：URL `?form=X` 硬指定 → 时间戳轮询 | `src/pilot/pilotStore.jsx` `assignFormType()` |
| 20 点精力 + 材料包/规范解锁 + Jaccard 评分 + RES + 行为日志 | 复用生产评分引擎 `src/utils/scoringEngine.js` |
| 模块 A 呈现顺序随机化 | `src/pilot/pilotPaper.js` |
| 精力扣除二次确认弹窗（防误触） | `src/pilot/components/PilotConfirmModal.jsx` |
| 极简指导语 + 模块 B 过渡页 | `src/pilot/pages/` |
| 切屏监控（page_blur）+ 大段粘贴监控（bulk_paste） | `src/pilot/pilotStore.jsx` |
| 云端静默上传（3 次重试 + localStorage 暂存自动补传，无下载） | `src/pilot/pilotUpload.js` |
| 极简感恩完成页（屏蔽分数/维度/画像） | `src/pilot/pages/PilotCompletionPage.jsx` |
| 对齐字段导出（Form_Type / Blur/Paste 计数 / 全量日志） | `src/pilot/pilotExport.js` |

### 分发链接示例（控制样本量）

主试可把以下三个链接分发给不同批次被试：

```
https://你的域名/pilot.html?form=A
https://你的域名/pilot.html?form=B
https://你的域名/pilot.html?form=C
```

无参数访问时系统按时间戳轮询（A→B→C 交替）自动分流，样本量趋近 1:1:1。

---

## 四、上传 Payload 字段（对齐结构）

```
subjectId, name, role, startTime, endTime, timeUsedSec,
formType (A/B/C), formLabel (Form_A/Form_B/Form_C),
pageBlurCount, bulkPasteCount,
scores: { scoreA, scoreB, resScore, totalScore, energyRemaining, dimensions },
moduleA: { questionsInfo, responses },
moduleB: { questionsInfo, responses },
behavioralLogs（全量行为日志）, behavioralLogsJson,
csvText（含全部对齐字段的 CSV 文本）
```
