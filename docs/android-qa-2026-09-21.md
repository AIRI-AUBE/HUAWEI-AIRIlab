# Huawei AIRI APK QA — 2026-09-21

结论：当前包适合受控、短时内部测试，尚不满足长期安装或公开分发条件。最优先问题是包内 token 将于北京时间 2026-09-21 21:30:49 到期，且没有登录/刷新机制。本次未修改产品代码或重新生成 APK。

## 检查对象与方法

- 文件：Huawei-AIRI-20260921-183800-test.apk，80,643,384 字节（80.64 MB / 76.91 MiB）。
- SHA-256：4591f0bce4ff6e7d02e516eed25cf3338cfe5db65491818d9a5bf8bed882e5d0。
- 包名 com.airilab.huawei.display，versionCode 1，versionName 0.1.0-test.1，minSdk 24，targetSdk 36。
- 重跑 TypeScript 检查及 27 项契约测试，全部通过；重验 APK v2 签名和 zipalign，均通过。
- 从 APK 中提取实际打包的网页资源，用桌面 Chromium 运行模拟接口流程，所有真实 API 请求均被拦截，不消耗生成额度。该测试不等同于 Android WebView 或 HarmonyOS 真机测试。
- 当前 ADB 无设备；未完成真机安装、系统安全扫描、原生文件选择器、系统键盘、返回键、后台恢复、真实生成和原生内存测量。
- 上一轮 Android assembleDebug / lintDebug 已通过；保留 32 个警告，不能称为零警告版本。

## 已验证功能

| 项目 | 结果 |
| --- | --- |
| 文生图 | 包内页面完成提交、轮询和显示模拟结果；workflow 44 正确 |
| 图生图 | 选取底图、参考图后完成模拟上传和生成；workflow 39、megapixels=2 正确 |
| 401 认证错误 | 显示失败，按钮可再次提交；没有自动续期 |
| 断网 | 显示请求失败；中文界面仍出现英文错误文案 |
| 语言 | 中英文切换及刷新后保存正常；首次安装默认英文 |
| 脚本异常 | 模拟流程中未捕获到未处理 JavaScript 异常 |
| 资源 | 上一轮验证 101 个 dist 文件均在 APK 内；本轮包内资源正常加载 |

## 必须先解决

### P1 — 认证不能长期工作，且凭据可被提取

实际 APK 的 JS 中可找到与当前环境文件一致的认证 token。本报告不记录其值。其 JWT exp 字段为 2026-09-21 13:30:49 UTC，即北京时间当天 21:30:49；检查时尚未到期。这里只解码有效期，未验证服务端对该 token 的实际接受状态。

代码每次读取构建时环境值，没有刷新、重新登录或设备授权流程。到期后重新安装同一个包无效。APK 没有原始 .env 文件，也没有 source map，但这不妨碍从 JS 提取凭据。正式签名、混淆或把 token 移入原生代码也不能把客户端长期共享凭据变成秘密。

建议采用可撤销的设备授权/登录、短期访问凭据及受控续期；共享服务端密钥留在服务端，并限制设备权限、额度和请求频率。不能用无限期共享 token 解决长期部署问题。

### P1 — 当前为 Debug 测试包

实际 manifest 包含 debuggable=true，签名证书为 Android Debug。签名验证只证明包的完整性，不代表已通过病毒检测或应用市场认证。正式分发需要专用、妥善保管的 release 签名，关闭应用及 WebView 调试，维护 versionCode。测试签名与发布签名不同，通常不能同包名直接覆盖，需安排卸载重装或独立测试包名；卸载会清除本地状态。

