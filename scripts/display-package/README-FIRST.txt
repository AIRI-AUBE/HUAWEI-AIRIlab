AIRI DISPLAY - QUICK INSTALL
============================

This package contains the finished website. It does not need Git, NVM,
the source code, npm install, or an .env file.

1. Double-click check-windows-architecture.cmd.

2. Download and install Node.js 24 LTS:
   https://nodejs.org/en/download

   Select Windows Installer (.msi), then:
   - X64 when the architecture checker displays X64.
   - ARM64 when the architecture checker displays Arm64.

   npm is included with Node.js. Keep the installer's default options.

3. Double-click start-display.cmd after the installer finishes. If the
   launcher says Node.js is unavailable, restart Windows once and retry.

4. Keep the minimized "AIRI Display Server" window running. The website
   opens at http://localhost:3000.

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
2. Double-click diagnose-upload.cmd and wait for Notepad to open.
3. Send AIRI-Diagnostic-Report.txt to technical support.

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
- Replacing files inside dist while the server is running is not
  recommended. Close the server window, replace the package, and restart.
- If Windows Firewall asks about network access, you may cancel when the
  application is only used on this computer.


AIRI 展示端 - 快速安装
====================

此安装包包含已经构建完成的网站。不需要安装 Git、NVM、源代码或项目依赖，
也不需要运行 npm install 或复制 .env 文件。

1. 双击 check-windows-architecture.cmd，检查此电脑的系统架构。

2. 下载并安装 Node.js 24 LTS：
   https://nodejs.org/en/download

   选择 Windows Installer (.msi)，然后根据架构检查结果选择：
   - 如果显示 X64，请下载 Windows x64 安装程序。
   - 如果显示 Arm64，请下载 Windows ARM64 安装程序。

   npm 已经包含在 Node.js 中，不需要单独安装。安装时保留默认选项即可。

3. Node.js 安装完成后，双击 start-display.cmd。如果启动程序提示找不到
   Node.js，请重启一次 Windows，然后再次双击启动。

4. 请保持最小化的“AIRI Display Server”窗口运行。网站会自动打开：
   http://localhost:3000

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
2. 双击 diagnose-upload.cmd，等待记事本自动打开。
3. 将 AIRI-Diagnostic-Report.txt 发送给技术人员。

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
- 不建议在服务器运行时替换 dist 文件夹中的文件。请先关闭服务器窗口，
  再替换安装包并重新启动。
- 如果 Windows 防火墙询问是否允许网络访问，而应用只在本机使用，可以取消。
