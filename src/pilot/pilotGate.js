/**
 * 预实验关闭控制
 * ---------------------------------------------------------------
 * 到指定时间点自动关闭预实验入口：
 *   - 新访客 / 尚未开始测试的人 → 显示「预实验已结束」页面，无法开始
 *   - 已在作答中的被试 → 允许继续完成并提交，数据不丢（可在下方切换硬关闭）
 *
 * 如何设置关闭时间（二选一）：
 *   方式一（推荐）：改下面 PILOT_CLOSE_AT 这一行，push 后 Netlify 自动重新部署生效。
 *   方式二：在 Netlify 配环境变量 VITE_PILOT_CLOSE_AT（ISO 时间），改时只需 Clear cache and deploy。
 *   设为 null / '' / 空字符串 = 不关闭（当前默认）。
 *
 * 时间格式示例：'2026-08-11T23:59:00+08:00'（北京时间，+08:00 可改成被试所在时区）
 */
export const PILOT_CLOSE_AT = '2026-08-11T23:00:00+08:00'; // ← 在这里设置关闭时间，例如 '2026-08-11T23:59:00+08:00'

/**
 * 硬关闭开关：
 *   false（默认）= 挡新访客，允许已在作答中的被试做完提交；
 *   true         = 到点后除完成感恩页外全部显示关闭页（在测被试会被截断，未提交数据可能丢失）。
 */
export const PILOT_HARD_CLOSE = false;

const _configured =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PILOT_CLOSE_AT) || PILOT_CLOSE_AT || '';

/** 关闭时间的绝对毫秒数；null 表示未设置 */
export function pilotCloseTime() {
  const t = String(_configured).trim();
  if (!t) return null;
  const ts = new Date(t).getTime();
  return Number.isFinite(ts) ? ts : null;
}

/** 当前时刻是否已过关闭时间（配合测试可传入 now） */
export function isPilotClosed(now = Date.now()) {
  const t = pilotCloseTime();
  return t !== null && now >= t;
}

/** 预实验是否仍开放 */
export function isPilotOpen(now = Date.now()) {
  return !isPilotClosed(now);
}
