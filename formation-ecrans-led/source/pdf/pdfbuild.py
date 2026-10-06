import re, json, os, subprocess, html as H
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
SRC=os.path.join(ROOT,'formation-ecrans-led.html')
src=open(SRC,encoding='utf8').read()
D=json.loads(subprocess.run(['node',os.path.join(HERE,'extract.js'),SRC,'-'],capture_output=True,text=True,check=True).stdout)
e=H.escape
secs=re.findall(r'<section class="mod" id="(\w+)" data-title="([^"]*)" data-dur="([^"]*)"(.*?)>(.*?)\n</section>',src,re.S)
S={s[0]:s for s in secs}
def steps(body):
    return re.findall(r'<div class="step" data-kind="(\w+)" data-title="([^"]*)" hidden>\n(.*?)\n</div>(?=\n<div class="step"|\s*$)',body,re.S)

LET='ABCD'
ANS=[]   # corrigés : (section, lignes)
def qlist(qs, prefix):
    out=['<ol class="qz">']; key=[]
    for i,q in enumerate(qs):
        out.append('<li><p>'+e(q[0])+'</p><ul class="opt">'+''.join(f'<li><span class="box">{LET[j]}</span>{e(o)}</li>' for j,o in enumerate(q[1]))+'</ul></li>')
        key.append(f'<li><b>{prefix}{i+1} : {LET[q[2]]}</b> — {e(q[3])}</li>')
    out.append('</ol>')
    return ''.join(out), key

