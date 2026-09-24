import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import re, html as H
from widgets import W
from extras import X as EX, NEWMOD
import os
S=os.path.dirname(os.path.abspath(__file__))+'/'
src=open(S+'contenu.html',encoding='utf8').read()
secs={m.group(1):(m.group(2),m.group(3)) for m in re.finditer(r'<section class="mod" id="(\w+)" data-title="([^"]*)"[^>]*>(.*?)</section>',src,re.S)}
dur={0:'1 h',1:'2 h',2:'2 h',3:'2 h',4:'2 h',5:'2 h',6:'2 h',7:'4 h',8:'2 h',9:'4 h',10:'2 h',11:'2 h',12:'2 h',13:'3 h'}
day={0:1,1:1,2:1,3:1,4:2,5:2,6:2,7:3,8:3,9:4,10:4,11:5,12:5,13:5}
after={1:{'1.4':'viz'},2:{'2.1':'scen'},5:{'5.5':'arc'},6:{'6.2':'lines'},7:{'7.2':'order'},8:{'8.1':'wire'},10:{'10.1':'playlist'},11:{'11.1':'res'},12:{'12.3':'defects'},13:{'13.2':'tree'}}

def step(kind,title,body):
    return f'<div class="step" data-kind="{kind}" data-title="{H.escape(title)}" hidden>\n{body}\n</div>'

out=[]
viz_html=None
for n in range(14):
    sid=f'm{n}'; title,body=secs[sid]
    body=re.sub(r'<div class="mod-head">.*?</div>','',body,count=1,flags=re.S)
    body=re.sub(r'<label class="check-mod">.*?</label>','',body,flags=re.S)
    drill=re.search(r'<div class="drill">.*?</ol></div>',body,re.S)
    keep=re.search(r'<div class="keep">.*?</ul></div>',body,re.S)
    for m in (drill,keep):
        if m: body=body.replace(m.group(0),'')
    obj=re.search(r'<div class="objectifs">.*?</ul>\s*</div>',body,re.S)
    body=body.replace(obj.group(0),'')
    vz=re.search(r'<div class="tool" id="viz">.*?</canvas>.*?</p>\s*<p.*?</p>\s*</div>',body,re.S)
    if vz:
        viz_html=vz.group(0).replace('class="tool"','class="lab"'); body=body.replace(vz.group(0),'')
    body=body.replace('class="tool" id="calc"','class="lab" id="calc"')
    parts=re.split(r'(?=<h3>)',body)
    pre=parts[0].strip(); chunks=parts[1:]
    steps=[step('cours','Objectifs',obj.group(0)+'\n<h3>Au programme de ce module</h3>\n<ol class="overview"></ol>')]
    if n==2:
        types=re.search(r'<div class="types">.*?\n  </div>',pre,re.S).group(0)
        steps.append(step('atelier',W['gallery'][0],f'<h3>{W["gallery"][0]}</h3>'+W['gallery'][1]+'\n'+types.replace('<div class="types">','<div class="types" id="typesSrc" hidden>',1)))
    elif n==3:
        steps.append(step('atelier',W['chain'][0],f'<h3>{W["chain"][0]}</h3>'+W['chain'][1]))
    elif pre:
        steps.append(step('cours','Vue d\'ensemble',pre))
    for c in chunks:
        h3=re.match(r'<h3>(.*?)</h3>',c).group(1)
        num=re.match(r'([\d.]+)\s',h3)
        t=re.sub(r'^[\d.]+\s*','',h3); t=re.sub(r'<[^>]+>','',t)
        steps.append(step('cours',t,c.strip()))
        if num and n in after and num.group(1) in after[n]:
            k=after[n][num.group(1)]
            if k=='viz':
                steps.append(step('atelier','Simulateur de distance','<h3>Simulateur de distance</h3>'+viz_html))
            else:
                steps.append(step('atelier',W[k][0],f'<h3>{W[k][0]}</h3>'+W[k][1]))
        if num and n in EX and num.group(1) in EX[n]:
            for kd,tt,hh in EX[n][num.group(1)]:
                steps.append(step(kd,tt,hh))
    if drill or keep:
        steps.append(step('pratique','Exercice pratique','<h3>Exercice pratique</h3>\n'+(drill.group(0) if drill else '')+'\n'+(keep.group(0) if keep else '')))
    if n>0:
        steps.append(step('quiz','Quiz de validation',f'<h3>Quiz de validation</h3>\n<p>Répondez à toutes les questions. Avec au moins 2 bonnes réponses sur 3, le module est validé.</p>\n<div class="qs" data-quiz="{sid}"></div>\n<div class="score"><b data-score="{sid}">0 / 3</b><button class="btn" type="button" data-retry="{sid}">Recommencer</button></div>'))
    out.append(f'<section class="mod" id="{sid}" data-title="{H.escape(title)}" data-dur="{dur[n]}" data-day="{day[n]}" data-num="{n:02d}" hidden>\n'+'\n'.join(steps)+'\n</section>')

