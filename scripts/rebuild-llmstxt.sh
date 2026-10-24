#!/bin/bash
# llms.txt / llms-full.txt 独立重建
# 解耦于 amber 引擎：即使 amber 停止写文章，AI 爬虫清单照常更新
# 由 crontab 每日调用，也可手动执行

cd /root/ai-report-generator || exit 1

NODE=/opt/node22/bin/node
[ -x "$NODE" ] || NODE=$(command -v node)

LOG=/var/log/llmstxt-rebuild.log
TS=$(date '+%Y-%m-%d %H:%M:%S %Z')

echo "[$TS] --- rebuild start ---" >> "$LOG"
OUT=$("$NODE" tools/generate-llmstxt.cjs 2>&1)
RC=$?
echo "$OUT" >> "$LOG"

if [ $RC -ne 0 ]; then
  echo "[$TS] FAILED rc=$RC" >> "$LOG"
  exit $RC
fi

# 校验：新生成的文件不能为空、且不能含明显死链模式
SZ_TXT=$(stat -c%s llms.txt 2>/dev/null || echo 0)
SZ_FULL=$(stat -c%s llms-full.txt 2>/dev/null || echo 0)

if [ "$SZ_TXT" -lt 1000 ] || [ "$SZ_FULL" -lt 10000 ]; then
  echo "[$TS] FAILED size check: llms.txt=$SZ_TXT llms-full.txt=$SZ_FULL" >> "$LOG"
  exit 4
fi

LINKS=$(grep -c "article-pages/" llms-full.txt)
echo "[$TS] OK llms.txt=${SZ_TXT}B llms-full=${SZ_FULL}B links=$LINKS" >> "$LOG"

# 日志瘦身：保留最近 2000 行
tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

exit 0