def lab_html(title, mid):
    t=title
    if 'distance' in t:
        rows=''.join(f'<tr><td class="num">P{p}</td><td class="num">{p:g} m</td><td class="num">{2*p:g} à {3*p:g} m</td><td class="num">≈ {p/0.29:.0f} m</td></tr>' for p in [1.2,1.9,2.6,3.9,4.8,6,10,16])
        return f'''<p>Dans l'application, le simulateur montre l'image vue par le spectateur selon le pas et la distance. Sur papier, retenez ce tableau. La dernière colonne est la distance à partir de laquelle l'œil (acuité d'une minute d'arc) ne distingue plus les pixels : environ pas ÷ 0,29.</p>
<div class="tbl"><table><thead><tr><th>Pas</th><th>Distance minimale</th><th>Distance confortable</th><th>Image parfaitement lisse</th></tr></thead><tbody>{rows}</tbody></table></div>
<div class="ex"><b>À compléter</b> : un écran P2.5 est vu entre 4 m et 20 m. Distance minimale : ……… Distance où l'image devient lisse : ……… Le premier rang est-il bien placé ? ………</div>'''
    if 'familles' in t:
        types=re.search(r'<div class="types" id="typesSrc" hidden>(.*)</div>',mid,re.S)
        body=types.group(1) if types else ''
        return '<p>Les treize grandes familles d\'écrans, avec leurs caractéristiques et leurs points de pose.</p><div class="types">'+body+'</div>'
    if 'quel écran' in t:
        qs=[[s[0],s[1],s[2],s[3]] for s in D['scen']]
        h,k=qlist(qs,'Cas '); ANS.append(('Module 02 · Quel écran pour quel lieu ?',k))
        return '<p>Pour chaque demande de client, cochez la solution la plus adaptée. Corrigé en fin de document.</p>'+h
    if 'chaîne du signal' in t:
        rows=''.join(f'<tr><td><b>{e(c[0])}</b><br><span class="mono">{e(c[1])}</span></td><td>{e(c[2])}</td><td>{e(c[3].replace("Réglage : ",""))}</td><td>{e(c[4].replace("Panne typique : ",""))}</td></tr>' for c in D['chain'])
        return f'<p>Chaque maillon, de la source aux LED : son rôle, ce qu\'on y règle et la panne typique.</p><div class="tbl"><table><thead><tr><th>Maillon</th><th>Rôle</th><th>Réglage</th><th>Panne typique</th></tr></thead><tbody>{rows}</tbody></table></div>'
    if 'courbe' in t:
        rows=''.join(f'<tr><td class="num">{R} m</td><td class="num">{360*0.5/(2*3.14159*R):.1f}°</td><td class="num">{round(3.14159*R/2/0.5)}</td></tr>' for R in [3,4,6,8,10])
        return f'''<div class="formula">Angle entre cabinets (°) = 360 × largeur cabinet (m) ÷ (2π × rayon (m))
Nombre de cabinets sur l'arc = longueur d'arc ÷ largeur cabinet
Longueur d'arc = arc total (°) × π × rayon ÷ 180</div>
<div class="tbl"><table><thead><tr><th>Rayon</th><th>Angle entre cabinets de 500 mm</th><th>Cabinets pour un quart de cercle (90°)</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>Au-delà d'environ 10° par joint, les verrous d'angle courants ne suffisent plus : augmentez le rayon, prenez des cabinets plus étroits ou des modules flexibles.</p>
<div class="ex"><b>À calculer</b> : arc de 120° de rayon 5 m en cabinets de 500 mm. Angle par joint : ……… Nombre de cabinets : ………</div>'''
    if "alimentation" in t and 'répartir' in t:
        return '''<div class="formula">Cabinets par ligne   = 230 V × calibre (A) × 0,8 ÷ puissance max d'un cabinet
Départs nécessaires  = nombre de cabinets ÷ cabinets par ligne   (arrondi au-dessus)
Différentiels 30 mA  = fuite totale ÷ 9 mA                         (arrondi au-dessus)
Fuite totale         = cabinets × alimentations par cabinet × fuite d'une alimentation</div>
<p><b>Exemple</b> : 84 cabinets de 150 W max, départs 16 A, 1 alimentation par cabinet, 0,8 mA de fuite chacune.</p>
<ul><li>Cabinets par ligne : 230 × 16 × 0,8 ÷ 150 = 19,6 → <b>19</b></li><li>Départs : 84 ÷ 19 = 4,4 → <b>5 départs de 16 A</b>, répartis sur les 3 phases</li><li>Fuite totale : 84 × 0,8 = 67,2 mA → <b>8 différentiels 30 mA</b> au minimum</li><li>Puissance max : 84 × 150 = 12,6 kW, soit 4,2 kW par phase</li></ul>
<div class="ex"><b>À calculer</b> : 60 cabinets de 180 W, départs 20 A. Cabinets par ligne : ……… Départs : ……… Différentiels : ………</div>'''
    if "ordre" in t:
        import random
        rnd=random.Random(7); idx=list(range(len(D['order']))); rnd.shuffle(idx)
        items=''.join(f'<li><span class="blank"></span>{e(D["order"][i])}</li>' for i in idx)
        ANS.append(('Module 07 · Ordre de la procédure',[ '<li>'+' → '.join(e(x) for x in D['order'])+'</li>' ]))
        return '<p>Les 12 étapes d\'une installation sont mélangées. Numérotez-les de 1 à 12 dans la case. Corrigé en fin de document.</p><ul class="order">'+items+'</ul>'
    if 'câbler un mur' in t:
        cells=''.join('<div></div>' for _ in range(18))
        ANS.append(('Module 08 · Câbler un mur',['<li>Une solution optimale : <b>Port A</b> sur les rangées 1 et 2 en serpentin (12 cabinets, 442 368 px), <b>Port B</b> sur la rangée 3 (6 cabinets, 221 184 px). Un seul port est impossible : 18 × 36 864 = 663 552 px dépassent 650 000 px. Gardez un port libre pour une boucle de secours.</li>']))
        return f'<p>Mur de 6 × 3 cabinets P2.6 (192 × 192 px chacun). Un port Gigabit porte au plus 650 000 px, soit 17 cabinets. Tracez au crayon le parcours de chaque port : chaque cabinet doit toucher le précédent, sans diagonale. Notez A1, A2… dans les cases.</p><div class="grid6">{cells}</div>'
    if 'NovaLCT' in t:
        ANS.append(('Module 09 · Simulateur NovaLCT',['<li>Mot de passe avancé : <b>admin</b>. Fichier : <b>P2.6_ICN2153_32S_192x192.rcfgx</b> (même driver et même scan que l\'étiquette). Ordre de connexion : <b>haut gauche → haut droite → bas droite → bas gauche</b>. Puis Send to HW, Save, et test de coupure.</li>']))
        return '''<p>Mission : configurer un mur de 2 × 2 cabinets de zéro. Le câblage réel part du coin haut gauche vu de face, va à droite, descend, puis revient à gauche.</p>
<p>Étiquette au dos d'un module : <code>P2.6 · driver ICN2153 · scan 1/32 · cabinet 192×192</code>. Fichiers proposés : <code>P2.6_ICN2153_32S_192x192.rcfgx</code>, <code>P2.6_MBI5153_16S_192x192.rcfgx</code>, <code>P3.91_ICN2153_16S_128x128.rcfgx</code>.</p>
<ul class="check"><li>Se connecter en utilisateur avancé (mot de passe : ………)</li><li>Choisir le bon fichier de carte réceptrice : ………………………</li><li>Tracer la connexion comme le câblage réel (numérotez les cabinets ci-dessous)</li><li>Send to HW : chaque cabinet affiche son numéro</li><li>Save : enregistrer dans les cartes</li><li>Couper et rallumer : l'image revient correcte</li></ul>
<div class="grid2"><div></div><div></div><div></div><div></div></div>'''
    if 'LEDVISION' in t:
        ANS.append(('Module 09 · Simulateur LEDVISION',['<li>Mot de passe : <b>168</b> ou <b>666</b> selon la version. Fichier : <b>P3.91_FM6363_16S_128x128.rcvbp</b>. Ordre : <b>bas gauche → haut gauche → haut milieu → bas milieu → bas droite → haut droite</b> (serpentin vertical). Puis Send, Save, test de coupure.</li>']))
        return '''<p>Mission : configurer un mur de 3 × 2 cabinets. Le câblage est vertical : il part du coin bas gauche vu de face, monte, passe à droite, redescend, passe à droite et remonte.</p>
<p>Étiquette : <code>P3.91 · driver FM6363 · scan 1/16 · cabinet 128×128</code>. Fichiers proposés : <code>P3.91_FM6363_16S_128x128.rcvbp</code>, <code>P3.91_FM6363_8S_128x128.rcvbp</code>, <code>P2.6_ICN2153_32S_192x192.rcvbp</code>.</p>
<ul class="check"><li>Ouvrir Settings → Display Setting (mot de passe : ………)</li><li>Receiver : charger le bon fichier ………………………</li><li>Connection : tracer l'ordre réel (numérotez ci-dessous)</li><li>Send, puis Save</li><li>Couper et rallumer pour vérifier</li></ul>
<div class="grid3"><div></div><div></div><div></div><div></div><div></div><div></div></div>'''
    if 'totem' in t:
        ANS.append(('Module 10 · Programmer un totem',['<li>Boucle : 15 + 10 + 8 = <b>33 s</b>. Boucles par heure : 3 600 ÷ 33 = <b>109</b>. De 8 h à 21 h (13 h) : 109 × 13 = <b>1 417 passages</b> de chaque page par jour.</li>']))
        return '''<p>Dans l'application, on compose la boucle d'un totem et on la voit tourner. Sur papier :</p>
<div class="ex"><b>À calculer</b> : boucle de trois pages (vidéo 15 s, image + texte défilant 10 s, horloge et météo 8 s), allumage de 8 h à 21 h.<br>Durée de la boucle : ……… Boucles par heure : ……… Passages par jour : ………</div>
<p>Points à vérifier : la plage horaire respecte l'extinction nocturne imposée à la publicité lumineuse ; une boucle de plus de 2 minutes est rarement vue en entier par un passant.</p>'''
    if 'HDPlayer' in t:
        ANS.append(('Module 10 · Simulateur HDPlayer',['<li>Wi-Fi : <b>HD-A3-…</b> (le point d\'accès d\'un lecteur Huidu commence par « HD- »), mot de passe d\'usine fréquent <b>88888888</b>. Contrôleur : <b>HD-A3</b>. Résolution : 6 × 64 = <b>384</b> par 6 × 32 = <b>192</b> px. Disposition : vidéo + bandeau texte. Envoi par Wi-Fi ou clé USB.</li>']))
        return '''<p>Mission : programmer l'écran d'une pharmacie piloté par un lecteur Huidu. Relevé sur place : contrôleur <code>HD-A3</code>, écran de 6 × 6 modules P5, chaque module fait 64 × 32 pixels. Le client veut une vidéo avec un bandeau de texte défilant en bas.</p>
<ul class="check"><li>Se connecter au Wi-Fi du lecteur (nom du réseau : ……… mot de passe : ………)</li><li>Créer l'écran avec le bon contrôleur : ………</li><li>Saisir la résolution : ……… × ……… px</li><li>Choisir la disposition vidéo + bandeau, saisir le texte</li><li>Envoyer par Wi-Fi ou exporter sur clé USB</li></ul>'''
    if 'pixel pour pixel' in t:
        ANS.append(('Module 11 · Pixel pour pixel',['<li>En découpe, il manque <b>384 px</b> en largeur (2 304 − 1 920) et <b>264 px</b> en hauteur (1 344 − 1 080) : ces zones restent noires. Solutions : sortie 4K (3840 × 2160) avec l\'écran en haut à gauche, résolution personnalisée 2304 × 1344, ou mise à l\'échelle (même rapport d\'aspect : 1,71 contre 1,78, donc légère déformation ou bandes noires).</li>']))
        return '''<div class="ex"><b>Cas</b> : écran LED de 2304 × 1344 px, sortie du PC en 1920 × 1080.<br>1. En mode découpe, quelle partie de l'écran ne reçoit pas d'image ? ………………<br>2. Proposez deux solutions : ………………<br>3. En mise à l'échelle, l'image sera-t-elle déformée ? Pourquoi ? ………………</div>'''
    if 'défauts' in t:
        return '''<p>Dans l'application, un mur de 8 × 4 cabinets cache 4 défauts à trouver en changeant de mire. Retenez quelle mire révèle quel défaut :</p>
<div class="tbl"><table><thead><tr><th>Défaut</th><th>Mire qui le révèle</th><th>Aspect</th></tr></thead><tbody>
<tr><td>Cabinet sans bleu (nappe, driver)</td><td>Bleu, blanc</td><td>Noir sur la mire bleue, jaune sur le blanc</td></tr>
<tr><td>Module noir</td><td>Presque toutes sauf le noir</td><td>Un quart de cabinet éteint</td></tr>
<tr><td>Cabinet d'un autre lot</td><td>Blanc 10 %</td><td>Teinte rosée visible seulement à faible luminosité</td></tr>
<tr><td>Pixel bloqué allumé</td><td>Noir</td><td>Point blanc sur fond noir</td></tr>
</tbody></table></div>'''
    if 'dépannage' in t:
        T=D['T']; L=D['L']
        def node(k, depth=0):
            if k in L: return f'<div class="leaf"><b>{e(L[k][0])}</b> — {e(L[k][1])}</div>'
            n=T[k]; s=f'<p class="tq">{e(n[0])}</p><ul class="tree">'
            for a,nx in n[1]: s+=f'<li><span class="ans">{e(a)}</span>{node(nx,depth+1)}</li>'
            return s+'</ul>'
        return '<p>Partez de ce que vous voyez et suivez les réponses jusqu\'au diagnostic.</p><div class="treebox">'+node('start')+'</div>'
    if 'chiffrer' in t:
        L=[('Écran',21*2500),('Structure',21*250),('Contrôle et processeur',4500),('Électricité et réseau',2500),('Main-d’œuvre (4 j × 3 techniciens × 450 €)',5400),('Transport et levage',1200),('Mise en service, calibration, formation',1500)]
        cost=sum(v for _,v in L); ht=cost*1.25
        f=lambda n: f'{n:,.0f} €'.replace(',', ' ')
        rows=''.join(f'<tr><td>{e(a)}</td><td class="num">{f(v)}</td><td class="num">{v/cost*100:.0f} %</td></tr>' for a,v in L)
        return f'''<p>Exemple pour l'écran de l'église du module 4 (21 m²). Les prix sont des exemples : remplacez-les par vos tarifs.</p>
<div class="tbl"><table><thead><tr><th>Poste</th><th>Coût</th><th>Part</th></tr></thead><tbody>{rows}
<tr><td><b>Prix de revient</b></td><td class="num"><b>{f(cost)}</b></td><td></td></tr>
<tr><td>Marge 25 %</td><td class="num">{f(ht-cost)}</td><td></td></tr>
<tr><td><b>Total HT</b></td><td class="num"><b>{f(ht)}</b></td><td></td></tr>
<tr><td>TVA 20 %</td><td class="num">{f(ht*0.2)}</td><td></td></tr>
<tr><td><b>Total TTC</b></td><td class="num"><b>{f(ht*1.2)}</b></td><td></td></tr>
<tr><td>Prix de vente HT au m²</td><td class="num">{f(ht/21)}</td><td></td></tr></tbody></table></div>'''
    return '<p>Atelier disponible dans la version interactive.</p>'

