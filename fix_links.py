import os
import glob

files = ['blog.html', 'faq.html', 'generate.html', 'news.html']
base_dir = '/root/ai-report-generator'

for fname in files:
    path = os.path.join(base_dir, fname)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    replacements = [
        ('href="https://discord.gg/https://discord.gg/UtNfS8kH"', 'href="https://discord.gg/UtNfS8kH"'),
    ]
    
    # Fix Twitter
    if 'href="https://twitter.com" target="_blank" class="text-[#64748b] hover:text-[#1DA1F2]' in content:
        content = content.replace(
            'href="https://twitter.com" target="_blank" class="text-[#64748b] hover:text-[#1DA1F2]',
            'href="https://x.com/reportifyai" target="_blank" class="text-[#64748b] hover:text-[#1DA1F2]'
        )
        print(f"  {fname}: Fixed Twitter/X")
    
    # Fix LinkedIn
    if 'href="https://linkedin.com" target="_blank" class="text-[#64748b] hover:text-[#0077b5]' in content:
        content = content.replace(
            'href="https://linkedin.com" target="_blank" class="text-[#64748b] hover:text-[#0077b5]',
            'href="https://linkedin.com/company/reportifyai" target="_blank" class="text-[#64748b] hover:text-[#0077b5]'
        )
        print(f"  {fname}: Fixed LinkedIn")
    
    # Fix YouTube
    if 'href="https://youtube.com" target="_blank" class="text-[#64748b] hover:text-[#FF0000]' in content:
        content = content.replace(
            'href="https://youtube.com" target="_blank" class="text-[#64748b] hover:text-[#FF0000]',
            'href="https://youtube.com/@reportifyai" target="_blank" class="text-[#64748b] hover:text-[#FF0000]'
        )
        print(f"  {fname}: Fixed YouTube")
    
    # Fix Facebook
    if 'href="https://facebook.com" target="_blank" class="text-[#64748b] hover:text-[#1877F2]' in content:
        content = content.replace(
            'href="https://facebook.com" target="_blank" class="text-[#64748b] hover:text-[#1877F2]',
            'href="https://facebook.com/reportifyai" target="_blank" class="text-[#64748b] hover:text-[#1877F2]'
        )
        print(f"  {fname}: Fixed Facebook")
    
    # Fix Google/Medium
    if 'href="https://google.com" target="_blank" class="text-[#64748b] hover:text-[#EA4335]' in content:
        content = content.replace(
            'href="https://google.com" target="_blank" class="text-[#64748b] hover:text-[#EA4335]',
            'href="https://medium.com/@reportifyai" target="_blank" class="text-[#64748b] hover:text-[#EA4335]'
        )
        print(f"  {fname}: Fixed Google→Medium")
    
    # Fix Discord double prefix
    old_dc = 'href="https://discord.gg/https://discord.gg/UtNfS8kH"'
    new_dc = 'href="https://discord.gg/UtNfS8kH"'
    if old_dc in content:
        content = content.replace(old_dc, new_dc)
        print(f"  {fname}: Fixed Discord URL")
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✓ {fname} done")

print("\nAll done!")
