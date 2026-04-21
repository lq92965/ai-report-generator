/**
 * 为「过去若干天」各补跑一批 news+blog（每批与 runDailyBatch 相同：1 篇 news + 1 篇 blog），
 * 列表里的 `date` 使用美东日历上的那一天（与正常每日批一致的可读日期）。
 *
 * 须在仓库根 .env 已配置 DEEPSEEK / GEMINI 等；注意 API 费用与速率限制。
 *
 * 用法（建议先 dry-run 理解天数）:
 *   cd /root/ai-report-generator
 *   AMBER_NO_GIT_PUSH=1 node tools/amber-catchup-days.cjs 2
 * 表示：为美东「今天」往前数第 2 天、第 1 天各跑一批（不含今天）。
 *
 * 若只想补「今天」这一批，用: npm run amber:once  或  node tools/run-amber-daily-once.cjs
 */
process.env.AMBER_DISABLE_CRON = '1';
process.env.AMBER_NO_GIT_PUSH = process.env.AMBER_NO_GIT_PUSH || '1';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { runDailyBatch } = require('../amber_engine.cjs');

/** YYYY-MM-DD for the instant `d` interpreted in America/New_York */
function nycCalendarDate(d) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(d);
}

async function main() {
    const n = Math.min(14, Math.max(1, parseInt(process.argv[2], 10) || 1));
    console.log(`[amber-catchup] Will run ${n} batch(es), oldest → newest (NYC calendar dates).`);

    for (let offset = n; offset >= 1; offset--) {
        const d = new Date(Date.now() - offset * 86400000);
        const dateStr = nycCalendarDate(d);
        process.env.AMBER_ARTICLE_DATE = dateStr;
        console.log(`[amber-catchup] --- batch for date=${dateStr} ---`);
        await runDailyBatch();
        delete process.env.AMBER_ARTICLE_DATE;
        if (offset > 1) await new Promise((r) => setTimeout(r, 8000));
    }

    console.log('[amber-catchup] Done.');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[amber-catchup]', err);
        process.exit(1);
    });
