"""Génère la version imprimable de la formation, à transformer en PDF.

Depuis le dossier formation-reseau-av :
  node source/pdf/extract.js
  python3 source/pdf/build_print.py source/pdf/print.html source/pdf/data.json source/pdf/missions.json source/pdf/print.css
  node source/pdf/topdf.js "$PWD/source/pdf/print.html" "$PWD/Formation-Reseau-AV.pdf"
(topdf.js utilise Playwright et Chromium.)
"""
import html, json, os, random, re, sys

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..') + os.sep
OUT = sys.argv[1]
secs = json.load(open(SRC + 'secs.json', encoding='utf-8'))
D = json.load(open(sys.argv[2], encoding='utf-8'))
MIS = json.load(open(sys.argv[3], encoding='utf-8'))
e = lambda s: html.escape(str(s), quote=False)

NUM = ['m%d' % i for i in range(1, 13)]
JOUR = {m['id']: m['jour'] for m in D['MODS']}
DOM = {mid: d['nom'] for d in D['DOMAINES'] for mid in d['mods']}


def clean(body, key=None):
    if key in D['DIAG']:
        body = re.sub(r'<div class="diagram">.*?</div>', '<pre class="cli">' + e(D['DIAG'][key]) + '</pre>', body, count=1, flags=re.S)
    body = re.sub(r'<div class="diagram">.*?</div>', '', body, flags=re.S)
    body = body.replace('<pre class="code">', '<pre class="cli">')
    body = re.sub(r'<input type="checkbox" id="c\d+">', '<span class="box"></span>', body)
    body = re.sub(r'<div class="cta">.*?</div>', '', body, flags=re.S)
    return body


def trap_list(mid):
    t = secs[mid]['trap']
    if t:
        return re.sub(r'^<div class="trap"><b>Pièges fréquents</b>', '', t).rstrip('</div>') if False else t.replace('<div class="trap"><b>Pièges fréquents</b>', '').rsplit('</div>', 1)[0]
    if mid in D['PIEGES_EXTRA']:
        return '<ul>' + ''.join('<li>%s</li>' % e(x) for x in D['PIEGES_EXTRA'][mid]) + '</ul>'
    return ''


toc = []  # (id, label, level)
parts = []


def part(pid, num, title, intro):
    toc.append((pid, 'Partie %s · %s' % (num, title), 0))
    return f'<section class="part" id="{pid}"><div class="part-num">Partie {num}</div><h1>{e(title)}</h1><p class="part-intro">{intro}</p></section>'


# ---------- Programme ----------
toc.append(('prog', 'Comment utiliser ce document · Programme', 0))
prog = f'''<section class="chap" id="prog"><div class="kicker">Avant de commencer</div><h2>Programme de la formation</h2>
<p class="lead">À la fin, vous savez concevoir, configurer et dépanner seul un réseau AV de 10 à 200 appareils.</p>
{clean(secs['prog']['body'])}
<h3>Comment ce document est organisé</h3>
<ul>
<li><b>Partie 1 · Les 12 modules</b> : pour chacun, le cours, l’antisèche des chiffres à retenir, les pièges fréquents et la pratique associée.</li>
<li><b>Partie 2 · Études de conception</b> : le réseau complet d’une église de 800 places, puis les conceptions des grands événements.</li>
<li><b>Partie 3 · Pratique</b> : les 12 travaux pratiques, la check-list d’exploitation et 7 scénarios de panne à résoudre.</li>
<li><b>Partie 4 · Évaluation</b> : 36 questions à choix multiples et 32 fiches mémo.</li>
<li><b>Partie 5 · Annexes</b> : les missions du simulateur Régie IP Lab, les corrigés, le glossaire et les ressources.</li>
</ul>
<p class="note">Les débits indiqués sont des ordres de grandeur. Vérifiez toujours les fiches techniques de vos appareils.</p></section>'''

