# OpenAaaS Client Web

OpenAaaS 的 **Web 版操作页面**，与桌面客户端 `client-app`（Tauri）共享同一套 Vue 3 前端代码，**不含 Tauri/Rust 模块**，可直接在浏览器中使用。

## 与 client-app 的关系

- 页面、状态管理（Pinia）、路由、样式（Tailwind）完全复用 `client-app/src`
- 差异仅在平台适配层：
  - `src/composables/useHttp.ts`：Tauri HTTP 插件 → 浏览器原生 `fetch`（跨域由 server 端 CORS 支持）
  - `src/views/TaskDetailView.vue`：Tauri 保存文件对话框 → 浏览器 Blob 下载

## 开发

```bash
npm install
npm run dev        # http://localhost:5174（/api 代理到 localhost:8080）
```

## 测试与构建

```bash
npm test           # vitest
npm run build      # 输出 dist/，可部署到任意静态服务器
```

## 使用

页面中添加服务器地址（如 `http://127.0.0.1:8080`）→ 点「注册」→ 两种认证方式：

- **统一认证登录（推荐）**：跳转到校园统一认证页面登录，密码不经过本系统；认证成功后自动带回到本站完成注册
- **账号密码**：直接在页面输入统一认证账号密码（RESTful 模式，与桌面客户端一致）

注册/登录已合并：首次使用自动注册，之后自动重签 API Key。
