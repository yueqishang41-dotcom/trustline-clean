/**
 * 正式版云端静默自动上传 + 本地暂存自动重试。
 *
 * 端点配置：环境变量 VITE_FORMAL_DATA_ENDPOINT（默认 /api/collect，Vercel 同源）。
 *   - 本地：新建 .env.local 写入  VITE_FORMAL_DATA_ENDPOINT=你的端点URL
 *   - Vercel：在平台 Environment Variables 里配置同名变量（一般无需，用默认即可）
 *
 * 数据只进不收：被试浏览器永不下载文件。上传失败时把完整 Payload 暂存到
 * localStorage，下次打开页面（flushPendingUploads）自动补传，完全无感。
 */
import { buildPayload } from './payload';

const ENDPOINT = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FORMAL_DATA_ENDPOINT) || '/api/collect';

// 上线诊断用：构建时把实际端点打进控制台，浏览器 F12 即可核对
console.warn('[upload] 数据上传端点 =', ENDPOINT);

const MAX_ATTEMPTS = 3;
const PENDING_KEY = 'trustline_formal_pending_uploads';

export function getEndpoint() {
  return ENDPOINT;
}

/**
 * 真正把 payload 发往 /api/collect（Vercel Blob 收集器）。
 * pendingSave=true 时失败会把完整 payload 暂存 localStorage，供下次自动补传。
 */
async function uploadPayload(payload, { pendingSave = true } = {}) {
  if (!ENDPOINT) {
    return { ok: false, attempts: 0, backup: false, pending: false, reason: 'NO_ENDPOINT', endpoint: null };
  }

  let lastErr = null;
  let lastStatus = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return { ok: true, attempts: attempt, backup: false, endpoint: ENDPOINT };
      }
      lastStatus = res.status;
      lastErr = new Error(`HTTP ${res.status}`);
      // 服务器明确报错的（非网络抖动）不必空等全部重试：直接进入暂存
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        const reason = `HTTP ${res.status}（${ENDPOINT}）`;
        console.error('[upload] 上传失败(服务器明确报错):', reason);
        if (pendingSave) savePending(payload);
        return { ok: false, attempts: attempt, backup: false, pending: true, reason, endpoint: ENDPOINT };
      }
    } catch (e) {
      lastErr = e;
      console.error(`[upload] 上传第${attempt}次网络异常:`, e && e.message, '端点=', ENDPOINT);
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(1200 * attempt); // 递增退避：1.2s / 2.4s
    }
  }
  // 全部失败 → 暂存本地，下次打开页面自动补传（被试无感，不触发下载）
  if (pendingSave) savePending(payload);
  const reason = lastStatus ? `HTTP ${lastStatus}（${ENDPOINT}）` : ((lastErr && lastErr.message) || 'network error') + `（${ENDPOINT}）`;
  return { ok: false, attempts: MAX_ATTEMPTS, backup: false, pending: true, reason, endpoint: ENDPOINT };
}

/**
 * 上传一次完整作答（完成页调用）。
 * 返回 Promise<{ok:boolean, attempts:number, pending:boolean}>
 */
export async function uploadResults(results) {
  return uploadPayload(buildPayload(results));
}

/* ---------------- localStorage 暂存 + 自动补传 ---------------- */

function readPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function writePending(arr) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(arr)); } catch (e) {}
}

function savePending(payload) {
  const arr = readPending();
  arr.push(payload);
  writePending(arr);
}

/**
 * 补传所有暂存的上传失败数据（应用挂载时调用，静默）。
 * 成功则从暂存移除，失败则保留等待下次。返回本次成功补传条数。
 */
export async function flushPendingUploads() {
  const pending = readPending();
  if (!pending.length) return 0;
  const still = [];
  let sent = 0;
  for (const payload of pending) {
    const r = await uploadPayload(payload, { pendingSave: false });
    if (r.ok) sent++;
    else still.push(payload);
  }
  writePending(still);
  return sent;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