# ---------- Modules ----------
mods = [part('p1', '1', 'Les 12 modules', 'Chaque module suit le même ordre : l’idée clé, le cours, l’antisèche, les pièges fréquents et la pratique. Comptez une demi-journée par module en formation présentielle.')]
for i, mid in enumerate(NUM):
    s = secs[mid]
    toc.append((mid, 'Module %d · %s' % (i + 1, s['t']), 1))
    anti = ''.join('<tr><td class="k">%s</td><td>%s</td></tr>' % (e(a), e(b)) for a, b in D['ANTI'].get(mid, []))
    pr = D['PRATIQUE'][mid]
    pr_items = ''.join('<li>%s</li>' % e(t) for t in pr['tp'])
    if pr['lab']:
        pr_items += '<li>Simulateur Régie IP Lab : %s.</li>' % e(pr['lab'])
    pn = [p for p in D['PANNES'] if p['m'] == mid]
    if pn:
        pr_items += ''.join('<li>Salle de panne : « %s » (partie 3).</li>' % e(p['titre']) for p in pn)
    nq = len([q for q in D['QCM'] if q['m'] == mid])
    pr_items += '<li>%d questions de quiz et %d fiches mémo sur ce module (partie 4).</li>' % (nq, len([c for c in D['CARTES'] if c['m'] == mid]))
    mods.append(f'''<section class="chap mod" id="{mid}">
<div class="mod-head"><div class="mod-num">{i+1:02d}</div><div><div class="kicker">Module {i+1} · Jour {JOUR[mid]} · {e(DOM[mid])}</div><h2>{e(s['t'])}</h2></div></div>
<p class="lead">{s['lead']}</p>
{clean(s['body'], mid)}
<div class="recap">
<div class="recap-block"><h4>Antisèche</h4><table class="anti">{anti}</table></div>
<div class="recap-block trap"><h4>Pièges fréquents</h4>{trap_list(mid)}</div>
<div class="recap-block"><h4>Pratique</h4><ul>{pr_items}</ul></div>
</div></section>''')

# ---------- Études ----------
etu = [part('p2', '2', 'Études de conception', 'Deux études pour passer des notions à un réseau complet : une église de 800 places, puis les conceptions des plus grands événements, ramenées à votre échelle.')]
for mid, lab in (('cas', 'Cas pratique · Église de 800 places'), ('big', 'Le réseau au cœur des grands événements')):
    toc.append((mid, lab, 1))
    s = secs[mid]
    etu.append(f'''<section class="chap" id="{mid}"><div class="kicker">Étude de conception</div><h2>{e(lab)}</h2>
<p class="lead">{s['lead']}</p>{clean(s['body'], mid)}
<div class="recap"><div class="recap-block"><h4>Exercice</h4><ul>{''.join('<li>%s</li>' % e(t) for t in D['PRATIQUE'][mid]['tp'])}</ul></div></div></section>''')