依据：[Android 发布准备](https://developer.android.com/studio/publish/preparing)、[应用签名与更新](https://developer.android.com/studio/publish/app-signing)。

### P1 — Android 安装版本范围不等于网页兼容范围

安装清单允许 Android API 24 起；当前 Vite 8 默认构建基线为 Chrome 111 / Edge 111 / Firefox 114 / Safari 16.4，而 Capacitor 默认允许 Chromium WebView 60 或 Huawei WebView 10 起。CSS 还使用 dvh/lvh。旧系统可能安装成功但渲染失败；Huawei WebView 的产品版本号不能直接当 Chromium 内核版本号。

需要在目标 MatePad 记录 WebView 包版本/UA 并实测，然后对齐前端编译基线、CSS 回退及最低内核提示。不能仅凭 Android 7+ 的 minSdk 声称全机型兼容。

依据：[Capacitor 配置](https://capacitorjs.com/docs/config)、[Vite 浏览器兼容基线](https://vite.dev/guide/build.html)。

## 安装、下载和安全扫描

| 项目 | 判断与操作 |
| --- | --- |
| HarmonyOS 4.2 目标设备 | 华为官方文档包含该版本的外部应用安装路径；这支持继续做 APK 真机验证，不是已验证安装成功 |
| 安装路径 | 可信文件传入平板后，用文件管理安装；仅对实际使用的来源授权，完成后可关闭来源安装权限 |
| 当前交付链接 | Z: / SMB 是电脑本地共享盘路径，不是平板可直接扫码下载的 HTTPS 链接；可 USB/Huawei Share 传文件 |
| 后续下载分发 | 使用受控 HTTPS 下载地址，列出版本、大小、SHA-256、发布日期和安装说明；尚未建立该下载服务 |
| 升级 | 保持包名和签名一致，提高 versionCode，验收覆盖安装及状态保留 |
| 杀毒实测 | Defender 状态查询失败；自定义扫描返回 0x80004005，日志明确 Product/Feature disabled；机器注册了深信服 EDR，但未取得其按文件扫描报告。因此杀毒结果为“未完成”，不是“未发现病毒” |
| 公共扫描 | 未将含内部凭据的 APK 上传公共扫描服务；需要受控企业扫描和目标平板安装扫描 |
| 风险提示 | 来源未知/未上架提示和恶意软件命中不是一回事；若出现病毒/诈骗具体命中，应记录检测引擎、规则、包 hash 后排查，不以关闭保护作为验收方式 |

依据：[华为外部来源安装说明](https://consumer.huawei.com/cn/support/content/zh-cn00766399/)、[华为浏览器下载安装排查](https://consumer.huawei.com/cn/support/content/zh-cn00448892/)。

## 权限、网络和数据

- 实际 APK 仅声明 INTERNET 及 AndroidX 自有签名级接收器权限，没有麦克风、定位、通讯录、相机、全盘存储读取权限。文件选择由用户主动操作；原生选择器行为待真机验证。
- 网络安全配置禁止远端明文 HTTP，仅 localhost 例外；API 使用 HTTPS。http://localhost:3000 是壳内资源拦截来源，不是连接开发电脑的服务。
- 上传/生成/任务状态的 CORS 预检在上一轮通过；这不证明 token 有效，也不代表完整生成成功。
- 发现外部 Google Fonts 请求 fonts.googleapis.com。测试中阻断后页面可使用回退字体，但可能影响字体外观及首次加载；国内环境建议把有授权的字体随包分发。没有依赖 Google Play Services，不等于完全没有 Google 网络请求。
- FileProvider exported=false 是有利限制，但路径仍包含 external-path path="." 及 cache-path path="."，授权范围偏宽。建议缩为实际需要的应用图片/缓存子目录；本轮未证实可利用泄露。依据：[Android FileProvider 安全建议](https://developer.android.com/privacy-and-security/risks/file-providers)。
- npm audit --omit=dev 本次报告 0 项已知漏洞；该结果仅覆盖 npm 生产依赖，不覆盖 Android/Maven 依赖、恶意代码扫描、后端或设备风险。
- 结果/任务主要保留在页面状态中，没有持久化恢复工作流；被系统杀进程或重启后无法依靠当前 UI 恢复任务。展示给不同使用者时也需要明确清理上一次输入和结果的流程。

## 空间与内存

- APK 80.64 MB，ZIP 各条目未压缩大小合计 82.35 MiB。后者不等于安装占用：系统还会产生编译文件、WebView 数据和缓存。
- 建议预留至少 500 MB、现场按 1 GB 余量准备；这是运维余量建议，不是实测硬性最低要求。用户照片显示当时可用空间 221.74 GB，按该快照容量充足。
- 背景 JPEG 单文件 18.49 MiB，尺寸 5850×3889；按 RGBA 一份解码缓冲估算约 86.8 MiB，实际内存还受浏览器缩采样和 GPU 缓冲影响。建议生成适合屏幕的等比例资源，保留裁切、华为标志和红色不变。
- 20 个 figma 资源未在打包 JS/CSS/HTML 中发现字面量引用，合计约 19.91 MiB，包含设计参考图和旧素材。是清理候选，删除前仍需核对动态引用；未在本次 QA 中删除。
- 上传配置没有统一文件字节数/输入像素上限。参考图虽会缩至最多 2048×2048，但发生在原图解码之后；底图没有相同像素限制。建议先做大小限制，再限并发/缩图，并在真机重复选择大图观察内存。

## 屏幕与通用性

实测的是 CSS 视口，不是屏幕物理像素。2560×1600 面板的实际 CSS 视口由系统缩放和 WebView 决定。

| 视口 | 本轮结果 |
| --- | --- |
| 1280×800 | 横屏布局与生成按钮可见；模板白字清晰 |
| 1024×640 | 预览完整，表单独立滚动，生成按钮位于 y=561–601 |
| 1280×440 | 缩短视口后生成按钮仍可见；仅模拟键盘挤压，不等于真机键盘测试 |
| 800×1280 | 预览右边界 880，超出视口 80 px，被裁切 |
| 640×400 | 预览和生成按钮超出可见区，不适合窄屏手机/小分屏 |

分类按钮约 37×29 CSS px、文字 10 px，标签约 75×34，生成按钮高 40 px；触控目标应按设备缩放核验，并尽量达到 Android 建议的 48dp。可扩大点击区域，避免更改既有品牌颜色。依据：[Android 触控目标](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views)。

APK 没有 lib/ 原生 .so，不绑定单一 CPU ABI；这不能替代系统/WebView 兼容性测试。当前只面向横屏 Android 兼容环境；不是 HarmonyOS NEXT 原生 HAP，也没有验证 HarmonyOS 5+ 的运行方案。Android 16 大屏可能不遵守锁定方向，更需要响应式处理。

当前没有明确的“保存原图到相册/下载”入口，只有结果预览。若交付范围包含图片保存，需要另行实现并验收，不能假定 WebView 长按等价于浏览器下载。

## 发布前顺序

1. 解决设备认证与续期，再使用 release 签名构建，关闭调试。
2. 对齐 WebView 支持基线；收紧文件共享目录；本地字体、素材瘦身、上传上限。
3. 目标 MatePad 完成首次安装/覆盖安装、原生选图、横屏与键盘、一次真实文生图/图生图、断网恢复、退后台/杀进程、持续运行和缓存观察。
4. 获取企业扫描及平板安装扫描结果，再通过受控下载地址交付。

本轮证据：交付目录 QA 子目录中的 browser-results.json 与截图；本机完整隔离测试脚本及提取资源位于 D:/codex-home/android-qa-20260921。模拟生成截图使用包内样例作为返回结果，不是真实生成样本。
