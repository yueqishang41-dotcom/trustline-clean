/**
 * 机考模式（kiosk lock）
 *
 * 测验开始（模块A / 模块B / 完成页）后，把被试锁定在本页面：
 *   1. 请求全屏（隐藏地址栏 / 标签栏）
 *   2. 拦截常见"离开 / 调试 / 刷新 / 新开 / 关闭"快捷键（F12、Ctrl+W、Alt+← 等）
 *   3. 禁止右键菜单
 *   4. 关闭 / 刷新页面时弹窗确认（beforeunload）
 *   5. 切走再切回时：全屏回锁 + 红色覆盖层"已记录离开行为"（与行为日志联动威慑）
 *   6. 退出全屏（Esc / F11）时自动重新全屏
 *
 * 边界说明：纯网页无法拦截操作系统级快捷键（Alt+Tab、Ctrl+Alt+Del、Win 键、关闭浏览器）。
 * 正式实验建议配合系统级 kiosk（见 提交材料_定稿/正式实验_部署说明.md「机考模式」一节）。
 *
 * 调试逃生口：URL 带 ?kiosk=0 则完全不启用本模块（仅主试本机调试用）。
 */

const LOCKED_PHASES = ['moduleA', 'moduleB', 'completion'];

let locked = false;
let hasLeft = false;
let overlay = null;
let cleanupFns = [];

function kioskAllowed() {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get('kiosk') !== '0';
  } catch (e) {
    return true;
  }
}

/** 请求全屏（需在用户手势内调用才一定生效；非手势时静默失败，靠后续回锁兜底） */
export function requestKioskFullscreen() {
  if (!kioskAllowed()) return;
  try {
    if (document.fullscreenElement) return;
    const el = document.documentElement;
    const p = (el.requestFullscreen && el.requestFullscreen())
      || (el.webkitRequestFullscreen && el.webkitRequestFullscreen());
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) {}
}

function exitKioskFullscreen() {
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  } catch (e) {}
}

export function isKioskLocked() {
  return locked;
}

/* ---------------- 覆盖层：切走再切回 / 退全屏时显示 ---------------- */

function showLeaveOverlay() {
  if (!locked || overlay || !kioskAllowed()) return;
  overlay = document.createElement('div');
  overlay.setAttribute('data-kiosk-overlay', '1');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '2147483647',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(153, 27, 27, 0.97)', color: '#fff', fontFamily: 'sans-serif',
  });
  const title = document.createElement('div');
  title.textContent = '⚠ 检测到离开测试页面';
  Object.assign(title.style, { fontSize: '30px', fontWeight: '700', marginBottom: '12px' });
  const sub = document.createElement('div');
  sub.textContent = '该行为已被系统记录（计入行为日志）。请在作答期间保持停留在测验页面，不要切换页面或使用其他程序。';
  Object.assign(sub.style, { fontSize: '16px', maxWidth: '560px', textAlign: 'center', lineHeight: '1.7', marginBottom: '28px' });
  const btn = document.createElement('button');
  btn.textContent = '返回答题';
  Object.assign(btn.style, {
    padding: '12px 36px', fontSize: '17px', fontWeight: '600', border: 'none',
    borderRadius: '10px', background: '#fff', color: '#7f1d1d', cursor: 'pointer',
  });
  btn.addEventListener('click', () => {
    hideLeaveOverlay();
    requestKioskFullscreen();
  });
  overlay.appendChild(title);
  overlay.appendChild(sub);
  overlay.appendChild(btn);
  document.body.appendChild(overlay);
}

function hideLeaveOverlay() {
  if (overlay) { overlay.remove(); overlay = null; }
  hasLeft = false;
}

/* ---------------- 事件处理 ---------------- */

function isEditable(target) {
  if (!target) return false;
  const t = target.tagName || '';
  return t === 'INPUT' || t === 'TEXTAREA' || !!target.isContentEditable;
}

function handleKeyDown(e) {
  if (!locked) return true;
  const k = (e.key || '').toLowerCase();
  const ctrl = e.ctrlKey || e.metaKey;
  const alt = e.altKey;
  const shift = e.shiftKey;
  const combo = (ctrl ? 'c+' : '') + (alt ? 'a+' : '') + (shift ? 's+' : '') + k;

  // 调试台 / 新开页 / 关闭页 / 刷新 / 打印 / 保存 / 查看源代码 / 历史导航 / 开发者工具
  const BLOCKED = new Set([
    'f12', 'f5', 'f11',
    'c+r', 'c+w', 'c+n', 'c+t', 'c+p', 'c+s', 'c+u', 'c+h', 'c+j', 'c+o', 'c+l',
    'c+s+i', 'c+s+j', 'c+s+c', 'c+s+t', 'c+s+r',
    'a+arrowleft', 'a+arrowright', 'a+f4', 'a+home', 'a+end',
  ]);
  if (BLOCKED.has(combo) || k === 'f12') {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  // 输入框内保留正常编辑；非输入框 Backspace 防历史后退
  if (k === 'backspace' && !isEditable(e.target)) {
    e.preventDefault();
    return false;
  }
  if (k === 'f11') {
    e.preventDefault();
    requestKioskFullscreen();
  }
  return true;
}

function handleContextMenu(e) {
  if (locked) e.preventDefault();
}

function handleBeforeUnload(e) {
  if (locked) {
    e.preventDefault();
    e.returnValue = '';
  }
}

function handleFullscreenChange() {
  if (locked && !document.fullscreenElement) {
    requestKioskFullscreen();
    showLeaveOverlay(); // 试图退全屏也视为一次离开尝试
  }
}

function handleBlur() {
  if (locked) {
    hasLeft = true;
    requestKioskFullscreen();
  }
}

function handleVisibility() {
  if (!locked) return;
  if (document.visibilityState === 'hidden') {
    hasLeft = true;
  } else if (hasLeft) {
    requestKioskFullscreen();
    showLeaveOverlay();
  }
}

// 全屏兜底：锁定期内任何点击都尝试回全屏（覆盖"加载后无手势无法自动全屏"的情况）
function handleClick() {
  if (locked) requestKioskFullscreen();
}

/* ---------------- 开关 ---------------- */

export function setKioskLock(active) {
  if (active === locked) return;
  locked = active;

  cleanupFns.forEach((f) => f());
  cleanupFns = [];
  hideLeaveOverlay();

  if (locked && kioskAllowed()) {
    const add = (t, e, h, cap) => {
      t.addEventListener(e, h, cap);
      cleanupFns.push(() => t.removeEventListener(e, h, cap));
    };
    add(window, 'keydown', handleKeyDown, true);
    add(document, 'contextmenu', handleContextMenu);
    add(window, 'beforeunload', handleBeforeUnload);
    add(document, 'fullscreenchange', handleFullscreenChange);
    add(window, 'blur', handleBlur);
    add(document, 'visibilitychange', handleVisibility);
    add(document, 'click', handleClick);
    requestKioskFullscreen();
  } else if (!locked) {
    exitKioskFullscreen();
  }
}

export { LOCKED_PHASES };
