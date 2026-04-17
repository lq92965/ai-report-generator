/**
 * PM2：在 193 上常驻 Amber（news/blog 每日批处理 + 可选 git push）
 *
 * 使用前请确认 cwd 与仓库路径一致（默认 /root/ai-report-generator）
 *
 *   pm2 start deploy/ecosystem.amber.config.cjs
 *   pm2 save
 *
 * 与「继续 push 到 GitHub」一致时：不要设置 AMBER_NO_GIT_PUSH。
 * 若仅写本地 Nginx 目录、不 push：在 env 中加 AMBER_NO_GIT_PUSH: '1'
 *
 * 自定义仓库路径：AMBER_REPO_ROOT=/var/www/html pm2 start deploy/ecosystem.amber.config.cjs
 */
const repoRoot = process.env.AMBER_REPO_ROOT || '/root/ai-report-generator';

module.exports = {
  apps: [
    {
      name: 'amber',
      cwd: repoRoot,
      script: 'amber_engine.cjs',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production',
        // 使用内置 cron（美东 9:00 每日 news+blog）
        AMBER_DISABLE_CRON: '0',
        // 不设 AMBER_NO_GIT_PUSH → runDailyBatch 结束时会 git push（与迁前 206 行为一致）
      },
    },
  ],
};
