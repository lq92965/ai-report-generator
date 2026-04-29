import os

for p in os.listdir('.'):
    if not p.endswith('.html') or not os.path.isfile(p):
        continue
    with open(p, 'r', encoding='utf-8') as f:
        html = f.read()
    
    head_end = html.find('</head>')
    if head_end == -1:
        continue
    head = html[:head_end]
    body = html[head_end:]
    
    # Fix duplicate OG blocks
    first_og = head.find('<!-- Open Graph / Social -->')
    if first_og != -1:
        second_og = head.find('<!-- Open Graph / Social -->', first_og + 5)
        if second_og != -1:
            end_points = []
            for marker in ['<!-- Twitter Card -->', 'rel="canonical"', 'application/ld+json']:
                pos = head.find(marker, second_og)
                if pos != -1:
                    rest = head[pos:]
                    if marker == 'application/ld+json':
                        se = rest.find('</script>')
                        if se != -1: end_points.append(pos + se + 9)
                    else:
                        le = rest.find('\n')
                        if le != -1: end_points.append(pos + le)
            if end_points:
                head = head[:second_og] + head[max(end_points):]
    
    # Fix duplicate description
    if head.count('name="description"') > 1:
        fd = head.find('name="description"')
        sd = head.find('name="description"', fd + 5)
        if sd != -1:
            ls = head.rfind('<', 0, sd)
            le = head.find('>', sd)
            if ls != -1 and le != -1:
                head = head[:ls] + head[le + 1:]
    
    html = head + body
    with open(p, 'w', encoding='utf-8') as f:
        f.write(html)
    
    i = html.find('</head>')
    h = html[:i]
    og, tw, ca, jd = h.count('og:title'), h.count('twitter:card'), h.count('rel="canonical"'), h.count('application/ld+json')
    status = '✅' if og <= 1 and tw <= 1 and ca <= 1 and jd <= 1 else '❌'
    print(f'{status} {p}: OG={og} TW={tw} CA={ca} JD={jd}')

print('\nDone!')
