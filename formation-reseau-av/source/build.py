"""Reconstruit formation-reseau-av.html à partir des sources.

Usage : python3 source/build.py   (depuis le dossier formation-reseau-av)
Nécessite Node.js pour lire les schémas définis dans data.js.
"""
import html, json, os, re, subprocess

ICI = os.path.dirname(os.path.abspath(__file__))
secs = json.load(open(os.path.join(ICI, 'secs.json'), encoding='utf-8'))
data = open(os.path.join(ICI, 'data.js'), encoding='utf-8').read()
diag = json.loads(subprocess.check_output(['node', '-e', data + ';console.log(JSON.stringify(DIAG))']))

for k, v in secs.items():
    b = v['body']
    if k in diag:
        b = re.sub(r'<div class="diagram">.*?</div>', '<pre class="cli">' + html.escape(diag[k], quote=False) + '</pre>', b, count=1, flags=re.S)
    b = re.sub(r'<div class="diagram">.*?</div>', '', b, flags=re.S).replace('<pre class="code">', '<pre class="cli">')
    v['body'] = b

t = open(os.path.join(ICI, 'app-template.html'), encoding='utf-8').read()
t = t.replace("  if(d.v){go(d.v); if(d.v==='panne'){Pn={id:null,shown:[],pick:null};render();} return;}",
              "  if(d.v){ if(d.v==='panne') Pn={id:null,shown:[],pick:null}; go(d.v); return;}")
t = t.replace('/*DATA*/', data).replace('/*SECS*/', json.dumps(secs, ensure_ascii=False).replace('</', '<\\/'))

i = t.index('</style>') + len('</style>')
page = ('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        + t[:i] + '\n<style>body{margin:0}[hidden]{display:none!important}</style>\n</head>\n<body>\n'
        + t[i:] + '\n</body>\n</html>\n')
open(os.path.join(ICI, '..', 'formation-reseau-av.html'), 'w', encoding='utf-8').write(page)
print('formation-reseau-av.html reconstruit')
