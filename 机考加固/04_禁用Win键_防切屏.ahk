; 机考加固：屏蔽 Win 键 / Win 组合 / Alt+Esc / Ctrl+Esc（切出路径）
; 前提：本机需安装 AutoHotkey（免费，https://www.autohotkey.com/）。
; 用法：进入被试专用账户后双击本脚本（或放入"启动"文件夹让其自启），机考结束右键托盘图标退出。
; 说明：脚本是后台进程，被试若经 Ctrl+Alt+Del 之外路径杀掉它，另一重网页锁 + 日志仍在兜底。

#NoTrayIcon
; 屏蔽左右 Win 键
LWin::return
RWin::return
; 屏蔽常见 Win 组合（含 Win+Tab 任务视图、Win+D 桌面、Win+L 锁屏、Win+E 资源管理器、Win+R 运行、Win+A 操作中心、Win+S 搜索）
#Tab::return
#D::return
#L::return
#E::return
#R::return
#A::return
#S::return
; 屏蔽 Alt+Esc / Ctrl+Esc（循环切换 / 打开开始菜单）
!Esc::return
^Esc::return
