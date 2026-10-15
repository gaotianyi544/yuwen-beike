# AI 大模型接入部署

本站通过 Cloudflare Worker 的 `/api/ai` 接口调用大模型。当前优先使用 DeepSeek Responses API，并可保留 OpenAI 作为备用。API Key 只配置在 Cloudflare 服务端，不能写进 `app.js`、HTML 或 GitHub。

## Cloudflare 控制台配置

如果控制台提示“Variables cannot be added to a Worker that only has static assets”，说明线上版本仍是纯静态部署。先在项目目录运行 `npx wrangler deploy`，Wrangler 会同时部署 `worker.js` 和静态资源，把项目升级为 Worker + Static Assets。

1. 在本机项目目录运行 `npx wrangler login` 并完成浏览器授权。
2. 运行 `npx wrangler deploy`。
3. 运行 `npx wrangler secret put DEEPSEEK_API_KEY`，按提示粘贴 DeepSeek API Key；也可以打开部署后的 Worker，在 **Settings → Variables and Secrets** 中添加同名 Secret。
4. `DEEPSEEK_MODEL` 已在 `wrangler.jsonc` 中设置为 `deepseek-flash`，无需再手动添加。

部署完成后访问 `/api/health`。返回 `{"ok":true,"aiConfigured":true}` 表示接口和密钥均已配置。

## 本地开发

新建不会提交到 Git 的 `.dev.vars`：

```text
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_MODEL=deepseek-flash
```

然后运行：`npx wrangler dev`。
