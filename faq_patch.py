from hermes_tools import read_file, write_file

content = read_file('/root/ai-report-generator/faq.html')['content']
lines = content.split('\n')

# Find the FAQ Structured Data section (lines 183-232 in 1-indexed)
# Line 183 is: empty
# Line 184 is: "    <!-- FAQ Structured Data -->"
# Line 185 is: '    <script type="application/ld+json">'
# We need to delete from line 183 (empty line before comment) to line 232 (</script>)
# New lines after line 181: ...</script>
# So we delete everything from "    <!-- FAQ Structured Data -->" to the preceding "    </script>" (line 232)

result_lines = []
skip = False
for i, line in enumerate(lines):
    if '<!-- FAQ Structured Data -->' in line:
        skip = True
        continue
    if skip and '</script>' in line and i < 250:  # Only the one before </head>
        skip = False
        continue
    if not skip:
        result_lines.append(line)

write_file('/root/ai-report-generator/faq.html', '\n'.join(result_lines))
print("Done")