nm=NEWMOD
ns=[step('cours','Objectifs',nm['obj']+'\n<h3>Au programme de ce module</h3>\n<ol class="overview"></ol>')]
for kd,tt,hh in nm['steps']: ns.append(step(kd,tt,hh))
ns.append(step('pratique','Exercice pratique','<h3>Exercice pratique</h3>\n<div class="drill"><span class="label">Exercice pratique</span><ol>'+''.join(f'<li>{x}</li>' for x in nm['drill'])+'</ol></div>\n<div class="keep"><span class="label">À retenir</span><ul>'+''.join(f'<li>{x}</li>' for x in nm['keep'])+'</ul></div>'))
ns.append(step('quiz','Quiz de validation','<h3>Quiz de validation</h3>\n<p>Répondez à toutes les questions. Avec au moins 2 bonnes réponses sur 3, le module est validé.</p>\n<div class="qs" data-quiz="m14"></div>\n<div class="score"><b data-score="m14">0 / 3</b><button class="btn" type="button" data-retry="m14">Recommencer</button></div>'))
out.append(f'<section class="mod" id="m14" data-title="{nm["title"]}" data-dur="{nm["dur"]}" data-day="{nm["day"]}" data-num="14" hidden>\n'+'\n'.join(ns)+'\n</section>')
# Sections spéciales
_,qb=secs['m14']
quiz=step('quiz','Évaluation finale','<h3>Évaluation finale</h3>\n<p>20 questions tirées au hasard sur toute la formation. Seuil de validation : 16 / 20. Trois essais, la meilleure note est gardée.</p>\n<div class="qs" id="quiz"></div>\n<div class="score"><b id="score">0 / 20</b><button class="btn" id="resetQuiz" type="button">Recommencer</button></div>')
out.append(f'<section class="mod" id="eval" data-title="Évaluation finale" data-dur="1 h" data-num="20" data-special="1" hidden>\n{quiz}\n</section>')
out.append('<section class="mod" id="attest" data-title="Mon attestation" data-dur="à débloquer" data-num="✓" data-special="1" hidden>\n'+step('pratique','Attestation','<h3>Attestation de formation</h3>\n<p>L\u2019attestation se débloque quand tous les modules sont validés, que l\u2019évaluation finale atteint 16 / 20 et que votre nom est saisi sur l\u2019accueil.</p>\n<div id="attBox" style="display:flex;flex-direction:column;gap:14px"></div>')+'\n</section>')
out.append('<section class="mod" id="formateur" data-title="Espace formateur" data-dur="suivi des stagiaires" data-num="⚑" data-special="1" data-hide="1" hidden>\n'+step('pratique','Résultats des stagiaires','<h3>Résultats des stagiaires</h3>\n<p>Chaque stagiaire qui ouvre la formation avec son compte apparaît ici en direct. Pour qu\u2019un stagiaire puisse enregistrer sa progression, partagez la page avec lui en « Peut interagir ». Seuls les personnes qui peuvent modifier la page voient ce tableau.</p>\n<div class="row"><p class="msg" id="fmMsg" style="flex:1">Chargement des résultats…</p><button class="btn" id="fmExport" type="button" disabled>Exporter pour Excel (CSV)</button></div>\n<div class="tbl fm"><table><thead><tr><th>Stagiaire</th><th>Progression</th><th>Modules</th><th>Évaluation</th><th>Statut</th><th>Activité</th></tr></thead><tbody id="fmBody"></tbody></table></div>\n<div id="fmDetail" style="display:flex;flex-direction:column;gap:12px"></div>')+'\n</section>')
_,cb=secs['certif']; cb=re.sub(r'<div class="mod-head">.*?</div>','',cb,count=1,flags=re.S)
out.append('<section class="mod" id="certif" data-title="Projet de certification" data-dur="½ journée" data-num="★" data-special="1" hidden>\n'+step('pratique','Projet de fin de formation','<h3>Projet de fin de formation</h3>'+cb)+'\n</section>')
_,gb=secs['gloss']; gb=re.sub(r'<div class="mod-head">.*?</div>','',gb,count=1,flags=re.S)
out.append('<section class="mod" id="gloss" data-title="Glossaire" data-dur="référence" data-num="Aa" data-special="1" hidden>\n'+step('cours','Glossaire','<h3>Glossaire</h3>'+gb)+'\n</section>')

