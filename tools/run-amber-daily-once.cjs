/**
 * 单次执行「每日新闻+博客」批处理（不常驻、不启用 amber_engine 内置 cron）。
 * 供 crontab/systemd 调用，自托管静态站时配合 AMBER_NO_GIT_PUSH=1，避免推 Git / 不消耗 Netlify 构建。
 *
 * 例（每日 9:00 美东 → 用服务器本地时区换算）或简单每日一次：
 *   0 2 * * * cd /root/ai-report-generator && AMBER_DISABLE_CRON=1 AMBER_NO_GIT_PUSH=1 /usr/bin/node tools/run-amber-daily-once.cjs
 *
 * 补过去多天的 news+blog（按美东日历写 `date`）：见 tools/amber-catchup-days.cjs 或 npm run amber:catchup
 *
 * 若 Blog 日期在动而 News 长期停在旧日期：每日批里 news 先于 blog，news 失败时不会写新 news（常见原因：DeepSeek 配额/密钥、或 tech_radar_crawler 异常）。查本命令 stdout/stderr 或 PM2 日志。
 */
process.env.AMBER_DISABLE_CRON = '1';
process.env.AMBER_NO_GIT_PUSH = process.env.AMBER_NO_GIT_PUSH || '1';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { runDailyBatch } = require('../amber_engine.cjs');

runDailyBatch()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[run-amber-daily-once]', err);
        process.exit(1);
    });
