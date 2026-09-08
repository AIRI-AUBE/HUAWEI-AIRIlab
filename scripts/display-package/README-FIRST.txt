AIRI DISPLAY - QUICK INSTALL
============================

AUTHORIZED INTERNAL PACKAGE. This build may contain a browser-embedded
credential. Send it only to the approved display computer. Do not forward it.

This package contains the finished website. It does not need Git, NVM,
the source code, npm install, or an .env file.

1. Extract the entire ZIP into a normal folder. Do not run files inside the ZIP.

2. Double-click check-windows-architecture.cmd.

3. Download and install Node.js 24 LTS:
   https://nodejs.org/en/download

   Select Windows Installer (.msi), then:
   - X64 when the architecture checker displays X64.
   - ARM64 when the architecture checker displays Arm64.

   npm is included with Node.js. Keep the installer's default options. If an
   "Install Additional Tools" window appears, close it; those tools are not needed.

4. Restart Windows after Node.js finishes installing.

5. Double-click start-display.cmd. If the
   launcher says Node.js is unavailable, restart Windows once and retry.

6. The AIRI Display server runs in the background. The website opens at
   http://localhost:3000. Double-click start-display.cmd again to reopen it.

If the black window shows an error, take a photo of the whole window and send it
to technical support.

CHECKING THE INSTALL
--------------------

Open PowerShell and run:

    node --version
    npm --version
    (Invoke-WebRequest "http://localhost:3000" -UseBasicParsing).StatusCode

The final command should display 200.

IF IMAGE UPLOAD FAILS
---------------------

1. Confirm that the browser address is exactly http://localhost:3000.
2. Double-click diagnose-upload.cmd (not diagnose-upload.ps1).
3. Wait for Notepad to open, then send AIRI-Diagnostic-Report.txt to technical
   support together with a photo of the upload error. Do not send the .ps1 file.

Expected report results:

- OVERALL RESULT: PASS and NEXT ACTION: CHECK_BROWSER_UPLOAD means Node,
  localhost, DNS, the API port, TLS, and CORS passed. Technical support
  should inspect the failed UploadMedia request in the browser.
- NEXT ACTION: START_LOCAL_SERVER means the local website was not
  reachable. Close old AIRI windows and run start-display.cmd again.
- NEXT ACTION: CHECK_API_NETWORK means the API DNS, port, TLS, or CORS
  check failed. Send the report to technical support.

The report does not upload an image and does not read or print the
authorization token.

NOTES
-----

- The application still needs network access to the API configured when
  this package was built. A company VPN may be required.
- Before replacing this package, restart Windows or end the AIRI node.exe
  process in Task Manager, then replace the package and start it again.
- If Windows Firewall asks about network access, you may cancel when the
  application is only used on this computer.


AIRI 展示端 - 快速安装
====================

这是经过授权的内部安装包，可能包含浏览器使用的认证信息。只能发送到指定的
展示电脑，请不要转发给其他人。

此安装包包含已经构建完成的网站。不需要安装 Git、NVM、源代码或项目依赖，
也不需要运行 npm install 或复制 .env 文件。

1. 将 ZIP 完整解压到普通文件夹。不要直接在 ZIP 压缩包里面运行文件。

2. 双击 check-windows-architecture.cmd，检查此电脑的系统架构。

3. 下载并安装 Node.js 24 LTS：
   https://nodejs.org/en/download

   选择 Windows Installer (.msi)，然后根据架构检查结果选择：
   - 如果显示 X64，请下载 Windows x64 安装程序。
   - 如果显示 Arm64，请下载 Windows ARM64 安装程序。

   npm 已经包含在 Node.js 中，不需要单独安装。安装时保留默认选项即可。
   如果出现“Install Additional Tools”黑色窗口，直接关闭，不需要安装。

4. Node.js 安装完成后，重启一次 Windows。

5. 双击 start-display.cmd。如果仍然提示找不到 Node.js，请拍摄完整黑色窗口。

6. AIRI Display 服务会在后台运行，网站会自动打开：http://localhost:3000。
   如果关闭了浏览器，再次双击 start-display.cmd 即可重新打开。

检查安装
--------

打开 PowerShell，然后运行：

    node --version
    npm --version
    (Invoke-WebRequest "http://localhost:3000" -UseBasicParsing).StatusCode

最后一条命令应该显示 200。

图片上传失败时
--------------

1. 确认浏览器地址必须是 http://localhost:3000。
2. 双击 diagnose-upload.cmd（不要点击 diagnose-upload.ps1）。
3. 等待记事本自动打开，将 AIRI-Diagnostic-Report.txt 和上传错误界面照片
   一起发送给技术人员。不要发送 .ps1 文件。

报告结果说明：

- 如果显示 OVERALL RESULT: PASS 和 NEXT ACTION: CHECK_BROWSER_UPLOAD，
  表示 Node、本地网站、DNS、API 端口、TLS 和跨域检查均已通过。
  技术人员需要在浏览器中检查失败的 UploadMedia 请求。
- 如果显示 NEXT ACTION: START_LOCAL_SERVER，表示本地网站无法访问。
  请关闭旧的 AIRI 窗口，然后重新双击 start-display.cmd。
- 如果显示 NEXT ACTION: CHECK_API_NETWORK，表示 API 的 DNS、端口、
  TLS 或跨域检查失败。请将报告发送给技术人员。

诊断报告不会上传图片，也不会读取或显示身份验证令牌。

注意事项
--------

- 应用仍然需要访问构建安装包时配置的 API 服务，可能需要连接公司网络或 VPN。
- 替换安装包前，请重启 Windows，或在任务管理器中结束 AIRI 的 node.exe
  进程，然后替换安装包并重新启动。
- 如果 Windows 防火墙询问是否允许网络访问，而应用只在本机使用，可以取消。
