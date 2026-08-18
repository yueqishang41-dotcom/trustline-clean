@echo off
rem =====================================================================
rem  正式测验 — 系统级机考模式启动脚本（Windows）
rem  用 Edge kiosk 模式打开测验网站：无地址栏/标签栏/关闭按钮，全屏锁定，
rem  配合网页内置的机考锁（全屏+快捷键拦截+离开警告），被试无法切到其他页面/程序。
rem
rem  使用前：把下面的 https://你的vercel域名/ 换成正式域名。
rem  退出机考：Ctrl+Alt+Del → 任务管理器 → 结束 msedge，或直接重启电脑。
rem =====================================================================

start msedge --kiosk --edge-kiosk-type=fullscreen --edge-kiosk-info=0 --no-first-run --no-default-browser-check https://trustline-gray.vercel.app/

exit