def clean(body):
    body=re.sub(r'<div class="lab" id="calc">.*?<p class="label"[^>]*>.*?</p>\s*</div>','<div class="note"><strong>Calculateur</strong><p>La version interactive calcule tout automatiquement. Sur papier, appliquez les formules ci-dessus : l\'exemple corrigé suit.</p></div>',body,flags=re.S)
    body=body.replace('<ol class="overview"></ol>','')
    body=body.replace('<h3>Au programme de ce module</h3>','')
    body=re.sub(r'<label class="check-mod">.*?</label>','',body,flags=re.S)
    return body

# serpentin statique
SERP=''
labels=[['A1','A2','A3','A4'],['A8','A7','A6','A5'],['B1','B2','B3','B4']]
for r in range(3):
    for c in range(4):
        SERP+=f'<rect x="{20+c*90}" y="{20+r*70}" width="80" height="60" rx="3" class="bx"/><text x="{60+c*90}" y="{44+r*70}" text-anchor="middle" class="t">{labels[r][c]}</text>'

parts=[]; toc=[]
mods=[f'm{i}' for i in range(15)]
for sid in mods:
    _,title,dur,attrs,body=S[sid]
    num=re.search(r'data-num="([^"]*)"',attrs).group(1); day=re.search(r'data-day="([^"]*)"',attrs).group(1)
    toc.append((num,title,dur,day))
    out=[f'<section class="mod"><div class="mhead"><span class="mnum">{num}</span><div><p class="meta">Module {num} · {dur} · Jour {day}</p><h2>{e(H.unescape(title))}</h2></div></div>']
    for kind,stitle,sbody in steps(body):
        stitle=H.unescape(stitle)
        if kind=='quiz':
            bank=D['MQ'].get(sid,[])
            h,k=qlist(bank,'Q'); ANS.append((f'Module {num} · Questions de contrôle',k))
            out.append(f'<div class="block quiz"><h3>Questions de contrôle</h3><p class="hint">Cochez une réponse par question. Dans l\'application, 3 questions sont tirées au hasard ; un module est validé avec 2 bonnes réponses sur 3. Corrigé en fin de document.</p>{h}</div>')
        elif kind=='atelier':
            out.append(f'<div class="block lab"><p class="tag">Atelier</p><h3>{e(re.sub("^Atelier : ","",stitle))}</h3>{lab_html(stitle.lower() if "NovaLCT" not in stitle and "LEDVISION" not in stitle and "HDPlayer" not in stitle else stitle, sbody)}</div>')
        else:
            out.append('<div class="block">'+clean(sbody)+'</div>')
    parts.append('\n'.join(out)+'</section>')