head=re.search(r'^(.*?)<style>',src,re.S).group(1)
css=open(S+'app.css',encoding='utf8').read()
css=css.replace('</style>','.lab .row > label:not(.f){display:flex;flex-direction:column;gap:4px;font-size:.85rem;color:var(--muted);min-width:0}\n.verdict{font-family:var(--mono);font-size:.9rem;padding:6px 10px;border-left:3px solid var(--accent);background:var(--bg)}\n.lab output{font-family:var(--mono);color:var(--ink)}\n</style>')
body=f'''
<div class="shell">
<header class="topbar">
  <button class="brand" id="goHome" type="button"><span class="rgb" aria-hidden="true"><i style="background:#E0352A"></i><i style="background:#17A454"></i><i style="background:#2563EB"></i></span>Formation Écrans LED</button>
  <div class="gp"><span id="gpTxt">0 / 15</span><div class="meter"><i id="gpBar"></i></div></div>
</header>

<div id="home">
  <div class="wall">
    <div class="osd"><span class="live">● SIGNAL OK</span><span>P2.6 · 3840 Hz · 16 bits · 800 nits</span><span>2304×1344 · 60 Hz</span></div>
    <h1>Formation<br>Écrans LED</h1>
    <p class="lede">Installer tous les types d'écrans LED et les programmer. Chaque module se parcourt étape par étape, avec un atelier interactif, un exercice sur le mur et un quiz de validation.</p>
    <div class="cta"><button class="btn primary" id="resume" type="button">Commencer</button><button class="btn" type="button" data-open="eval">Évaluation finale</button></div>
  </div>
  <div class="facts">
    <div><span class="label">Durée</span><b>35 h</b><span>5 jours</span></div>
    <div><span class="label">Modules</span><b>15</b><span>découpés en étapes courtes</span></div>
    <div><span class="label">Ateliers</span><b>16</b><span>simulateurs et jeux</span></div>
    <div><span class="label">Validation</span><b>Quiz</b><span>à chaque module</span></div>
  </div>
  <div class="me">
    <div><span class="label">Mon suivi</span><p id="meStatus" class="sync">Progression enregistrée sur cet appareil.</p></div>
    <label for="meName">Nom pour l\u2019attestation<input id="meName" type="text" maxlength="80" placeholder="Prénom Nom" autocomplete="name"></label>
    <button class="btn" type="button" data-open="attest">Mon attestation</button>
  </div>
  <div id="days"></div>
</div>

<div id="modview" hidden>
  <aside class="side">
    <button class="btn" id="backHome" type="button" style="width:max-content">← Tous les modules</button>
    <span class="label" id="mvLabel"></span>
    <h2 id="mvTitle"></h2>
    <ol class="stepnav" id="stepNav"></ol>
  </aside>
  <div class="stage">
    <div class="stage-head"><span class="kind" id="stKind"></span><span class="label" id="stPos"></span></div>
    <div id="sections">
{chr(10).join(out)}
    </div>
    <div class="pager"><button class="btn" id="prev" type="button">← Précédent</button><span class="pos" id="stPos2"></span><button class="btn primary" id="next" type="button">Suivant →</button></div>
  </div>
</div>
</div>
<footer>Formation Écrans LED · Les valeurs sont des ordres de grandeur du marché. Référez-vous toujours à la notice du fabricant, aux normes en vigueur et à un bureau d'études pour les structures.</footer>
'''
q=re.search(r'var Q = (\[.*?\n  \]);',src,re.S).group(1)
js=open(S+'app2.js',encoding='utf8').read().replace('FINAL_QUIZ',q)
open(os.path.join(S,'..','formation-ecrans-led.html'),'w',encoding='utf8').write(head+css+'\n'+body+'\n<script>\n'+js+'\n</script>\n')
print('ok')
