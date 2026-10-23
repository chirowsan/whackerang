# Tiny Markdown -> standalone HTML (headings, paragraphs, lists, bold, italic, code). Usage: md2html.py in.md out.html "Title"
import sys, re, html
src, out, title = sys.argv[1], sys.argv[2], sys.argv[3]
def inl(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<![\w*])_(.+?)_(?!\w)', r'<em>\1</em>', t)
    return t
body, lst = [], None
for line in open(src, encoding='utf-8').read().splitlines():
    m_ul, m_ol = re.match(r'^- (.*)', line), re.match(r'^\d+\. (.*)', line)
    kind = 'ul' if m_ul else 'ol' if m_ol else None
    if lst and kind != lst: body.append(f'</{lst}>'); lst = None
    if kind:
        if not lst: body.append(f'<{kind}>'); lst = kind
        body.append(f'<li>{inl((m_ul or m_ol).group(1))}</li>'); continue
    h = re.match(r'^(#{1,3}) (.*)', line)
    if h: body.append(f'<h{len(h.group(1))}>{inl(h.group(2))}</h{len(h.group(1))}>')
    elif line.strip(): body.append(f'<p>{inl(line)}</p>')
if lst: body.append(f'</{lst}>')
css = """body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:0 auto;padding:24px 18px 60px;line-height:1.55;color:#1d1530;background:#fbf9ff}
h1{color:#4a1fa8;font-size:1.9em;margin-bottom:.2em}h2{color:#4a1fa8;margin-top:1.6em;border-bottom:2px solid #e6dcff;padding-bottom:.2em}h3{color:#5b2fc0}
code{background:#efe9ff;padding:1px 5px;border-radius:4px;font-size:.92em;word-break:break-all}li{margin:.3em 0}a{color:#5b2fc0}
.top{display:flex;align-items:center;gap:12px}.top img{width:56px;height:56px;border-radius:14px}"""
doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title><meta name="robots" content="index,follow"><style>{css}</style></head><body>
<div class="top"><img src="icon-192.png" alt=""><div><a href="./">Whackerang</a></div></div>
{chr(10).join(body)}
</body></html>
"""
open(out, 'w', encoding='utf-8').write(doc)
print('wrote', out, len(doc))
