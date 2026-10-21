# PCY · Folded Dream Letters

基于 https://github.com/jmiochvjk-hub/folded-dream-letters 克隆并修改。

本地保留原仓库的 Git 历史。`upstream` 指向原作者仓库，`origin` 指向 Cossy1012 自己的仓库。

## GitHub 仓库和网页

源码仓库：https://github.com/Cossy1012/folded-dream-letters

GitHub Pages：https://cossy1012.github.io/folded-dream-letters/

GitHub Pages 使用 `main` 分支的根目录。修改后提交并推送到 `origin/main` 即可更新网页；`.nojekyll` 保证按静态文件发布。

## Sites 备份网址

https://pcy-folded-blue-dreams.wavy-gem-0160.chatgpt.site

此前通过 Sites 发布的备份仍可公开访问。两个版本均使用明确标示的本机留言模式。
本次发布使用独立的 `../pcy-published-site` 项目；其 `.openai/hosting.json` 保留站点标识，网页文件位于该项目的 `dist` 目录。更新线上内容时，应同步修改到此发布项目并发布新版本。

## 已增加的功能

- 左上角品牌改为 PCY。
- 细雨特效及开关，记住开关选择；系统启用减少动态效果时默认关闭，后台标签页暂停动画。
- 独立留言板：昵称、300 字留言、时间、分页、刷新和错误提示。未配置数据库时明确显示“本机预览”，只在当前浏览器保存。
- 蓝色拍照亭：实时预览、内置与 USB 摄像头选择、设备列表自动和手动刷新、立即或 3/5/10 秒定时拍照，以及 PNG 下载和重拍。
- 九款纪念相框：蓝色信笺、奶油拍立得、复古胶片、星光纪念，以及五款 LOEY 透明人物合拍（原海报、比耶、爱心、笑脸、玫瑰）。拍摄前可预览，拍摄后可给同一张照片更换相框再下载。
- LOEY 人物相框使用用户提供图片抠出的透明 PNG（`assets/loey-*-cutout.png`），实时预览与下载照片的位置一致。人物在左侧，访客可站在右侧合拍；输出为单张 1200 × 1050 PNG，也支持定时拍照。新人物素材在选择相应相框时加载，加载失败会提示并暂停该款拍摄，其他相框仍可使用。
- 纪念册共 31 张照片，新增的 8 张原图保存在 `assets/纪念册图片/loey-memory-20261021-01.jpg` 至 `08.jpg`，可点击看大图及左右切换。
- 倒计时可手动取消；切换设备、关闭相机、相机断开或离开页面也会取消定时，防止继续拍摄。切换后台或关闭页面会释放相机。

## 拍照和外接摄像头

1. 点击“开启相机”，允许浏览器使用相机。
2. 外接 USB 摄像头需先被电脑识别。连接后在“选择相机”中选中设备；若未出现，点击“刷新设备”。设备名称可能要授权后才显示。
3. 选择立即拍摄或 3/5/10 秒倒计时，再选择纪念相框，点击“拍一张”。倒计时期间可点击“取消定时”。
4. 拍摄后，相框选择会更新已拍照片，点击“下载纪念照”即可获得所选相框的 PNG。照片只在当前设备生成。

自动化测试用画布视频流模拟内置及 USB 摄像头，已检查定时、取消、相框导出、插拔和切换逻辑；真实外接硬件需连接到电脑后确认。

## 本机预览

在此仓库文件夹打开终端，执行：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

在浏览器打开 http://localhost:8765 。相机需浏览器授权，并通过 localhost 或 HTTPS 使用。照片在设备上生成，不上传服务器。直接双击 index.html 可以查看静态内容，但推荐用本机预览测试相机和留言。

## 开启所有访客共享的留言

原站使用 GitHub Pages，页面本身是静态文件。以下方案继续保留 GitHub Pages，用 Supabase 保存公开留言，不需要另写服务器。

1. 创建一个 Supabase 项目，在 SQL Editor 执行 `supabase/guestbook.sql`。
2. 在项目的 Connect 或 Settings → API Keys 中取得 Project URL 和 **Publishable key**（以 `sb_publishable_` 开头）。
3. 编辑 `site-config.js`：

   ```js
   window.PCY_CONFIG = Object.freeze({
     supabaseUrl: "https://你的项目.supabase.co",
     supabasePublishableKey: "sb_publishable_你的公开密钥"
   });
   ```

4. 重新打开网页；留言板标记应变为“公开留言”。用两个不同的浏览器发布和刷新，确认双方能看见同一条留言。
5. 将本仓库的文件部署到自己的 GitHub Pages，或在拥有原仓库写入权限时更新原仓库。无需构建步骤，保留 assets 目录与所有 JS/CSS 文件。

本机预览的留言不会自动上传到公开数据库。云端失败时页面会保留输入并提示重试，不会把失败的公开留言悄悄存到本机。

SQL 开启 RLS，只允许公开读取和新增，限制内容长度，禁止访客更新、删除、指定 ID 或时间。管理员可在 Supabase Table Editor 删除不合适的留言。前端仅使用公开密钥，不可填入 Secret key 或 service_role key。此版本不含验证码或自动内容审核。

数据库未创建前，已验证的是前端及模拟接口；真实 Supabase 连通性和 SQL 策略需按上述第 4 步验证。

参考：[Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)、[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[浏览器相机 API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)。