# ---------- Pratique ----------
rng = random.Random(42)
pan_orders = {}
prat = [part('p3', '3', 'Pratique', 'Les travaux pratiques à mener sur du vrai matériel, la check-list d’exploitation et sept pannes réalistes à diagnostiquer. Les solutions des pannes sont en annexe.')]
toc.append(('tp', 'Travaux pratiques', 1))
prat.append(f'<section class="chap" id="tp"><div class="kicker">Pratique</div><h2>Les 12 travaux pratiques</h2><p class="lead">{secs["tp"]["lead"]}</p>{clean(secs["tp"]["body"])}</section>')
cl = re.search(r'<h3>11\.4.*?</ul>', secs['m11']['body'], re.S)
toc.append(('check', 'Check-list avant chaque événement', 1))
prat.append(f'<section class="chap avoid" id="check"><div class="kicker">Exploitation</div><h2>Check-list avant chaque événement</h2><p class="lead">À imprimer et à cocher avant chaque culte, concert ou retransmission.</p>{clean(re.sub(r"<h3>.*?</h3>", "", cl.group(0)))}<p class="note">Date : ______________ · Technicien : ______________ · Événement : ______________</p></section>')
toc.append(('pannes', 'Salle de panne · 7 scénarios', 1))
pz = ['<section class="chap" id="pannes"><div class="kicker">Pratique</div><h2>Salle de panne</h2><p class="lead">Lisez le symptôme, étudiez les résultats des commandes, puis choisissez la cause. Les solutions et les réparations sont dans les corrigés (partie 5).</p>']
for k, p in enumerate(D['PANNES']):
    order = list(range(4)); rng.shuffle(order); pan_orders[p['id']] = order
    cmds = ''.join('<pre class="cli"><span class="prompt">%s</span>\n%s</pre>' % (e(('SW# ' if c[0].startswith(('show', 'ping')) else '» ') + c[0]), e(c[1])) for c in p['cmds'])
    opts = ''.join('<li><b>%s.</b> %s</li>' % ('ABCD'[j], e(p['causes'][o])) for j, o in enumerate(order))
    pz.append(f'''<div class="panne"><div class="panne-head"><span class="pn">Panne {k+1}</span><h3>{e(p['titre'])}</h3><span class="tag">Module {NUM.index(p['m'])+1}</span></div>
<p><b>Symptôme.</b> {e(p['symptome'])}</p>{cmds}<p class="q">Quelle est la cause ?</p><ol class="opts">{opts}</ol></div>''')
pz.append('</section>')
prat.append(''.join(pz))

# ---------- Évaluation ----------
ev = [part('p4', '4', 'Évaluation', 'Le quiz couvre les douze modules : visez au moins 80 % de bonnes réponses. Les fiches mémo se découpent ou se lisent en cachant la colonne de droite.')]
toc.append(('qcm', 'Quiz · 36 questions', 1))
q_orders = {}
qs = ['<section class="chap" id="qcm"><div class="kicker">Évaluation</div><h2>Quiz · 36 questions</h2><p class="lead">Une seule bonne réponse par question. Le corrigé détaillé est en partie 5.</p>']
cur = None
for n, q in enumerate(D['QCM']):
    if q['m'] != cur:
        cur = q['m']; qs.append('<h3 class="qmod">Module %d · %s</h3>' % (NUM.index(cur) + 1, e(secs[cur]['t'])))
    order = list(range(4)); rng.shuffle(order); q_orders[q['id']] = order
    qs.append('<div class="qq"><p><span class="qn">%d.</span> %s</p><ol class="opts">%s</ol></div>' % (n + 1, e(q['q']), ''.join('<li><b>%s.</b> %s</li>' % ('ABCD'[j], e(q['o'][o])) for j, o in enumerate(order))))
qs.append('<p class="note">Score : ______ / 36</p></section>')
ev.append(''.join(qs))
toc.append(('memo', 'Fiches mémo · 32 cartes', 1))
rows = ''.join('<tr><td class="m">%d</td><td>%s</td><td class="k">%s</td></tr>' % (NUM.index(c['m']) + 1, e(c['f']), e(c['b'])) for c in D['CARTES'])
ev.append(f'<section class="chap" id="memo"><div class="kicker">Évaluation</div><h2>Fiches mémo</h2><p class="lead">Cachez la colonne de droite et répondez à voix haute. Revenez sur les cartes ratées le lendemain.</p><table class="memo"><thead><tr><th>Mod.</th><th>Question</th><th>Réponse</th></tr></thead><tbody>{rows}</tbody></table></section>')