# évaluation finale
FQ=D['FQ0']+D['FQX']
fh,fk=qlist(FQ,'Q'); ANS.append(('Évaluation finale',fk))
# certification & glossaire
cert=steps(S['certif'][4])[0][2]; gloss=steps(S['gloss'][4])[0][2]

body_html=''.join(parts)
body_html=body_html.replace('<g id="grid"></g>','<g>'+SERP+'</g>')

toc_rows=''.join(f'<tr><td class="num">{n}</td><td>{e(H.unescape(t))}</td><td class="num">{d}</td><td class="num">J{dy}</td></tr>' for n,t,d,dy in toc)
ans_html=''.join(f'<h4>{e(t)}</h4><ul class="key">{"".join(k)}</ul>' for t,k in ANS)

RECETTE=''.join(f'<tr><td>{x}</td><td>☐</td><td></td></tr>' for x in ['Mire rouge, vert, bleu : aucun module défaillant','Blanc 100 % / 50 % / 10 % : uniformité, teinte','Noir : aucun pixel bloqué allumé','Dégradés : pas de marche, gamma correct','Mire pixel map : ordre et position des cabinets','Vidéo + caméra : pas de bandes, pas de saccades','Planéité, joints, habillage','Terre, différentiels, étiquetage des lignes','Burn-in de 24 à 72 h réalisé','Configuration sauvegardée et archivée','Mots de passe modifiés et remis',"Formation de l'utilisateur faite"])
INTERV=''.join(f'<tr><td>{x}</td><td></td></tr>' for x in ['Date, technicien','Symptôme observé','Zone (écran, port, cabinet, module, pixels)','Contrôles effectués (source, processeur, câble, carte, HUB, nappe, module)','Cause identifiée','Pièces remplacées (référence, lot, position)','Coefficients de calibration rechargés ?','Test final et mires utilisées'])
CERT=cert.replace('<h3>Projet de fin de formation</h3>','')
GLOSS=gloss.replace('<h3>Glossaire</h3>','')
css=open(os.path.join(HERE,'print.css'),encoding='utf8').read()
doc=f'''<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Formation Écrans LED</title><style>{css}</style></head><body>
<section class="cover">
 <div class="wall"><p class="osd"><span class="live">● SIGNAL OK</span><span>P2.6 · 3840 Hz · 16 bits · 800 nits</span><span>2304×1344 · 60 Hz</span></p>
 <h1>Formation<br>Écrans LED</h1>
 <p class="lede">Installation de tous les types d'écrans LED et programmation : NovaStar, Colorlight, Huidu.</p>
 <p class="rgb"><i style="background:#E0352A"></i><i style="background:#17A454"></i><i style="background:#2563EB"></i></p></div>
 <div class="facts"><div><span>Durée</span><b>35 h</b><em>5 jours</em></div><div><span>Modules</span><b>15</b><em>cours, ateliers, exercices</em></div><div><span>Évaluation</span><b>35</b><em>questions + corrigés</em></div><div><span>Niveau</span><b>Débutant</b><em>vers technicien autonome</em></div></div>
 <p class="coverfoot">Support du stagiaire · Version interactive : claude.ai/artifact/BqXmqQSoraScvtrsRb2UYw</p>
</section>
<section class="toc"><h2>Sommaire</h2>
<div class="tbl"><table><thead><tr><th>N°</th><th>Module</th><th>Durée</th><th>Jour</th></tr></thead><tbody>{toc_rows}
<tr><td class="num">—</td><td>Évaluation finale</td><td class="num">1 h</td><td class="num">J5</td></tr>
<tr><td class="num">—</td><td>Projet de certification</td><td class="num">½ j</td><td class="num">J5</td></tr>
<tr><td class="num">—</td><td>Glossaire, fiches pratiques et corrigés</td><td class="num"></td><td class="num"></td></tr></tbody></table></div>
<div class="note"><strong>Comment utiliser ce support</strong><p>Chaque module suit le même ordre : objectifs, cours, atelier, exercice pratique sur le mur, « À retenir » et questions de contrôle. Les ateliers interactifs de l'application sont ici en version papier, à compléter au crayon. Tous les corrigés sont regroupés à la fin.</p></div>
</section>
{body_html}
<section class="mod"><div class="mhead"><span class="mnum">✓</span><div><p class="meta">Évaluation · 1 h</p><h2>Évaluation finale</h2></div></div>
<div class="block quiz"><p class="hint">Banque de 35 questions. Dans l'application, 20 sont tirées au hasard, 3 essais sont autorisés et le seuil de validation est de 16 / 20. Corrigé en fin de document.</p>{fh}</div></section>
<section class="mod"><div class="mhead"><span class="mnum">★</span><div><p class="meta">Certification · ½ journée</p><h2>Projet de fin de formation</h2></div></div><div class="block">{CERT}</div></section>
<section class="mod"><div class="mhead"><span class="mnum">Aa</span><div><p class="meta">Référence</p><h2>Glossaire</h2></div></div><div class="block">{GLOSS}</div></section>
<section class="mod"><div class="mhead"><span class="mnum">✎</span><div><p class="meta">Fiches à photocopier</p><h2>Fiches pratiques</h2></div></div>
<div class="block"><h3>PV de recette</h3>
<div class="tbl"><table class="form"><tbody>
<tr><td>Client / site</td><td></td></tr><tr><td>Écran (type, pas, dimensions, résolution)</td><td></td></tr><tr><td>Contrôleur / lecteur, firmware</td><td></td></tr><tr><td>Date de mise en service</td><td></td></tr></tbody></table></div>
<div class="tbl"><table class="form"><thead><tr><th>Contrôle</th><th>Conforme</th><th>Réserve</th></tr></thead><tbody>
{RECETTE}
</tbody></table></div>
<div class="sign"><div>Pour l'installateur<br>Nom, date, signature</div><div>Pour le client<br>Nom, date, signature</div></div></div>
<div class="block"><h3>Fiche d'intervention et de dépannage</h3>
<div class="tbl"><table class="form"><tbody>
{INTERV}
</tbody></table></div></div>
</section>
<section class="mod answers"><div class="mhead"><span class="mnum">✔</span><div><p class="meta">Pour le formateur et l'auto-correction</p><h2>Corrigés</h2></div></div><div class="block">{ans_html}</div></section>
</body></html>'''
open(os.path.join(HERE,'formation-ecrans-led-print.html'),'w',encoding='utf8').write(doc)
print('HTML imprimable :', os.path.join(HERE,'formation-ecrans-led-print.html'))
print('PDF : chromium --headless --no-pdf-header-footer --print-to-pdf=formation-ecrans-led.pdf <HTML imprimable>')