# ---------- Annexes ----------
an = [part('p5', '5', 'Annexes', 'Les missions du simulateur Régie IP Lab, les corrigés du quiz et des pannes, le glossaire et les ressources pour aller plus loin.')]
toc.append(('lab', 'Régie IP Lab · missions et solutions', 1))
lab = ['<section class="chap" id="lab"><div class="kicker">Annexe</div><h2>Régie IP Lab · missions et solutions</h2><p class="lead">Le simulateur reproduit deux switchs en syntaxe Cisco IOS : SW-REGIE, à configurer depuis l’usine, et SW-COEUR, déjà en place côté scène. Lien : claude.ai/artifact/YFkf6jVmNth2steH57bQQE.</p>']
for k, m in enumerate(MIS):
    steps = ''.join('<li>%s</li>' % e(s) for s in m['steps'])
    sol = '<pre class="cli">%s</pre>' % e(m['sol']) if m['sol'] else '<p>Pas de solution unique : les pannes sont tirées au hasard. Partez des symptômes et utilisez <code>show interfaces status</code>, <code>show vlan brief</code>, <code>show interfaces trunk</code> et <code>show ip igmp snooping querier</code>.</p>'
    lab.append(f'<div class="mission"><h3>Mission {k+1} · {e(m["title"])}</h3><p>{e(m["goal"])}</p><p class="small"><b>Étapes validées :</b></p><ul class="small">{steps}</ul>{sol}</div>')
lab.append('</section>')
an.append(''.join(lab))
toc.append(('corr', 'Corrigés du quiz et des pannes', 1))
cr = ''.join('<tr><td class="m">%d</td><td class="k">%s</td><td>%s</td></tr>' % (n + 1, 'ABCD'[q_orders[q['id']].index(0)], e(q['o'][0] + ' · ' + q['e'])) for n, q in enumerate(D['QCM']))
pc = ''.join(f'''<div class="panne sol"><h3>Panne {k+1} · {e(p['titre'])}</h3><p><b>Réponse {"ABCD"[pan_orders[p["id"]].index(0)]} : {e(p['causes'][0])}.</b> {e(p['explique'])}</p><pre class="cli">{e(p['fix'])}</pre></div>''' for k, p in enumerate(D['PANNES']))
an.append(f'<section class="chap" id="corr"><div class="kicker">Annexe</div><h2>Corrigés</h2><h3>Quiz · 36 questions</h3><table class="memo"><thead><tr><th>N°</th><th>Rép.</th><th>Bonne réponse et explication</th></tr></thead><tbody>{cr}</tbody></table><h3>Salle de panne</h3>{pc}</section>')
toc.append(('glo', 'Glossaire et ressources', 1))
an.append(f'<section class="chap" id="glo"><div class="kicker">Annexe</div><h2>Glossaire et ressources</h2>{clean(secs["glo"]["body"])}</section>')

# ---------- Sommaire ----------
tl = ''.join(f'<li class="l{lv}"><a href="#{i}">{e(t)}</a></li>' for i, t, lv in toc)
sommaire = f'<section class="toc" id="sommaire"><div class="kicker">Sommaire</div><h2>Sommaire</h2><ol>{tl}</ol></section>'

cover = '''<section class="cover"><div class="cv-top">Formation · audio, vidéo et réseau</div>
<div class="cv-mid"><div class="cv-tag">AV/IP</div><h1>Réseau pour<br>l’audio-vidéo</h1>
<p>De zéro à la conception, la configuration et le dépannage d’un réseau qui transporte le son, l’image et le contrôle : Dante, AES67, NDI, SMPTE ST 2110, SRT.</p></div>
<div class="cv-facts"><div><b>5</b><span>jours · 35 h</span></div><div><b>12</b><span>modules</span></div><div><b>36</b><span>questions</span></div><div><b>7</b><span>pannes</span></div></div>
<div class="cv-bot">Support de formation complet · Octobre 2026</div></section>'''

css = open(sys.argv[4], encoding='utf-8').read()
doc = f'''<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Formation Réseau pour l’audio-vidéo</title><style>{css}</style></head><body>
{cover}{sommaire}{prog}{''.join(mods)}{''.join(etu)}{''.join(prat)}{''.join(ev)}{''.join(an)}</body></html>'''
open(OUT, 'w', encoding='utf-8').write(doc)
print('ok', len(doc), len(toc))
