(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
var $$ = function(sel, root){ return [].slice.call((root||document).querySelectorAll(sel)); };
var fmt = function(n, d){ return n.toLocaleString('fr-FR', {maximumFractionDigits: d||0, minimumFractionDigits: d||0}); };
function el(tag, attrs, kids){
  var e = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function(k){
    if (k === 'text') e.textContent = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k.slice(0,2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  });
  (kids||[]).forEach(function(c){ if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function shuffle(a){ for (var i = a.length-1; i > 0; i--){ var j = Math.floor(Math.random()*(i+1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

/* ================= État ================= */
var KEY = 'formation-led-v3';
var st = {seen:{}, quiz:{}, pos:{}, last:null};
try { var raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (raw) st = Object.assign(st, raw); } catch(e){}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e){} if (TR && TR.ref) schedulePush(); }
var TR;

var sections = $$('#sections > section.mod');
var mods = sections.filter(function(s){ return !s.dataset.special; });
function stepsOf(s){ return $$(':scope > .step', s); }
function seenCount(id){ return (st.seen[id] || []).length; }
function isDone(s){
  var id = s.id, n = stepsOf(s).length;
  if (seenCount(id) < n) return false;
  if (id === 'm0') return true;
  return (st.quiz[id] || 0) >= 2;
}

/* ================= Accueil ================= */
var dayNames = {1:'Jour 1 · Découvrir', 2:'Jour 2 · Préparer', 3:'Jour 3 · Installer', 4:'Jour 4 · Programmer', 5:'Jour 5 · Exploiter'};
function buildHome(){
  var days = $('days'); days.innerHTML = '';
  [1,2,3,4,5].forEach(function(d){
    var wrap = el('div');
    wrap.appendChild(el('div', {'class':'dayhead'}, [el('span', {'class':'label', text: dayNames[d]})]));
    var grid = el('div', {'class':'tiles'});
    mods.filter(function(s){ return +s.dataset.day === d; }).forEach(function(s){ grid.appendChild(tile(s)); });
    wrap.appendChild(grid); days.appendChild(wrap);
  });
  var wrap = el('div');
  wrap.appendChild(el('div', {'class':'dayhead'}, [el('span', {'class':'label', text:'Évaluation et références'})]));
  var grid = el('div', {'class':'tiles'});
  sections.filter(function(s){ return s.dataset.special && !s.dataset.hide; }).forEach(function(s){ grid.appendChild(tile(s, true)); });
  wrap.appendChild(grid); days.appendChild(wrap);
  var done = mods.filter(isDone).length;
  $('gpTxt').textContent = done + ' / ' + mods.length + ' validés';
  $('gpBar').style.width = (done / mods.length * 100) + '%';
  var next = st.last || 'm0';
  $('resume').textContent = st.last ? 'Reprendre : ' + $(next).dataset.title : 'Commencer la formation';
}
function tile(s, special){
  var n = stepsOf(s).length, seen = Math.min(seenCount(s.id), n), done = isDone(s);
  var badge = special ? '' : done ? '<span class="badge ok">Validé</span>' : seen ? '<span class="badge go">En cours</span>' : '<span class="badge">À faire</span>';
  var labs = $$('.step[data-kind="atelier"]', s).length;
  var t = el('button', {'class':'tile' + (special ? ' special' : ''), type:'button', onclick:function(){ openMod(s.id); }});
  t.innerHTML = '<div class="top"><span class="num">' + s.dataset.num + '</span>' + badge + '</div>' +
    '<span class="ttl"></span>' +
    '<span class="meta">' + s.dataset.dur + (special ? '' : ' · ' + n + ' étapes' + (labs ? ' · ' + labs + ' atelier' + (labs > 1 ? 's' : '') : '')) + '</span>' +
    (special ? '' : '<div class="tbar"><i style="width:' + (seen / n * 100) + '%"></i></div>');
  t.querySelector('.ttl').textContent = s.dataset.title;
  return t;
}

/* ================= Vue module ================= */
var cur = null, idx = 0;
var kindLabel = {cours:'Cours', atelier:'Atelier interactif', pratique:'Sur le mur', quiz:'Validation'};
function openMod(id, i){
  var s = $(id); if (!s) return;
  cur = s; st.last = s.dataset.special ? st.last : id; save();
  sections.forEach(function(x){ x.hidden = x !== s; });
  $('home').hidden = true; $('modview').hidden = false;
  $('mvLabel').textContent = s.dataset.special ? s.dataset.dur : 'Module ' + s.dataset.num + ' · ' + s.dataset.dur;
  $('mvTitle').textContent = s.dataset.title;
  var nav = $('stepNav'); nav.innerHTML = '';
  var steps = stepsOf(s);
  steps.forEach(function(stp, k){
    var b = el('button', {type:'button', onclick:function(){ show(k); }}, [el('span', {'class':'sd', text: String(k+1)}), el('span', {text: stp.dataset.title})]);
    if (stp.dataset.kind === 'atelier') b.classList.add('kind-lab');
    nav.appendChild(el('li', null, [b]));
  });
  var ov = $$('.overview', s)[0];
  if (ov && !ov.children.length) steps.slice(1).forEach(function(stp){
    ov.appendChild(el('li', null, [el('span', {text: stp.dataset.title}), el('span', {'class':'kind' + (stp.dataset.kind === 'atelier' ? ' lab' : stp.dataset.kind === 'quiz' ? ' quiz' : ''), text: kindLabel[stp.dataset.kind]})]));
  });
  if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  show(typeof i === 'number' ? i : Math.min(st.pos[id] || 0, steps.length - 1));
  window.scrollTo(0, 0);
}
function show(k){
  var steps = stepsOf(cur); idx = Math.max(0, Math.min(k, steps.length - 1));
  steps.forEach(function(x, j){ x.hidden = j !== idx; });
  var stp = steps[idx];
  var seen = st.seen[cur.id] = st.seen[cur.id] || [];
  if (seen.indexOf(idx) < 0) seen.push(idx);
  st.pos[cur.id] = idx; save();
  $$('#stepNav button').forEach(function(b, j){ b.classList.toggle('cur', j === idx); b.classList.toggle('seen', seen.indexOf(j) >= 0); });
  var kd = stp.dataset.kind;
  $('stKind').textContent = kindLabel[kd]; $('stKind').className = 'kind' + (kd === 'atelier' ? ' lab' : kd === 'quiz' ? ' quiz' : '');
  var pos = 'Étape ' + (idx + 1) + ' / ' + steps.length;
  $('stPos').textContent = pos; $('stPos2').textContent = pos;
  $('prev').disabled = idx === 0;
  var last = idx === steps.length - 1;
  var mi = mods.indexOf(cur);
  if (!last) $('next').textContent = 'Suivant →';
  else if (mi >= 0 && mi < mods.length - 1) $('next').textContent = 'Module suivant →';
  else $('next').textContent = 'Retour à l’accueil';
  var curBtn = $$('#stepNav button')[idx]; if (curBtn && curBtn.scrollIntoView && window.innerWidth < 900) curBtn.scrollIntoView({block:'nearest', inline:'center'});
  if (stp.dataset.init !== '1'){ stp.dataset.init = '1'; $$('[data-lazy]', stp).forEach(function(x){ var f = LAZY[x.dataset.lazy]; if (f) f(); }); }
  if (stp.querySelector('#pitchCanvas')) drawViz();
  if (cur.id === 'attest') renderAttest();
  window.scrollTo(0, 0);
}
$('prev').addEventListener('click', function(){ show(idx - 1); window.scrollTo(0, 0); });
$('next').addEventListener('click', function(){
  var steps = stepsOf(cur);
  if (idx < steps.length - 1){ show(idx + 1); window.scrollTo(0, 0); return; }
  var mi = mods.indexOf(cur);
  if (mi >= 0 && mi < mods.length - 1) openMod(mods[mi + 1].id, 0); else goHome();
});
function goHome(){
  $('home').hidden = false; $('modview').hidden = true; cur = null;
  history.replaceState(null, '', '#accueil'); buildHome(); window.scrollTo(0, 0);
}
$('goHome').addEventListener('click', goHome);
$('backHome').addEventListener('click', goHome);
$('resume').addEventListener('click', function(){ openMod(st.last || 'm0'); });
$$('[data-open]').forEach(function(b){ b.addEventListener('click', function(){ openMod(b.dataset.open); }); });
window.addEventListener('hashchange', route);
function route(){
  var h = location.hash.replace('#', '');
  if (h && $(h) && $(h).classList.contains('mod')) openMod(h); else goHome();
}
document.addEventListener('keydown', function(e){
  if (!cur || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (e.key === 'ArrowRight') $('next').click();
  if (e.key === 'ArrowLeft' && !$('prev').disabled) $('prev').click();
});

/* Listes à cocher */
$$('ul.check li').forEach(function(li){ li.addEventListener('click', function(){ li.classList.toggle('on'); }); });

/* ================= Quiz des modules ================= */
var MQ = {
m1:[['Écran P3.9 : distance minimale de vision ?',['≈ 1 m','≈ 4 m','≈ 12 m'],1,'Distance minimale en mètres ≈ pas en millimètres.'],
    ['L’écran sera filmé en direct. Rafraîchissement minimum ?',['960 Hz','1 920 Hz','3 840 Hz'],2,'En dessous de 3 840 Hz, des bandes apparaissent à la caméra.'],
    ['Pour un pas de 0,9 mm, quelle technologie est typique ?',['DIP','COB','SMD 3535'],1,'Le COB permet les pas très fins avec une surface robuste.']],
m2:[['Une vitrine doit laisser voir l’intérieur du magasin :',['Écran transparent ou film LED','Écran extérieur P10','Sol LED'],0,'Les écrans transparents laissent passer 50 à 90 % de la lumière.'],
    ['Tournée de concerts, montage chaque soir :',['Intérieur fixe','Location (rental)','Tout-en-un'],1,'Cabinets légers, verrous rapides, bumpers.'],
    ['Écran à filmer dans un studio de production virtuelle :',['Studio XR : 7 680 Hz et genlock','Totem asynchrone','Périmétrique de stade'],0,'Rafraîchissement très élevé et synchronisation caméra.']],
m3:[['Quelle carte extrait la zone d’image de son cabinet ?',['La carte émettrice','La carte réceptrice','La carte HUB'],1,'Chaque carte réceptrice ne garde que sa portion d’image.'],
    ['Un contrôleur asynchrone…',['Affiche la source HDMI en direct','Joue un contenu stocké, sans PC','Convertit en fibre'],1,'Il lit des programmes planifiés depuis sa mémoire.'],
    ['Le fichier de configuration de la carte réceptrice dépend…',['Du contenu vidéo','Du module exact (driver IC, scan)','Du câble réseau'],1,'Un autre lot de modules peut exiger un autre fichier.']],
m4:[['Écran de 6 × 3 m en cabinets 500 × 500 : combien de cabinets ?',['36','72','144'],1,'12 colonnes × 6 rangées.'],
    ['Résolution d’un cabinet 500 × 500 en P3.91 ?',['128 × 128','192 × 192','256 × 256'],0,'500 / 3,906 ≈ 128.'],
    ['Capacité d’un port Gigabit en 8 bits à 60 Hz ?',['≈ 65 000 px','≈ 650 000 px','≈ 6,5 millions px'],1,'655 360 pixels chez NovaStar.']],
m5:[['Écran suspendu au-dessus du public : obligatoire en plus des palans ?',['Des élingues de sécurité indépendantes','Un capteur de luminosité','Un cadre en bois'],0,'La sécurité secondaire est indispensable.'],
    ['Écran fixe sur mât en extérieur :',['Pose libre','Note de calcul par un bureau d’études','Chevilles dans l’isolant'],1,'Vent, fondation, ancrages : tout doit être calculé.'],
    ['Plus le pas est fin, plus la planéité exigée est…',['stricte','souple','sans importance'],0,'Une marche de 0,2 mm se voit sur un pas fin.']],
m6:[['Le différentiel 30 mA saute à l’allumage. Cause probable ?',['Contenu trop lumineux','Cumul des fuites des alimentations','Câble Cat6 trop long'],1,'Répartissez les alimentations sur plusieurs différentiels.'],
    ['Comment allumer un grand écran ?',['Tout d’un coup en blanc','Départ par départ, image sombre','Peu importe'],1,'On limite l’appel de courant.'],
    ['La terre sur chaque cabinet est…',['obligatoire','conseillée','inutile en intérieur'],0,'Appareils de classe I.']],
m7:[['Écran stocké 6 mois dans un lieu humide :',['Allumer à 100 % pour sécher','Préchauffer par paliers de luminosité','Le chauffer au décapeur'],1,'Sinon, risque de pixels morts et de « chenilles ».'],
    ['Quelle rangée demande le plus de soin ?',['La première','La dernière','Celle du milieu'],0,'Une erreur à la base se propage sur toute la hauteur.'],
    ['Pourquoi tester les cabinets au sol ?',['Pour gagner du temps en hauteur','C’est interdit','Pour la calibration couleur'],0,'Un cabinet défectueux se change bien plus facilement au sol.']],
m8:[['Longueur maximale d’un câble Cat6 entre deux équipements ?',['30 m','100 m','500 m'],1,'Au-delà, passez en fibre.'],
    ['À quoi sert la boucle de secours ?',['À alimenter la chaîne par l’autre bout si un câble casse','À doubler la luminosité','À brancher un second PC'],0,'Le dernier cabinet est relié à un port de secours.'],
    ['Un plan de câblage se dessine…',['vu de derrière sans le préciser','vu de face, en l’indiquant','ce n’est pas utile'],1,'Toujours préciser le point de vue.']],
m9:[['Après « Send to HW », que faut-il faire pour garder la configuration ?',['Rien','Save (enregistrer dans les cartes)','Débrancher l’USB'],1,'Sans Save, tout est perdu à la coupure.'],
    ['Avant de modifier la configuration d’un écran existant :',['Lire et sauvegarder la configuration actuelle','Réinitialiser les cartes','Changer les câbles'],0,'On peut ainsi revenir en arrière.'],
    ['Que contient un fichier .rcfgx ?',['La vidéo','Les paramètres de carte réceptrice','Le planning'],1,'Module, scan, driver IC, rafraîchissement.']],
m10:[['Première chose à faire sur un lecteur asynchrone neuf ?',['Changer les mots de passe par défaut','Lancer une vidéo','Désactiver la luminosité auto'],0,'Les mots de passe d’usine sont publics.'],
    ['VNNOX sert à…',['Gérer un parc d’écrans à distance','Calibrer les LED','Calculer les structures'],0,'C’est la plateforme cloud de NovaStar.'],
    ['La nuit, un panneau publicitaire extérieur doit…',['Rester à 100 %','Baisser ou s’éteindre selon la réglementation','Clignoter'],1,'Capteur, planning et règlement local de publicité.']],
m11:[['Pour une image nette, le contenu doit être produit…',['en 1920 × 1080 toujours','à la résolution native de l’écran','en 720p'],1,'Pixel pour pixel.'],
    ['Pourquoi préférer les fonds sombres ?',['Moins de consommation et meilleur contraste','Le blanc est interdit','Pour le moiré'],0,'Et une durée de vie prolongée.'],
    ['Source en 30 i/s, processeur en 50 Hz :',['Aucun souci','Risque de saccades','L’écran s’éteint'],1,'Alignez les fréquences.']],
m12:[['Quelle mire révèle des pixels allumés en permanence ?',['Blanc 100 %','Noir','Rouge'],1,'Sur fond noir, un pixel bloqué allumé saute aux yeux.'],
    ['Avant la réception, on fait tourner l’écran…',['10 minutes','24 à 72 h (burn-in)','Jamais'],1,'Pour révéler les défauts de jeunesse.'],
    ['Température de couleur de référence en vidéo :',['3 200 K','6 500 K','9 300 K'],1,'Le blanc D65.']],
m14:[['Dans un devis d\u2019écran LED, on oublie souvent…',['Le prix au mètre carré','Transport, levage, mise en service et rechanges','La TVA'],1,'Ces postes pèsent vite 10 à 20 % du total.'],
    ['Un contrat de maintenance sérieux précise…',['Le délai d\u2019intervention et les exclusions','La couleur des cabinets','Le logiciel de montage'],0,'GTI, GTR, exclusions de garantie : par écrit.'],
    ['Des cabinets restent 3 mois en entrepôt :',['Local sec, déshydratants, allumage régulier','Dehors sous bâche','Empilés face LED contre face LED'],0,'L\u2019humidité est l\u2019ennemie des LED.']],
m13:[['Tous les cabinets après le n° 5 sont noirs :',['Câble entre 4 et 5 ou carte du 5','Le PC source','Le fichier vidéo'],0,'La chaîne est interrompue à cet endroit.'],
    ['Un module neuf est plus clair que les autres :',['Il est défectueux','Coefficients de calibration à charger','Câble réseau à changer'],1,'Autre lot, autre calibration.'],
    ['La méthode de diagnostic de base :',['Délimiter, remonter la chaîne, permuter','Tout remplacer','Redémarrer le PC'],0,'On isole l’élément en cause.']]
};
var MQX = {
m1:[['Que mesure le pas de pixel ?',['La taille d’une LED','La distance entre les centres de deux pixels','La diagonale de l’écran'],1,'En millimètres : P2.6 = 2,6 mm.'],['Un écran intérieur standard affiche en général…',['600 à 1 500 nits','5 000 à 8 000 nits','Moins de 100 nits'],0,'Au-delà, l’image éblouit en intérieur.'],['Avantage principal de la cathode commune ?',['Moins de consommation et de chaleur','Plus de pixels','Pas besoin de carte réceptrice'],0,'Environ 30 à 40 % d’économie.']],
m2:[['Écran collé au mur sans accès arrière : quelle maintenance ?',['Par l’arrière','Par l’avant (modules magnétiques)','Aucune'],1,'La maintenance avant évite une passerelle arrière.'],['Un sol LED exige surtout…',['Un support nivelé et une charge admissible suffisante','Un indice IP20','Un scan 1/64'],0,'Il faut contrôler le plancher et niveler chaque pied.'],['Colonne cylindrique décorative :',['Modules flexibles','Cabinets acier 960 × 960','Totem asynchrone'],0,'Les modules flexibles épousent la courbe.']],
m3:[['Rôle de la carte HUB ?',['Répartir les signaux vers les nappes des modules','Convertir le 230 V','Stocker les vidéos'],0,'Elle fait le lien entre carte réceptrice et modules.'],['Tension typique en sortie d’alimentation d’un cabinet ?',['230 V','5 V (ou moins en cathode commune)','48 V'],1,'Les modules sont alimentés en basse tension.'],['Un processeur VX, c’est…',['Une carte émettrice avec mise à l’échelle et couches','Un module LED','Un capteur de luminosité'],0,'Un tout-en-un pour la régie.']],
m4:[['Pixels par m² en P3.91 ?',['≈ 16 000','≈ 65 500','≈ 250 000'],1,'(1000 / 3,906)² ≈ 65 536.'],['Puissance moyenne typique par rapport au maximum ?',['Environ un tiers','Le double','Identique'],0,'Le contenu vidéo est rarement tout blanc.'],['Un mur de 3,1 millions de pixels demande au minimum…',['2 ports','5 ports','20 ports'],1,'3,1 M / 650 000 ≈ 4,8, arrondi à 5.']],
m5:[['Angle entre cabinets de 500 mm pour un rayon de 6 m ?',['≈ 1°','≈ 4,8°','≈ 15°'],1,'360 × 0,5 / (2π × 6) ≈ 4,8°.'],['Fixer un écran sur une cloison en placo seule :',['Possible avec de bonnes chevilles','Jamais : il faut un support porteur','Oui sous 50 kg'],1,'Le placo ne porte pas un écran.'],['Travail en hauteur : priorité à…',['Protections collectives (nacelle, échafaudage)','Harnais seul','Échelle'],0,'Le harnais vient en dernier recours.']],
m6:[['Un groupe électrogène se dimensionne à…',['≈ 1,5 × la puissance max de l’écran','La puissance moyenne','La moitié du max'],0,'Charge non linéaire, marge indispensable.'],['Pourquoi équilibrer les phases ?',['Éviter une phase saturée et un neutre surchargé','Pour la couleur','Ce n’est pas utile'],0,'Répartissez les départs sur L1, L2, L3.'],['Disjoncteur qui saute au démarrage : courbe conseillée ?',['B','C ou D','Aucune importance'],1,'Elles tolèrent l’appel de courant.']],
m7:[['À la réception du matériel, on commence par…',['Contrôler caisses, chocs et numéros de série','Monter directement','Allumer en plein blanc'],0,'Toute réserve se note à la livraison.'],['Écran extérieur : les câbles entrent…',['Par le haut','Par le bas avec boucle d’égouttement','Par l’avant'],1,'L’eau ne doit pas suivre le câble.'],['Pas fin ou COB : la surface LED se manipule…',['À mains nues','Avec gants et protection antistatique','Au chiffon humide'],1,'La surface est fragile et sensible à l’électricité statique.']],
m8:[['Au-delà de 100 m entre régie et écran :',['Rallonger le Cat6','Convertisseurs fibre','Wi-Fi'],1,'La fibre porte les données sur des kilomètres.'],['Un port porte 650 000 px, un cabinet 36 864 px : combien de cabinets au maximum ?',['12','17','30'],1,'17 × 36 864 = 626 688 px.'],['Pourquoi câbler en serpentin ?',['Câbles courts et plan simple à suivre','C’est obligatoire','Pour la calibration'],0,'Aller sur une rangée, retour sur la suivante.']],
m9:[['Mot de passe d’usine du mode avancé de NovaLCT ?',['admin','1234','Aucun'],0,'À changer en production.'],['Dans LEDVISION, le fichier de carte réceptrice a l’extension…',['.rcfgx','.rcvbp','.mp4'],1,'.rcfgx est l’équivalent NovaStar.'],['Sur un VX, une incrustation caméra par-dessus les paroles s’appelle…',['Un PIP (couche)','Un scan','Un gamma'],0,'Les couches se règlent en façade ou au logiciel.']],
m10:[['Dans ViPlex, une « solution » est…',['Un programme fait de pages et de fenêtres','Un firmware','Un câble'],0,'Elle se publie ensuite vers les lecteurs.'],['Le point d’accès Wi-Fi d’un lecteur Huidu…',['Commence par « HD- »','Commence par « AP- »','S’appelle toujours « Huidu »'],0,'« AP » + numéro de série, c’est chez NovaStar.'],['Pendant une mise à jour de firmware :',['On peut couper le courant','Ne jamais couper le courant','Débrancher le réseau'],1,'Une coupure peut rendre la carte inutilisable.']],
m11:[['Écran 2304 × 1344 et sortie PC 1920 × 1080 en découpe :',['Tout s’affiche','Une partie de l’écran ne reçoit rien','L’image est déformée'],1,'Il faut une sortie plus grande ou une mise à l’échelle.'],['Mise à l’échelle avec des rapports d’aspect différents :',['Image déformée ou bandes noires','Aucun effet','Meilleure netteté'],0,'Gardez le même rapport d’aspect.'],['Colonne de 1 m de diamètre en P2.5 : pixels sur le tour ?',['≈ 400','≈ 1 257','≈ 3 142'],1,'π × 1 000 / 2,5 ≈ 1 257.']],
m12:[['Uniformité de luminosité attendue après calibration ?',['≥ 97 %','≥ 50 %','Sans importance'],0,'Valeur usuelle à préciser au contrat.'],['Défaut visible seulement à faible luminosité : quelle mire ?',['Blanc 10 %','Rouge 100 %','Grille'],0,'Les écarts de lot ressortent à bas niveau.'],['Le dossier remis au client contient…',['Plans, fichiers de configuration, identifiants, PV','Seulement la facture','Rien'],0,'C’est la base de toute intervention future.']],
m13:[['Cabinet brouillé après remplacement de la carte réceptrice :',['Renvoyer le fichier de carte et sauvegarder','Changer tous les modules','Changer le PC'],0,'Une carte neuve n’a pas la bonne configuration.'],['Traînée de pixels faiblement allumés (« chenille ») :',['Humidité','Câble HDMI','Luminosité trop basse'],0,'Préchauffage progressif.'],['Stock de modules de rechange conseillé ?',['3 à 5 % du même lot','Aucun','50 %'],0,'Même lot = même teinte.']],
m14:[['GTI dans un contrat de maintenance :',['Garantie de temps d’intervention','Gestion technique informatique','Garantie totale incluse'],0,'Le délai est écrit dans le contrat.'],['Un cabinet se transporte…',['Face LED protégée, en flight case','Face LED au sol','En vrac'],0,'Les coins et la face LED sont fragiles.'],['Pourquoi chiffrer des modules de rechange ?',['Pour remplacer avec le même lot, donc la même teinte','Pour gonfler le prix','Inutile'],0,'Un lot différent se voit à l’écran.']]
};
var FQX = [
['Quelle technologie protège des LED SMD sous une résine ?',['GOB','DIP','MiP'],0,'Glue On Board : robuste pour la location et les sols.'],
['Écran P2.6 : distance de vision confortable ?',['≈ 1 m','≈ 5 à 8 m','≈ 50 m'],1,'2 à 3 × le pas, en mètres.'],
['Rôle du capteur de luminosité ?',['Adapter la luminosité à l’éclairage ambiant','Mesurer la température','Détecter le public'],0,'Utile surtout en extérieur.'],
['Un processeur qui bascule sur une autre source si le PC tombe utilise…',['Une entrée de secours','Le genlock','Le gamma'],0,'À déclarer dans les réglages d’entrée.'],
['Combien de cabinets de 500 × 1 000 mm pour un écran de 4 × 3 m ?',['24','12','48'],0,'8 colonnes × 3 rangées.'],
['Au-delà de combien de degrés par joint les verrous d’angle courants ne suffisent plus ?',['10°','1°','45°'],0,'Au-delà : rayon plus grand ou modules flexibles.'],
['Courant de fuite à ne pas dépasser sur un différentiel 30 mA ?',['≈ 9 mA','30 mA','100 mA'],0,'Environ 30 % du seuil.'],
['Taurus, C-series et HD-A3 sont des…',['Lecteurs asynchrones','Modules','Alimentations'],0,'NovaStar, Colorlight, Huidu.'],
['Pour un affichage pixel pour pixel sans découpe, le PC doit sortir…',['La résolution native de l’écran','Toujours du 4K','Du 720p'],0,'Résolution personnalisée ou EDID.'],
['Un défaut qui suit le module quand on le permute vient…',['Du module','De la carte HUB','Du câble réseau'],0,'Permuter isole l’élément en cause.'],
['Module GOB ou COB défectueux :',['Retour en usine','LED changée sur place à l’air chaud','Remplacer tout l’écran'],0,'La résine ou les puces nues empêchent la réparation locale.'],
['Dans un devis, la main-d’œuvre se calcule…',['Jours × techniciens × taux journalier','Au m² uniquement','Elle est offerte'],0,'Ajoutez déplacements et nuits.'],
['Écran publicitaire extérieur la nuit :',['Respecter extinction et luminance réglementaires','100 % toute la nuit','Clignotements autorisés'],0,'Règlement local de publicité.'],
['Quelle mire vérifie l’ordre des cabinets ?',['La mire pixel map numérotée','Le rouge plein','Le noir'],0,'Chaque cabinet affiche son numéro.'],
['Que faire d’un fichier de configuration après la mise en service ?',['L’archiver dans le dossier client et sur une clé près du contrôleur','Le supprimer','L’envoyer au public'],0,'Il permet de reconfigurer en quelques minutes.']
];
function pickQuiz(bank, n){
  return shuffle(bank.slice()).slice(0, n).map(function(q){
    var o = q[1].map(function(t, i){ return {t:t, ok: i === q[2]}; });
    shuffle(o);
    return [q[0], o.map(function(x){ return x.t; }), o.findIndex(function(x){ return x.ok; }), q[3]];
  });
}

Object.keys(MQX).forEach(function(k){ MQ[k] = (MQ[k] || []).concat(MQX[k]); });
function renderQuiz(box, Q, onDone){
  box.innerHTML = '';
  var score = 0, answered = 0;
  Q.forEach(function(q, qi){
    var d = el('div', {'class':'q'});
    var p = el('p'); p.appendChild(el('span', {'class':'qn', text:'Q' + (qi+1) + ' · '})); p.appendChild(document.createTextNode(q[0])); d.appendChild(p);
    var o = el('div', {'class':'opts'});
    q[1].forEach(function(a, ai){
      o.appendChild(el('button', {'class':'opt', type:'button', text:a, onclick:function(ev){
        $$('button', o).forEach(function(x){ x.disabled = true; });
        o.children[q[2]].classList.add('right');
        if (ai === q[2]) score++; else ev.currentTarget.classList.add('wrong');
        answered++;
        d.appendChild(el('p', {'class':'expl', text:q[3]}));
        onDone(score, answered, Q.length);
      }}));
    });
    d.appendChild(o); box.appendChild(d);
  });
  onDone(0, 0, Q.length);
}
$$('[data-quiz]').forEach(function(box){
  var id = box.dataset.quiz, Q;
  var sc = $$('[data-score="' + id + '"]')[0];
  function run(){
    Q = pickQuiz(MQ[id] || [], 3);
    renderQuiz(box, Q, function(s, a, n){
      if (!a) { sc.textContent = (st.quiz[id] >= 2 ? 'Déjà validé · ' : '') + '0 / ' + n; return; }
      sc.textContent = s + ' / ' + n + (a === n ? (s >= 2 ? ' · module validé ✓' : ' · à retravailler') : '');
      if (a === n){ st.quiz[id] = Math.max(st.quiz[id] || 0, s); save(); }
    });
  }
  $$('[data-retry="' + id + '"]')[0].addEventListener('click', run);
  run();
});
var FQ = FINAL_QUIZ.concat(FQX);
function maxTries(){ return 3 + (st.bonus || 0); }
function finalGate(){
  var box = $('quiz'), used = st.finalTries || 0, left = maxTries() - used;
  box.innerHTML = '';
  $('resetQuiz').hidden = true;
  $('score').textContent = st.final ? 'Meilleure note : ' + st.final + ' / 20' : 'Pas encore passée';
  var info = el('div', {'class':'q'});
  info.appendChild(el('p', {text: left > 0 ? 'Essais restants : ' + left + ' sur ' + maxTries() + '.' : 'Vous avez utilisé tous vos essais.'}));
  info.appendChild(el('p', {'class':'expl', text: left > 0 ? '20 questions tirées au hasard dans une banque de ' + FQ.length + '. Un essai est compté dès que vous commencez : ne rechargez pas la page en cours de route. Votre meilleure note est gardée.' : 'Demandez au formateur un essai supplémentaire. Il l\u2019accorde depuis l\u2019espace formateur, puis rechargez la page.'}));
  if (left > 0) info.appendChild(el('button', {'class':'btn primary', type:'button', text:'Commencer l\u2019essai ' + (used + 1), onclick: startFinal}));
  box.appendChild(info);
}
function startFinal(){
  st.finalTries = (st.finalTries || 0) + 1; save();
  var Q = pickQuiz(FQ, 20);
  renderQuiz($('quiz'), Q, function(s, a, n){
    $('score').textContent = s + ' / ' + n + (a === n ? (s >= 16 ? ' · validé' : ' · à retravailler') : ' · essai ' + st.finalTries + ' / ' + maxTries());
    if (a === n){
      if (s > (st.final || 0)) st.final = s;
      save();
      var r = $('resetQuiz'); r.hidden = false; r.textContent = 'Retour aux essais';
    }
  });
}
$('resetQuiz').addEventListener('click', finalGate); finalGate();

/* ================= Schéma serpentin ================= */
(function(){
  var g = $('grid'), NS = 'http://www.w3.org/2000/svg';
  var labels = [['A1','A2','A3','A4'],['A8','A7','A6','A5'],['B1','B2','B3','B4']];
  if (g) for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++){
    var rect = document.createElementNS(NS,'rect');
    rect.setAttribute('x', 20+c*90); rect.setAttribute('y', 20+r*70); rect.setAttribute('width', 80); rect.setAttribute('height', 60); rect.setAttribute('rx', 3); rect.setAttribute('class','bx');
    g.appendChild(rect);
    var t = document.createElementNS(NS,'text');
    t.setAttribute('x', 60+c*90); t.setAttribute('y', 44+r*70); t.setAttribute('text-anchor','middle'); t.setAttribute('class','t'); t.textContent = labels[r][c];
    g.appendChild(t);
  }
})();

/* ================= Simulateur de pas ================= */
var cv = $('pitchCanvas'), drawViz = function(){};
if (cv){
  var ctx = cv.getContext('2d'), src = document.createElement('canvas'), sctx = src.getContext('2d'), VW = 700, VH = 350;
  drawViz = function(){
    var p = parseFloat($('vP').value), d = parseFloat($('vD').value);
    $('vPo').textContent = p.toFixed(1) + ' mm'; $('vDo').textContent = fmt(d, d % 1 ? 1 : 0) + ' m';
    var cols = Math.max(8, Math.round(VW / p)), rows = Math.max(4, Math.round(VH / p));
    src.width = cols; src.height = rows;
    var grd = sctx.createLinearGradient(0, 0, cols, rows);
    grd.addColorStop(0, '#1b3bd6'); grd.addColorStop(.5, '#c21d7a'); grd.addColorStop(1, '#f39b1a');
    sctx.fillStyle = grd; sctx.fillRect(0, 0, cols, rows);
    sctx.fillStyle = '#fff'; sctx.font = '700 ' + Math.round(rows * .55) + 'px Archivo, Arial, sans-serif';
    sctx.textAlign = 'center'; sctx.textBaseline = 'middle'; sctx.fillText('LED', cols / 2, rows * .53);
    var img = sctx.getImageData(0, 0, cols, rows).data, cw = cv.width, ch = cv.height, s = cw / cols;
    var blur = .29 * d * (cw / VW);
    ctx.save(); ctx.fillStyle = '#07090C'; ctx.fillRect(0, 0, cw, ch);
    ctx.filter = blur > .3 ? 'blur(' + (blur * .5).toFixed(2) + 'px)' : 'none';
    var dot = Math.max(.6, s * .62);
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++){
      var i = (y * cols + x) * 4;
      ctx.fillStyle = 'rgb(' + img[i] + ',' + img[i+1] + ',' + img[i+2] + ')';
      ctx.fillRect(x * s + (s - dot) / 2, y * s + (s - dot) / 2, dot, dot);
    }
    ctx.restore();
    var smooth = p / .29, v;
    if (d < p) v = 'Trop près : sous la distance minimale (' + fmt(p,1) + ' m). La grille de pixels est très visible.';
    else if (d < smooth) v = 'Acceptable pour la vidéo : pixels encore perceptibles jusqu’à ≈ ' + fmt(smooth,0) + ' m. Le texte fin reste granuleux.';
    else v = 'Image lisse : au-delà de ≈ ' + fmt(smooth,0) + ' m, l’œil ne distingue plus les pixels.';
    $('vVerdict').textContent = v;
  };
  $('vP').addEventListener('input', drawViz); $('vD').addEventListener('input', drawViz);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ if (!cv.closest('[hidden]')) drawViz(); });
}

/* ================= Calculateur ================= */
(function(){
  if (!$('calc')) return;
  $('cCab').addEventListener('change', function(){ var p = this.value.split('|'); $('cKg').value = p[1]; $('cWm').value = p[2]; calc(); });
  ['cW','cH','cP','cWm','cKg','cBit','cPh'].forEach(function(id){ $(id).addEventListener('input', calc); });
  function calc(){
    var W = parseFloat($('cW').value)*1000, H = parseFloat($('cH').value)*1000, P = parseFloat($('cP').value);
    var dims = $('cCab').value.split('|')[0].split('x'), cw = parseFloat(dims[0]), ch = parseFloat(dims[1]);
    var wm = parseFloat($('cWm').value), kg = parseFloat($('cKg').value), cap = parseFloat($('cBit').value), ph = parseInt($('cPh').value, 10);
    if (!(W > 0 && H > 0 && P > 0 && wm > 0 && kg > 0)) return;
    var nx = Math.max(1, Math.round(W/cw)), ny = Math.max(1, Math.round(H/ch));
    var resX = nx*Math.round(cw/P), resY = ny*Math.round(ch/P), pix = resX*resY;
    var area = nx*cw/1000*ny*ch/1000, ports = Math.ceil(pix/cap), pmax = area*wm;
    var amp = ph === 1 ? pmax/230 : pmax/(Math.sqrt(3)*400*.95);
    $('oCab').textContent = nx + ' × ' + ny + ' = ' + (nx*ny);
    $('oSize').textContent = fmt(nx*cw/1000,2) + ' × ' + fmt(ny*ch/1000,2) + ' m';
    $('oRes').textContent = resX + ' × ' + resY; $('oPix').textContent = fmt(pix); $('oPorts').textContent = ports;
    $('oArea').textContent = fmt(area,2) + ' m²'; $('oPow').textContent = fmt(pmax/1000,1) + ' / ' + fmt(pmax*.33/1000,1) + ' kW';
    $('oAmp').textContent = fmt(amp,1) + ' A' + (ph === 3 ? ' /ph' : ''); $('oKg').textContent = fmt(area*kg) + ' kg';
    var reco = [];
    if (resX > 3840 || resY > 2160) reco.push('Au-delà de la 4K : plusieurs sorties ou processeur multi-entrées.');
    else if (resX > 1920 || resY > 1080) reco.push('Résolution supérieure à 1920×1080 : processeur 4K ou mise à l’échelle.');
    reco.push('Prévoir ' + (ports + Math.max(1, Math.ceil(ports*.2))) + ' ports avec marge et redondance.');
    if (ph === 1 && amp > 32) reco.push('Plus de 32 A en monophasé : passer en triphasé.');
    reco.push('Environ ' + Math.ceil(amp*(ph === 3 ? 3 : 1)/12.8) + ' départs de 16 A chargés à 80 %.');
    reco.push('Distance de vision : minimum ' + fmt(P,1) + ' m, confort ' + fmt(P*2,0) + ' à ' + fmt(P*3,0) + ' m.');
    if (area*kg > 500) reco.push('Plus de 500 kg : structure et accroches validées par un bureau d’études.');
    var ul = $('oReco'); ul.innerHTML = ''; reco.forEach(function(r){ ul.appendChild(el('li', {text:r})); });
  }
  calc();
})();

/* ================= Chaîne du signal ================= */
(function(){
  if (!$('chainBtns')) return;
  var C = [
    ['Source','PC · lecteur','Ordinateur, lecteur multimédia, mélangeur vidéo ou caméra. Elle fournit l’image en HDMI, DisplayPort, DVI ou SDI.','Réglage : résolution et fréquence de sortie (idéalement la résolution native de l’écran).','Panne typique : mauvaise résolution de sortie, écran PC en mode « dupliquer », câble HDMI trop long.'],
    ['Processeur','carte émettrice','Reçoit la vidéo, la met éventuellement à l’échelle et la découpe en paquets réseau pour chaque port (NovaStar MCTRL, VX ; Colorlight X, Z).','Réglage : entrée, résolution, luminosité globale, couches et préréglages.','Panne typique : entrée non détectée, mode « blackout » activé, luminosité à 0.'],
    ['Câble Cat6','≤ 100 m','Transporte les données du port vers le premier cabinet, puis de cabinet en cabinet. Au-delà de 100 m : fibre.','Réglage : aucun, mais parcours et étiquetage soignés.','Panne typique : connecteur abîmé qui coupe toute la fin de la chaîne.'],
    ['Carte réceptrice','dans le cabinet','Extrait la portion d’image de son cabinet et pilote les modules. Elle stocke le fichier de configuration et la calibration.','Réglage : fichier .rcfgx / .rcvbp, rafraîchissement, gamma.','Panne typique : carte de rechange sans fichier → cabinet brouillé.'],
    ['Carte HUB','adaptateur','Répartit les signaux de la carte réceptrice vers les nappes des modules (HUB75, HUB320…).','Réglage : aucun.','Panne typique : broche tordue → une couleur manque sur une rangée de modules.'],
    ['Modules','LED + drivers','Circuits portant les LED et leurs drivers (ICN, MBI, FM…). Ce sont eux qui produisent la lumière.','Réglage : coefficients de calibration.','Panne typique : pixels morts, module noir, module plus clair après remplacement.'],
    ['Alimentation','230 V → 5 V','Convertit le secteur en basse tension pour les modules et la carte réceptrice.','Réglage : aucun. Vérifier la terre et la répartition des lignes.','Panne typique : module ou cabinet noir, redémarrages en plein blanc.']
  ];
  var box = $('chainBtns'), info = $('chainInfo');
  C.forEach(function(c, i){
    if (i) box.appendChild(el('span', {'class':'arr', 'aria-hidden':'true', text: i === 6 ? '+' : '→'}));
    box.appendChild(el('button', {type:'button', 'aria-pressed':'false', onclick:function(){ pick(i); }}, [c[0], el('small', {text:c[1]})]));
  });
  function pick(i){
    $$('button', box).forEach(function(b, j){ b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
    var c = C[i]; info.innerHTML = '';
    info.appendChild(el('h4', {text:c[0]})); info.appendChild(el('p', {text:c[2]})); info.appendChild(el('p', {text:c[3]}));
    info.appendChild(el('p', {text:c[4], style:'color:var(--bad)'}));
  }
  pick(0);
})();

/* ================= Galerie des types ================= */
(function(){
  var srcBox = $('typesSrc'); if (!srcBox) return;
  var cats = {'Intérieur fixe':['int'],'Extérieur fixe':['ext'],'Location (rental)':['evt'],'Pas fin / COB':['int'],'Transparent / grille / film':['spe','int'],'Flexible / souple':['spe'],'Sol LED (dance floor)':['evt','spe'],'Créatifs':['spe','evt'],'Tout-en-un (All-in-one)':['int'],'Affiches / totems LED':['int'],'Périmétriques de stade':['ext','evt'],'Mobiles (camion, remorque)':['ext','evt'],'Studio XR / production virtuelle':['spe']};
  var F = [['all','Tous'],['int','Intérieur'],['ext','Extérieur'],['evt','Événementiel'],['spe','Spécial / créatif']];
  var items = $$(':scope > div', srcBox), grid = $('galGrid'), info = $('galInfo'), fl = $('galFilters'), btns = [];
  items.forEach(function(it, i){
    var name = it.querySelector('h4').textContent, spec = it.querySelector('.spec').textContent;
    var b = el('button', {type:'button', 'aria-pressed':'false', onclick:function(){ pick(i); }}, [el('b', {text:name}), el('span', {text:spec})]);
    b.dataset.c = (cats[name] || []).join(' '); btns.push(b); grid.appendChild(b);
  });
  F.forEach(function(f){
    fl.appendChild(el('button', {'class':'chip', type:'button', 'aria-pressed': f[0] === 'all' ? 'true' : 'false', text:f[1], onclick:function(ev){
      $$('button', fl).forEach(function(x){ x.setAttribute('aria-pressed', x === ev.currentTarget ? 'true' : 'false'); });
      btns.forEach(function(b){ b.hidden = f[0] !== 'all' && b.dataset.c.split(' ').indexOf(f[0]) < 0; });
    }}));
  });
  function pick(i){
    btns.forEach(function(b, j){ b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
    info.innerHTML = items[i].innerHTML;
  }
  pick(0);
})();

/* ================= Scénarios ================= */
(function(){
  var box = $('scenList'); if (!box) return;
  var S = [
    ['Une église de 400 places veut un écran derrière l’estrade, public entre 5 et 25 m, cultes diffusés en direct.',['P10 extérieur, 1 920 Hz','P2.6 intérieur, 3 840 Hz, contrôle synchrone','Totem asynchrone P2.5'],1,'Pas adapté au premier rang (≥ 2,6 m), rafraîchissement compatible caméra, image en direct depuis la régie.'],
    ['Une pharmacie veut diffuser ses promotions en vitrine, face au soleil l’après-midi, sans cacher l’intérieur.',['Écran transparent haute luminosité, lecteur asynchrone','Écran intérieur 800 nits','Sol LED'],0,'Transparence pour garder la vue sur la boutique, luminosité ≥ 3 000 nits, programmation planifiée.'],
    ['Un centre commercial veut un panneau publicitaire de 4 × 3 m en façade, visible depuis le parking à 30 m.',['P2.6 intérieur','P6 à P8 extérieur IP65, 6 000 nits, asynchrone avec gestion cloud','Film LED'],1,'Grande distance, soleil, pluie : extérieur étanche et très lumineux, pilotage à distance.'],
    ['Une société de location équipe une tournée de concerts en salle et en plein air.',['Cabinets location 500 × 500 P3.9, IP65, bumpers','Cabinets acier 960 × 960','Tout-en-un 165"'],0,'Montage rapide, suspension, étanchéité pour les dates en plein air.'],
    ['Une salle de contrôle veut un mur d’images vu à 2 m, affiché 24 h/24.',['P3.9 location','P1.2 COB, maintenance avant, processeur à couches','P10 DIP'],1,'Pas très fin pour une vision proche, COB robuste, plusieurs sources affichées.']
  ];
  S.forEach(function(s, i){
    var d = el('div', {'class':'q'});
    var p = el('p'); p.appendChild(el('span', {'class':'qn', text:'Cas ' + (i+1) + ' · '})); p.appendChild(document.createTextNode(s[0])); d.appendChild(p);
    var o = el('div', {'class':'opts'});
    s[1].forEach(function(a, ai){
      o.appendChild(el('button', {'class':'opt', type:'button', text:a, onclick:function(ev){
        $$('button', o).forEach(function(x){ x.disabled = true; });
        o.children[s[2]].classList.add('right'); if (ai !== s[2]) ev.currentTarget.classList.add('wrong');
        d.appendChild(el('p', {'class':'expl', text:s[3]}));
      }}));
    });
    d.appendChild(o); box.appendChild(d);
  });
})();

/* ================= Écran courbe ================= */
(function(){
  if (!$('aR')) return;
  function f(){
    var R = parseFloat($('aR').value), w = parseFloat($('aW').value), A = parseFloat($('aA').value);
    if (!(R > 0 && w > 0 && A > 0)) return;
    var ang = 360 * (w/1000) / (2 * Math.PI * R), L = A * Math.PI * R / 180, n = L / (w/1000);
    $('aoAng').textContent = fmt(ang,1) + '°'; $('aoN').textContent = fmt(Math.round(n)); $('aoL').textContent = fmt(L,2) + ' m';
    var m = $('aoMsg');
    if (ang > 10){ m.className = 'msg bad'; m.textContent = 'Plus de 10° par joint : au-delà des verrous d’angle courants. Augmentez le rayon, prenez des cabinets plus étroits ou des modules flexibles.'; }
    else { m.className = 'msg ok'; m.textContent = 'Réglez chaque verrou à ' + fmt(ang,1) + '° (ou au cran le plus proche : 2,5°, 5°, 7,5°, 10°). Vérifiez le rayon réel au laser.'; }
  }
  ['aR','aW','aA'].forEach(function(id){ $(id).addEventListener('input', f); }); f();
})();

/* ================= Lignes électriques ================= */
(function(){
  if (!$('lN')) return;
  function f(){
    var N = +$('lN').value, P = +$('lP').value, I = +$('lI').value, F = +$('lF').value, A = +$('lA').value;
    if (!(N > 0 && P > 0 && I > 0)) return;
    var cpl = Math.max(1, Math.floor(230 * I * .8 / P)), lines = Math.ceil(N / cpl), leak = N * A * F, rcd = Math.max(1, Math.ceil(leak / 9));
    $('loC').textContent = cpl; $('loL').textContent = lines; $('loD').textContent = rcd;
    $('loP').textContent = fmt(N*P/1000,1) + ' kW'; $('loPh').textContent = fmt(N*P/3/1000,1) + ' kW'; $('loF').textContent = fmt(leak,1) + ' mA';
    var m = $('loMsg'); m.className = 'msg';
    m.textContent = lines + ' départs de ' + I + ' A à répartir sur les 3 phases (≈ ' + Math.ceil(lines/3) + ' par phase), protégés par au moins ' + rcd + ' différentiels 30 mA. Vérifiez aussi la limite du connecteur de chaînage indiquée par le fabricant.';
  }
  ['lN','lP','lI','lF','lA'].forEach(function(id){ $(id).addEventListener('input', f); }); f();
})();

/* ================= Remise en ordre ================= */
(function(){
  var list = $('orderList'); if (!list) return;
  var R = ['Réception et contrôle','Test au sol','Implantation au laser','Structure','Première rangée','Assemblage','Câblage électrique','Câblage données','Mise sous tension','Configuration','Tests et réglages','Finitions et documentation'];
  var cur = [];
  function draw(){
    list.innerHTML = '';
    cur.forEach(function(k, i){
      list.appendChild(el('li', null, [el('span', {'class':'i', text: String(i+1).padStart(2,'0')}), el('span', {text:R[k]}),
        el('span', {'class':'mv'}, [
          el('button', {type:'button', 'aria-label':'Monter', text:'↑', onclick:function(){ mv(i, -1); }}),
          el('button', {type:'button', 'aria-label':'Descendre', text:'↓', onclick:function(){ mv(i, 1); }})])]));
    });
  }
  function mv(i, d){ var j = i + d; if (j < 0 || j >= cur.length) return; var t = cur[i]; cur[i] = cur[j]; cur[j] = t; draw(); $('orderMsg').hidden = true; }
  function mix(){ cur = shuffle(R.map(function(_, i){ return i; })); draw(); $('orderMsg').hidden = true; }
  $('orderShuffle').addEventListener('click', mix);
  $('orderCheck').addEventListener('click', function(){
    var ok = 0;
    $$('li', list).forEach(function(li, i){ var g = cur[i] === i; if (g) ok++; li.classList.toggle('good', g); li.classList.toggle('badpos', !g); });
    var m = $('orderMsg'); m.hidden = false;
    m.className = 'msg ' + (ok === R.length ? 'ok' : 'bad');
    m.textContent = ok === R.length ? 'Parfait : les 12 étapes sont dans le bon ordre.' : ok + ' / 12 étapes bien placées. Corrigez les lignes en rouge et vérifiez à nouveau.';
  });
  mix();
})();

/* ================= Jeu de câblage ================= */
(function(){
  var svg = $('wireSvg'); if (!svg) return;
  var NS = 'http://www.w3.org/2000/svg', C = 6, Rw = 3, MAX = 17;
  var colors = {A:'var(--accent)', B:'var(--r)', C:'var(--g)'};
  var chains = {A:[], B:[], C:[]}, port = 'A', owner = {};
  var pw = $('wirePorts');
  ['A','B','C'].forEach(function(p){
    pw.appendChild(el('button', {'class':'chip', type:'button', 'aria-pressed': p === 'A' ? 'true' : 'false', text:'Port ' + p, onclick:function(ev){
      port = p; $$('button', pw).forEach(function(b){ b.setAttribute('aria-pressed', b === ev.currentTarget ? 'true' : 'false'); });
      msg('Port ' + p + ' sélectionné. ' + (chains[p].length ? 'Continuez la chaîne.' : 'Cliquez son premier cabinet.'), '');
    }}));
  });
  function msg(t, k){ var m = $('wireMsg'); m.className = 'msg' + (k ? ' ' + k : ''); m.textContent = t; }
  function cx(i){ return 10 + (i % C) * 100 + 50; } function cy(i){ return 10 + Math.floor(i / C) * 100 + 50; }
  function adj(a, b){ var ax = a % C, ay = Math.floor(a / C), bx = b % C, by = Math.floor(b / C); return Math.abs(ax-bx) + Math.abs(ay-by) === 1; }
  function draw(){
    svg.innerHTML = '';
    for (var i = 0; i < C*Rw; i++){
      (function(i){
        var r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', 10 + (i % C)*100 + 3); r.setAttribute('y', 10 + Math.floor(i / C)*100 + 3); r.setAttribute('width', 94); r.setAttribute('height', 94); r.setAttribute('rx', 4);
        r.setAttribute('class', 'cell'); if (owner[i]) r.style.stroke = colors[owner[i]];
        r.addEventListener('click', function(){ clickCell(i); }); svg.appendChild(r);
      })(i);
    }
    ['A','B','C'].forEach(function(p){
      var ch = chains[p]; if (!ch.length) return;
      var pl = document.createElementNS(NS, 'polyline');
      pl.setAttribute('points', ch.map(function(i){ return cx(i) + ',' + cy(i); }).join(' '));
      pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', colors[p]); pl.setAttribute('stroke-width', '4'); pl.setAttribute('stroke-linecap', 'round'); pl.setAttribute('stroke-linejoin', 'round'); pl.style.pointerEvents = 'none';
      svg.appendChild(pl);
      ch.forEach(function(i, k){
        var c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', cx(i)); c.setAttribute('cy', cy(i)); c.setAttribute('r', 17); c.setAttribute('fill', colors[p]); c.style.pointerEvents = 'none'; svg.appendChild(c);
        var t = document.createElementNS(NS, 'text'); t.setAttribute('x', cx(i)); t.setAttribute('y', cy(i) + 5); t.setAttribute('text-anchor', 'middle'); t.setAttribute('class', 'cl'); t.style.fill = '#fff'; t.textContent = p + (k+1); svg.appendChild(t);
      });
    });
  }
  function clickCell(i){
    if (owner[i]) return msg('Ce cabinet est déjà câblé sur le port ' + owner[i] + '.', 'bad');
    var ch = chains[port];
    if (ch.length && !adj(ch[ch.length-1], i)) return msg('Le cabinet suivant doit toucher le précédent (pas de diagonale, pas de saut).', 'bad');
    if (ch.length >= MAX) return msg('Port ' + port + ' plein : 17 cabinets × 36 864 px = 626 688 px. Un de plus dépasserait 650 000 px.', 'bad');
    ch.push(i); owner[i] = port; draw();
    msg('Port ' + port + ' : ' + ch.length + ' cabinet' + (ch.length > 1 ? 's' : '') + ' · ' + fmt(ch.length * 36864) + ' px.', '');
  }
  $('wireUndo').addEventListener('click', function(){ var ch = chains[port]; if (!ch.length) return; delete owner[ch.pop()]; draw(); msg('Dernier cabinet du port ' + port + ' retiré.', ''); });
  $('wireClear').addEventListener('click', function(){ chains = {A:[], B:[], C:[]}; owner = {}; draw(); msg('Mur effacé. Port ' + port + ' sélectionné.', ''); });
  $('wireCheck').addEventListener('click', function(){
    var n = Object.keys(owner).length, used = ['A','B','C'].filter(function(p){ return chains[p].length; }).length;
    if (n < C*Rw) return msg((C*Rw - n) + ' cabinet(s) ne sont reliés à aucun port.', 'bad');
    var t = 'Câblage valide : 18 cabinets sur ' + used + ' ports.';
    if (used === 2) t += ' C’est l’optimum : 663 552 px ne tiennent pas sur un seul port.';
    else t += ' Ça marche, mais 2 ports suffisent : gardez le 3e pour une boucle de secours.';
    msg(t, 'ok');
  });
  draw();
})();

/* ================= Simulateurs de configuration (NovaLCT, LEDVISION) ================= */
var SIMS = {
  nova: {app:'NovaLCT · Screen Configuration', tabs:['Connexion','Carte émettrice','Carte réceptrice','Connexion écran'],
    login:'Menu <kbd>User</kbd> → <kbd>Advanced Synchronous System User Login</kbd>', pwds:['admin'], hint:'Indice : le mot de passe d’usine de NovaLCT figure dans le module (5 lettres).',
    sender:'<p><b>Carte émettrice détectée :</b> MCTRL300 · COM3</p><p>Entrée HDMI · 1920 × 1080 à 60 Hz · 2 ports de sortie. Rien à changer ici pour cette mission.</p>',
    label:'P2.6 · driver ICN2153 · scan 1/32 · cabinet 192×192',
    files:[['P2.6_ICN2153_32S_192x192.rcfgx',true],['P2.6_MBI5153_16S_192x192.rcfgx',false],['P3.91_ICN2153_16S_128x128.rcfgx',false]],
    cols:2, rows:2, real:[0,1,3,2], send:'Send to HW', save:'Save',
    mission:'Configurer un mur de 2 × 2 cabinets de zéro. Le câblage réel part du coin haut gauche vu de face, va à droite, descend, puis revient à gauche (serpentin).'},
  ledvision: {app:'LEDVISION · Display Setting', tabs:['Mot de passe','Sender','Receiver','Connection'],
    login:'Menu <kbd>Settings</kbd> → <kbd>Display Setting</kbd>', pwds:['168','666'], hint:'Indice : 3 chiffres. Les valeurs d’usine les plus courantes sont 168 ou 666 selon la version.',
    sender:'<p><b>Carte émettrice :</b> Colorlight S2 · USB</p><p>Sortie PC 1920 × 1080. Rien à changer ici pour cette mission.</p>',
    label:'P3.91 · driver FM6363 · scan 1/16 · cabinet 128×128',
    files:[['P3.91_FM6363_16S_128x128.rcvbp',true],['P3.91_FM6363_8S_128x128.rcvbp',false],['P2.6_ICN2153_32S_192x192.rcvbp',false]],
    cols:3, rows:2, real:[3,0,1,4,5,2], send:'Send', save:'Save',
    mission:'Configurer un mur de 3 × 2 cabinets. Attention, ici le câblage est vertical : il part du coin bas gauche vu de face, monte, passe à droite, redescend, passe à droite et remonte.'}
};
var PAL = ['#1d4ed8','#15803d','#b45309','#be123c','#7c3aed','#0e7490'];
$$('[data-sim="nova"],[data-sim="ledvision"]').forEach(function(root){
  var cfg = SIMS[root.dataset.sim], N = cfg.cols * cfg.rows;
  root.innerHTML =
    '<p class="intro"></p>' +
    '<div class="nova"><div class="win"><div class="tb"><span></span><span class="who">Utilisateur : invité</span></div>' +
    '<div class="tabs" role="tablist"></div>' +
    '<div class="pane"><p>' + cfg.login + '</p><label class="f">Mot de passe<input type="password" autocomplete="off" class="pwd"></label><button class="btn primary login" type="button" style="width:max-content">Se connecter</button><p class="msg lmsg" hidden></p></div>' +
    '<div class="pane" hidden>' + cfg.sender + '</div>' +
    '<div class="pane" hidden><p><b>Étiquette au dos d’un module :</b> <code>' + cfg.label + '</code></p><p>Choisissez le fichier fourni par le fabricant :</p><div class="files"></div></div>' +
    '<div class="pane" hidden><p>Cliquez les cabinets dans l’ordre du câblage réel (vue de face).</p><div class="mapgrid"></div><button class="btn mclear" type="button" style="width:max-content">Effacer le tracé</button></div>' +
    '<div class="act"><button class="btn send" type="button" disabled></button><button class="btn save" type="button" disabled></button><button class="btn power" type="button">Couper / rallumer l’écran</button></div></div>' +
    '<div class="screen"><span class="label">Mur LED (vue de face)</span><div class="ledwall"></div><p class="msg smsg">Écran allumé, cartes non configurées.</p><span class="label">Objectifs</span><ul class="goals"></ul></div></div>';
  var q = function(s){ return root.querySelector(s); }, qa = function(s){ return [].slice.call(root.querySelectorAll(s)); };
  q('.intro').textContent = 'Mission : ' + cfg.mission + ' Suivez les objectifs.';
  q('.tb span').textContent = cfg.app;
  q('.send').textContent = cfg.send; q('.save').textContent = cfg.save;
  var tabs = cfg.tabs.map(function(t, i){ var b = el('button', {role:'tab', type:'button', 'aria-selected': i ? 'false' : 'true', text:t}); if (i) b.disabled = true; b.addEventListener('click', function(){ tab(i); }); q('.tabs').appendChild(b); return b; });
  var panes = qa('.pane');
  function tab(i){ tabs.forEach(function(t, j){ t.setAttribute('aria-selected', j === i ? 'true' : 'false'); }); panes.forEach(function(p, j){ p.hidden = j !== i; }); }
  ['Se connecter en mode avancé','Choisir le bon fichier de carte réceptrice','Tracer la connexion comme le câblage réel','Envoyer : les cabinets affichent 1 à ' + N + ' dans l’ordre de lecture','Sauvegarder dans les cartes','Couper et rallumer : l’image revient correcte'].forEach(function(g){ q('.goals').appendChild(el('li', {text:g})); });
  var goals = [], sw = {file:null, map:[]}, hw = {file:null, map:null}, flash = {file:null, map:null}, power = true, sent = false;
  function msg(t, k){ var m = q('.smsg'); m.className = 'msg smsg' + (k ? ' ' + k : ''); m.textContent = t; }
  function goal(i){ goals[i] = true; qa('.goals li')[i].classList.add('on'); if ([0,1,2,3,4,5].every(function(k){ return goals[k]; })) msg('Mission accomplie : écran configuré, sauvegardé et résistant à une coupure.', 'ok'); }
  q('.login').addEventListener('click', function(){
    var m = q('.lmsg'); m.hidden = false;
    if (cfg.pwds.indexOf(q('.pwd').value.trim().toLowerCase()) >= 0){
      m.className = 'msg lmsg ok'; m.textContent = 'Connecté. Pensez à changer ce mot de passe en production.';
      q('.who').textContent = 'Utilisateur : avancé'; tabs.forEach(function(t){ t.disabled = false; });
      q('.send').disabled = false; q('.save').disabled = false; goal(0); tab(2);
    } else { m.className = 'msg lmsg bad'; m.textContent = 'Mot de passe refusé. ' + cfg.hint; }
  });
  var nm = 'f' + Math.random().toString(36).slice(2);
  cfg.files.forEach(function(f, i){
    var inp = el('input', {type:'radio', name:nm});
    inp.addEventListener('change', function(){ sw.file = i; if (f[1]) goal(1); });
    q('.files').appendChild(el('label', null, [inp, f[0]]));
  });
  var mg = q('.mapgrid'), wall = q('.ledwall');
  mg.style.gridTemplateColumns = 'repeat(' + cfg.cols + ',64px)';
  wall.style.gridTemplateColumns = 'repeat(' + cfg.cols + ',1fr)';
  wall.style.aspectRatio = (cfg.cols * 1.25) + '/' + (cfg.rows);
  for (var i = 0; i < N; i++){ (function(i){ mg.appendChild(el('button', {type:'button', onclick:function(){ if (sw.map.indexOf(i) >= 0 || sw.map.length >= N) return; sw.map.push(i); drawMap(); if (sw.map.length === N) goal(2); }})); wall.appendChild(el('div')); })(i); }
  function drawMap(){ qa('.mapgrid button').forEach(function(b, i){ var k = sw.map.indexOf(i); b.textContent = k >= 0 ? '#' + (k+1) : ''; b.classList.toggle('set', k >= 0); }); }
  q('.mclear').addEventListener('click', function(){ sw.map = []; drawMap(); });
  function ok(){ return hw.file !== null && cfg.files[hw.file][1] && hw.map && hw.map.length === N && cfg.real.every(function(p, k){ return hw.map[k] === p; }); }
  function render(){
    var cells = qa('.ledwall > div');
    cells.forEach(function(c){ c.className = ''; c.textContent = ''; c.style.background = ''; });
    if (!power) return;
    cfg.real.forEach(function(phys, k){
      var c = cells[phys];
      if (hw.file === null || !cfg.files[hw.file][1]){ c.className = 'noise'; return; }
      if (!hw.map || hw.map.length < N) return;
      var pos = hw.map[k]; c.textContent = String(pos + 1); c.style.background = PAL[pos % PAL.length];
    });
  }
  q('.send').addEventListener('click', function(){
    if (sw.file === null) return msg('Choisissez d’abord un fichier de carte réceptrice.', 'bad');
    hw = {file: sw.file, map: sw.map.slice()}; sent = true; render();
    if (!cfg.files[hw.file][1]) return msg('Image brouillée : le fichier ne correspond pas au module (driver ou scan différent). Relisez l’étiquette.', 'bad');
    if (hw.map.length < N) return msg('Fichier correct, mais la connexion n’est pas tracée pour tous les cabinets.', 'bad');
    if (!ok()) return msg('Les numéros sont dans le désordre : le tracé ne suit pas le câblage réel. Relisez la mission, corrigez et renvoyez.', 'bad');
    goal(3); msg('Chaque cabinet affiche la bonne partie de l’image. Rien n’est encore enregistré dans les cartes.', 'ok');
  });
  q('.save').addEventListener('click', function(){
    if (!sent) return msg('Rien à enregistrer : envoyez d’abord.', 'bad');
    flash = {file: hw.file, map: hw.map ? hw.map.slice() : null};
    if (ok()){ goal(4); msg('Configuration enregistrée dans les cartes. Testez une coupure de courant.', 'ok'); } else msg('Enregistré, mais la configuration actuelle n’est pas correcte.', 'bad');
  });
  q('.power').addEventListener('click', function(){
    power = false; render(); msg('Écran coupé…', '');
    setTimeout(function(){
      power = true; hw = {file: flash.file, map: flash.map ? flash.map.slice() : null}; render();
      if (ok()){ goal(5); if (!goals[4]) msg('Rallumé : image correcte.', 'ok'); else if (![0,1,2,3,4,5].every(function(k){ return goals[k]; })) msg('Rallumé : l’image revient grâce à la sauvegarde.', 'ok'); }
      else if (flash.file === null) msg('Rallumé : tout est perdu ! Sans « ' + cfg.save + ' », les cartes reprennent leur ancienne configuration.', 'bad');
      else msg('Rallumé avec la configuration sauvegardée, qui n’est pas correcte.', 'bad');
    }, 900);
  });
  render();
});

/* ================= Simulateur HDPlayer (Huidu) ================= */
$$('[data-sim="hdplayer"]').forEach(function(root){
  root.innerHTML =
    '<p class="intro">Mission : programmer l’écran d’une pharmacie piloté par un lecteur Huidu. Sur place, vous relevez : contrôleur <code>HD-A3</code>, écran de 6 × 6 modules P5, chaque module fait 64 × 32 pixels. Le client veut une vidéo avec un bandeau de texte défilant en bas.</p>' +
    '<div class="nova"><div class="win"><div class="tb"><span>HDPlayer</span><span class="wst">Wi-Fi : non connecté</span></div><div class="tabs" role="tablist"></div>' +
    '<div class="pane"><p>Réseaux Wi-Fi disponibles :</p><div class="files wifi"></div><label class="f">Mot de passe<input type="password" class="wpwd" autocomplete="off"></label><button class="btn primary wgo" type="button" style="width:max-content">Se connecter</button><p class="msg wmsg" hidden></p></div>' +
    '<div class="pane" hidden><p><kbd>Fichier</kbd> → <kbd>Nouvel écran</kbd></p><div class="row"><label class="f">Contrôleur<select class="ctl"><option>HD-C16</option><option>HD-A3</option><option>HD-A6</option></select></label><label class="f">Largeur (px)<input type="number" class="sw" value="320"></label><label class="f">Hauteur (px)<input type="number" class="sh" value="160"></label></div><button class="btn primary mk" type="button" style="width:max-content">Créer l’écran</button></div>' +
    '<div class="pane" hidden><p>Disposition du programme :</p><div class="files lay"></div><label class="f">Texte du bandeau<input type="text" class="txt" value="Promotion : -20 % sur les solaires cette semaine" style="width:100%"></label></div>' +
    '<div class="pane" hidden><p>Envoyer le programme au lecteur :</p><div class="row"><button class="btn primary sendw" type="button">Envoyer par Wi-Fi</button><button class="btn sendu" type="button">Exporter sur clé USB</button></div></div>' +
    '</div><div class="screen"><span class="label">Écran de la pharmacie</span><div class="hdscreen"><div class="hdvid">VIDÉO</div><div class="hdbar"><span></span></div><div class="hdclock">14:32</div></div><p class="msg smsg">Écran allumé : ancien programme en cours.</p><span class="label">Objectifs</span><ul class="goals"></ul></div></div>';
  var q = function(s){ return root.querySelector(s); }, qa = function(s){ return [].slice.call(root.querySelectorAll(s)); };
  var T = ['Wi-Fi','Écran','Programme','Envoi'];
  var tabs = T.map(function(t, i){ var b = el('button', {role:'tab', type:'button', 'aria-selected': i ? 'false' : 'true', text:t}); b.addEventListener('click', function(){ tab(i); }); q('.tabs').appendChild(b); return b; });
  var panes = qa('.pane');
  function tab(i){ tabs.forEach(function(t, j){ t.setAttribute('aria-selected', j === i ? 'true' : 'false'); }); panes.forEach(function(p, j){ p.hidden = j !== i; }); }
  ['Se connecter au Wi-Fi du lecteur','Choisir le bon contrôleur','Saisir la bonne résolution','Programme vidéo + bandeau texte','Envoyer au lecteur'].forEach(function(g){ q('.goals').appendChild(el('li', {text:g})); });
  var S = {wifi:null, ok:false, screen:null, layout:null, sentOk:false}, goals = [];
  function goal(i){ if (goals[i]) return; goals[i] = true; qa('.goals li')[i].classList.add('on'); }
  function msg(t, k){ var m = q('.smsg'); m.className = 'msg smsg' + (k ? ' ' + k : ''); m.textContent = t; }
  var nm = 'w' + Math.random().toString(36).slice(2);
  ['Box-Pharmacie','HD-A3-4F21C8','Pharmacie-Invites'].forEach(function(s){ var i = el('input', {type:'radio', name:nm}); i.addEventListener('change', function(){ S.wifi = s; }); q('.wifi').appendChild(el('label', null, [i, s])); });
  q('.wgo').addEventListener('click', function(){
    var m = q('.wmsg'); m.hidden = false;
    if (S.wifi !== 'HD-A3-4F21C8'){ m.className = 'msg wmsg bad'; m.textContent = 'Ce réseau n’est pas celui du lecteur. Le point d’accès d’un lecteur Huidu commence par « HD- ».'; return; }
    if (q('.wpwd').value.trim() !== '88888888'){ m.className = 'msg wmsg bad'; m.textContent = 'Mot de passe refusé. Indice : valeur d’usine fréquente, huit fois le même chiffre.'; return; }
    S.ok = true; m.className = 'msg wmsg ok'; m.textContent = 'Connecté au lecteur. Changez ce mot de passe après la mise en service.';
    q('.wst').textContent = 'Wi-Fi : HD-A3-4F21C8'; goal(0); tab(1);
  });
  q('.mk').addEventListener('click', function(){
    S.screen = {ctl: q('.ctl').value, w: +q('.sw').value, h: +q('.sh').value};
    if (S.screen.ctl === 'HD-A3') goal(1);
    if (S.screen.w === 384 && S.screen.h === 192) goal(2);
    msg('Écran créé : ' + S.screen.ctl + ', ' + S.screen.w + ' × ' + S.screen.h + ' px.', ''); tab(2);
  });
  var ln = 'l' + Math.random().toString(36).slice(2);
  [['full','Vidéo plein écran'],['bar','Vidéo + bandeau texte en bas'],['clock','Vidéo + horloge']].forEach(function(l){ var i = el('input', {type:'radio', name:ln}); i.addEventListener('change', function(){ S.layout = l[0]; if (l[0] === 'bar') goal(3); }); q('.lay').appendChild(el('label', null, [i, l[1]])); });
  function show(){
    var v = q('.hdvid'), b = q('.hdbar'), c = q('.hdclock'), scr = q('.hdscreen');
    b.firstChild.textContent = q('.txt').value;
    v.hidden = false; b.hidden = S.layout !== 'bar'; c.hidden = S.layout !== 'clock';
    var s = S.screen, sx = Math.min(1, s.w / 384), sy = Math.min(1, s.h / 192);
    scr.style.setProperty('--sx', sx); scr.style.setProperty('--sy', sy);
    scr.classList.toggle('err', !(s.w === 384 && s.h === 192)); scr.classList.toggle('withbar', S.layout === 'bar');
  }
  function send(how){
    if (!S.screen) return msg('Créez d’abord l’écran (onglet Écran).', 'bad');
    if (!S.layout) return msg('Choisissez une disposition de programme.', 'bad');
    if (how === 'wifi' && !S.ok) return msg('Envoi impossible : vous n’êtes pas connecté au Wi-Fi du lecteur.', 'bad');
    if (S.screen.ctl !== 'HD-A3') return msg('Le lecteur refuse le programme : il a été créé pour un ' + S.screen.ctl + ' alors que le contrôleur est un HD-A3.', 'bad');
    show();
    if (!(S.screen.w === 384 && S.screen.h === 192)) return msg('Programme lu, mais l’image n’occupe pas tout l’écran : ' + S.screen.w + ' × ' + S.screen.h + ' px au lieu de 6 × 64 = 384 par 6 × 32 = 192.', 'bad');
    goal(4);
    msg(how === 'usb' ? 'Programme exporté : branchez la clé sur le lecteur, il copie et lance le programme.' : 'Programme envoyé et lu correctement.', goals.every(Boolean) && goals.length === 5 ? 'ok' : '');
    if ([0,1,2,3,4].every(function(k){ return goals[k]; })) msg('Mission accomplie : le bon programme tourne en plein écran avec son bandeau.', 'ok');
    else if (how === 'usb') goal(0);
  }
  q('.sendw').addEventListener('click', function(){ send('wifi'); });
  q('.sendu').addEventListener('click', function(){ send('usb'); });
  q('.txt').addEventListener('input', function(){ q('.hdbar span').textContent = q('.txt').value; });
  q('.hdbar').hidden = true; q('.hdclock').hidden = true;
});

/* ================= Atelier de chiffrage ================= */
$$('[data-sim="devis"]').forEach(function(root){
  var F = [['surf','Surface d’écran (m²)',21,0.5],['ecr','Écran (€ / m²)',2500,50],['str','Structure (€ / m²)',250,10],['ctl','Contrôle et processeur (€)',4500,100],['ele','Électricité et réseau (€)',2500,100],['jrs','Jours d’installation',4,1],['tec','Techniciens',3,1],['tj','Taux journalier (€ / technicien)',450,10],['trp','Transport et levage (€)',1200,50],['mes','Mise en service, calibration, formation (€)',1500,50],['mrg','Marge (%)',25,1]];
  root.innerHTML = '<p class="intro">Saisissez vos hypothèses : le devis se recalcule. Les valeurs de départ sont des exemples, remplacez-les par vos tarifs et ceux de vos fournisseurs.</p><div class="row fields"></div><div class="dv"></div><div class="out"><div><span>Total HT</span><b class="tht">–</b></div><div><span>TVA 20 %</span><b class="tva">–</b></div><div><span>Total TTC</span><b class="ttc">–</b></div><div><span>Prix de vente / m²</span><b class="pm2">–</b></div><div><span>Main-d’œuvre</span><b class="mo">–</b></div><div><span>Marge</span><b class="mg">–</b></div></div>';
  var box = root.querySelector('.fields'), val = {};
  F.forEach(function(f){ var i = el('input', {type:'number', min:'0', step:String(f[3]), value:String(f[2])}); i.addEventListener('input', calc); val[f[0]] = i; box.appendChild(el('label', {'class':'f'}, [f[1], i])); });
  var eur = function(n){ return fmt(Math.round(n)) + ' €'; };
  function calc(){
    var v = {}; Object.keys(val).forEach(function(k){ v[k] = parseFloat(val[k].value) || 0; });
    var lines = [['Écran', v.surf*v.ecr], ['Structure', v.surf*v.str], ['Contrôle', v.ctl], ['Électricité et réseau', v.ele], ['Main-d’œuvre', v.jrs*v.tec*v.tj], ['Transport et levage', v.trp], ['Mise en service', v.mes]];
    var cost = lines.reduce(function(a, l){ return a + l[1]; }, 0), ht = cost * (1 + v.mrg/100), max = Math.max.apply(null, lines.map(function(l){ return l[1]; })) || 1;
    var dv = root.querySelector('.dv'); dv.innerHTML = '';
    lines.forEach(function(l){
      var r = el('div', {'class':'dvrow'}, [el('span', {text:l[0]}), el('span', {'class':'dvbar'}, [el('i', {style:'width:' + (l[1]/max*100) + '%'})]), el('b', {text:eur(l[1])}), el('span', {'class':'dvp', text: cost ? fmt(l[1]/cost*100) + ' %' : '–'})]);
      dv.appendChild(r);
    });
    root.querySelector('.tht').textContent = eur(ht); root.querySelector('.tva').textContent = eur(ht*.2); root.querySelector('.ttc').textContent = eur(ht*1.2);
    root.querySelector('.pm2').textContent = v.surf ? eur(ht / v.surf) : '–'; root.querySelector('.mo').textContent = eur(v.jrs*v.tec*v.tj); root.querySelector('.mg').textContent = eur(ht - cost);
  }
  calc();
});

/* ================= Totem asynchrone ================= */
(function(){
  var list = $('plList'); if (!list) return;
  var TYPES = ['Vidéo','Image','Image + texte défilant','Horloge et météo','Page web','Flux en direct'];
  var items = [['Vidéo',15],['Image + texte défilant',10],['Horloge et météo',8]];
  for (var h = 0; h < 24; h++){ var lab = String(h).padStart(2,'0') + ' h'; $('plFrom').appendChild(el('option', {value:h, text:lab})); $('plTo').appendChild(el('option', {value:h, text:lab})); }
  $('plFrom').value = 8; $('plTo').value = 21;
  function draw(){
    list.innerHTML = '';
    items.forEach(function(it, i){
      var s = el('select', {'aria-label':'Type de page ' + (i+1)}); TYPES.forEach(function(t){ s.appendChild(el('option', {text:t})); }); s.value = it[0];
      s.addEventListener('change', function(){ it[0] = s.value; stats(); });
      var d = el('input', {type:'number', min:'1', value:String(it[1]), 'aria-label':'Durée en secondes'});
      d.addEventListener('input', function(){ it[1] = Math.max(1, +d.value || 1); stats(); });
      list.appendChild(el('li', null, [s, d, el('button', {type:'button', 'aria-label':'Supprimer', text:'×', onclick:function(){ if (items.length > 1){ items.splice(i, 1); draw(); } }})]));
    });
    stats();
  }
  function stats(){
    var loop = items.reduce(function(a, b){ return a + b[1]; }, 0), f = +$('plFrom').value, t = +$('plTo').value;
    var hours = t > f ? t - f : 24 - f + t;
    $('plLoop').textContent = loop + ' s'; $('plPerH').textContent = fmt(Math.floor(3600 / loop));
    $('plPerD').textContent = fmt(Math.floor(3600 / loop) * hours) + ' (' + hours + ' h)';
    var m = $('plMsg'), warn = [];
    if (t <= 6 && t !== 0 || f < 6 || t === 0 || t > 1 && t < f) warn.push('La plage déborde entre 1 h et 6 h : vérifiez l’extinction nocturne imposée à la publicité lumineuse.');
    if (loop > 120) warn.push('Boucle de plus de 2 minutes : un passant verra rarement tout le programme.');
    m.hidden = !warn.length; m.className = 'msg bad'; m.textContent = warn.join(' ');
  }
  $('plFrom').addEventListener('change', stats); $('plTo').addEventListener('change', stats);
  $('plAdd').addEventListener('click', function(){ items.push(['Image', 8]); draw(); });
  var timer = null;
  $('plPlay').addEventListener('click', function(){
    if (timer){ clearInterval(timer); timer = null; $('plPlay').textContent = 'Aperçu'; $('plNow').textContent = 'Prêt'; $('plBar').style.width = '0'; return; }
    $('plPlay').textContent = 'Arrêter';
    var i = 0, t0 = Date.now();
    timer = setInterval(function(){
      var it = items[i], el2 = (Date.now() - t0) / 100;
      $('plNow').textContent = it[0] + ' · ' + it[1] + ' s';
      $('plBar').style.width = Math.min(100, el2 / it[1] * 100) + '%';
      if (el2 >= it[1]){ i = (i + 1) % items.length; t0 = Date.now(); }
    }, 50);
  });
  draw();
})();

/* ================= Pixel pour pixel ================= */
(function(){
  var svg = $('rSvg'); if (!svg) return;
  var NS = 'http://www.w3.org/2000/svg', mode = 'crop';
  $$('#rMode button').forEach(function(b){ b.addEventListener('click', function(){ mode = b.dataset.m; $$('#rMode button').forEach(function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); f(); }); });
  ['rW','rH','rSrc'].forEach(function(id){ $(id).addEventListener('input', f); });
  function rect(x, y, w, h, fill, stroke, dash){ var r = document.createElementNS(NS, 'rect'); r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', Math.max(0, w)); r.setAttribute('height', Math.max(0, h)); r.setAttribute('fill', fill); r.setAttribute('stroke', stroke); r.setAttribute('stroke-width', 2); if (dash) r.setAttribute('stroke-dasharray', '6 4'); svg.appendChild(r); }
  function text(x, y, t, c){ var e = document.createElementNS(NS, 'text'); e.setAttribute('x', x); e.setAttribute('y', y); e.setAttribute('class', 'ts'); if (c) e.style.fill = c; e.textContent = t; svg.appendChild(e); }
  function f(){
    var W = +$('rW').value, H = +$('rH').value; if (!(W > 0 && H > 0)) return;
    var s = $('rSrc').value, SW, SH;
    if (s === 'led'){ SW = W; SH = H; } else { var p = s.split('x'); SW = +p[0]; SH = +p[1]; }
    svg.innerHTML = '';
    var m = $('rMsg');
    if (mode === 'crop'){
      var k = Math.min(560 / Math.max(SW, W), 300 / Math.max(SH, H)), ox = 30, oy = 34;
      rect(ox, oy, SW*k, SH*k, 'var(--accent-soft)', 'var(--accent)');
      text(ox, oy - 8, 'Sortie PC ' + SW + ' × ' + SH, 'var(--accent)');
      rect(ox, oy, W*k, H*k, 'none', 'var(--ink)', true);
      text(ox + 6, oy + H*k - 8, 'Écran LED ' + W + ' × ' + H);
      if (W > SW || H > SH){
        rect(ox + Math.min(W,SW)*k, oy, Math.max(0, W-SW)*k, H*k, 'var(--bad-soft)', 'none');
        rect(ox, oy + Math.min(H,SH)*k, W*k, Math.max(0, H-SH)*k, 'var(--bad-soft)', 'none');
        m.className = 'msg bad'; m.textContent = 'L’écran est plus grand que la sortie : les zones rouges ne reçoivent aucune image. Passez en sortie 4K, en résolution personnalisée ou en mise à l’échelle.';
      } else if (W === SW && H === SH){ m.className = 'msg ok'; m.textContent = 'Parfait : la sortie correspond exactement à l’écran. Pixel pour pixel, aucune perte.'; }
      else { m.className = 'msg ok'; m.textContent = 'L’écran prend une zone de ' + W + ' × ' + H + ' en haut à gauche de la sortie. Produisez le contenu à cette taille et placez-le à cette position.'; }
    } else {
      var k2 = Math.min(250 / SW, 250 / SH), k3 = Math.min(250 / W, 250 / H);
      rect(20, 50, SW*k2, SH*k2, 'var(--accent-soft)', 'var(--accent)'); text(20, 40, 'Entrée ' + SW + ' × ' + SH, 'var(--accent)');
      rect(340, 50, W*k3, H*k3, 'var(--surface)', 'var(--ink)'); text(340, 40, 'Écran ' + W + ' × ' + H);
      var a = document.createElementNS(NS, 'path'); a.setAttribute('d', 'M' + (30 + SW*k2) + ' 150 L330 150'); a.setAttribute('stroke', 'var(--muted)'); a.setAttribute('stroke-width', 2); a.setAttribute('fill', 'none'); svg.appendChild(a);
      var fx = W / SW, fy = H / SH;
      text(30 + SW*k2 + 8, 140, '× ' + fmt(fx,2) + ' / × ' + fmt(fy,2));
      if (Math.abs(fx - fy) > .02){ m.className = 'msg bad'; m.textContent = 'Rapports d’aspect différents (' + fmt(SW/SH,2) + ' contre ' + fmt(W/H,2) + ') : l’image sera déformée, ou il faudra des bandes noires.'; }
      else if (Math.abs(fx - 1) < .01){ m.className = 'msg ok'; m.textContent = 'Facteur 1 : aucune mise à l’échelle, image parfaite.'; }
      else { m.className = 'msg'; m.textContent = 'Mise à l’échelle × ' + fmt(fx,2) + ' : parfait pour la vidéo, le texte fin sera moins net qu’en pixel pour pixel.'; }
    }
  }
  f();
})();

/* ================= Mur de défauts ================= */
(function(){
  var wall = $('defWall'); if (!wall) return;
  var P = [['rouge','Rouge'],['vert','Vert'],['bleu','Bleu'],['blanc','Blanc 100 %'],['gris','Blanc 10 %'],['noir','Noir'],['degrade','Dégradé'],['grille','Grille']];
  var D = {10:'bleu', 21:'module', 6:'teinte', 25:'pixel'};
  var HINT = {bleu:'Cabinet sans bleu : visible sur le bleu et le blanc (le blanc paraît jaune).', module:'Module noir : visible sur presque toutes les mires.', teinte:'Cabinet d’un autre lot : teinte rosée visible seulement à faible luminosité (blanc 10 %).', pixel:'Pixel bloqué allumé : visible seulement sur la mire noire.'};
  var pat = 'blanc', found = {}, cells = [];
  for (var i = 0; i < 32; i++){
    (function(i){
      var b = el('button', {type:'button', 'aria-label':'Cabinet ' + (i % 8 + 1) + ', rangée ' + (Math.floor(i / 8) + 1)}, [el('span', {'class':'mod'}), el('span', {'class':'px'})]);
      b.addEventListener('click', function(){
        if (D[i]){ if (!found[i]){ found[i] = true; b.classList.add('found'); } }
        else { b.classList.add('miss'); setTimeout(function(){ b.classList.remove('miss'); }, 700); }
        report(D[i] ? HINT[D[i]] : 'Ce cabinet est conforme.');
      });
      cells.push(b); wall.appendChild(b);
    })(i);
  }
  P.forEach(function(p){
    $('defPat').appendChild(el('button', {'class':'chip', type:'button', 'aria-pressed': p[0] === pat ? 'true' : 'false', text:p[1], onclick:function(ev){
      pat = p[0]; $$('#defPat button').forEach(function(x){ x.setAttribute('aria-pressed', x === ev.currentTarget ? 'true' : 'false'); }); paint();
    }}));
  });
  function report(t){
    var n = Object.keys(found).length, m = $('defMsg');
    m.className = 'msg' + (n === 4 ? ' ok' : '');
    m.textContent = 'Défauts trouvés : ' + n + ' / 4. ' + (n === 4 ? 'Bravo, la recette peut être signée après remplacement.' : (t || ''));
  }
  function paint(){
    cells.forEach(function(b, i){
      var d = D[i], x = i % 8, bg, mod = b.firstChild, px = b.lastChild;
      var base = {rouge:'#ff1a1a', vert:'#18e05a', bleu:'#1f4dff', blanc:'#ffffff', gris:'#1c1c1c', noir:'#000'}[pat];
      if (pat === 'degrade'){ b.style.background = d === 'bleu' ? 'linear-gradient(90deg,#000,#ffff00)' : 'linear-gradient(90deg,#000,#fff)'; b.style.backgroundSize = '800% 100%'; b.style.backgroundPosition = (x / 7 * 100) + '% 0'; }
      else if (pat === 'grille'){ b.style.background = '#000'; b.style.boxShadow = 'inset 0 0 0 1px ' + (d === 'bleu' ? '#ff0' : '#fff'); }
      else {
        bg = base;
        if (d === 'bleu'){ if (pat === 'bleu') bg = '#000'; if (pat === 'blanc') bg = '#ffff3a'; if (pat === 'gris') bg = '#1c1c00'; }
        if (d === 'teinte' && pat === 'gris') bg = '#2b1522';
        b.style.background = bg; b.style.backgroundSize = ''; b.style.backgroundPosition = '';
      }
      if (pat !== 'grille') b.style.boxShadow = '';
      mod.style.background = d === 'module' && pat !== 'noir' ? '#000' : 'transparent';
      px.style.display = d === 'pixel' && pat === 'noir' ? 'block' : 'none';
    });
  }
  paint(); report('Commencez par la mire blanche.');
})();

/* ================= Arbre de dépannage ================= */
(function(){
  var body = $('trBody'); if (!body) return;
  var T = {
    start:['Que voyez-vous ?',[['Tout l’écran est noir','black'],['Un groupe de cabinets est noir','chain'],['Un seul cabinet est anormal','cab'],['Un module ou une bande','mod'],['Des pixels isolés','px'],['Ça scintille à la caméra','L_cam']]],
    black:['Le processeur indique-t-il un signal d’entrée ?',[['Non','L_src'],['Oui','black2']]],
    black2:['Les voyants des cartes réceptrices clignotent-ils en vert ?',[['Non','L_net'],['Oui','L_bright']]],
    chain:['Les cabinets noirs sont-ils tous ceux qui suivent un même point de la chaîne de données ?',[['Oui','L_break'],['Non, ils forment une zone électrique','L_power']]],
    cab:['Comment est ce cabinet ?',[['Noir','L_cabpow'],['Brouillé ou mauvaises couleurs','L_rcfg'],['Il affiche l’image d’un autre','L_map']]],
    mod:['Si vous permutez ce module avec un voisin, le défaut suit-il le module ?',[['Oui','L_modbad'],['Non','mod2']]],
    mod2:['Le remplacement de la nappe corrige-t-il le défaut ?',[['Oui','L_ribbon'],['Non','L_hub']]],
    px:['S’agit-il d’une traînée de pixels faiblement allumés ?',[['Oui','L_cat'],['Non, des points isolés','L_dead']]]
  };
  var L = {
    L_cam:['Rafraîchissement trop bas ou obturateur mal réglé','Passez le fichier de carte à 3 840 Hz, réglez l’obturateur sur 1/50 (ou 1/100), jouez sur l’angle et la mise au point contre le moiré.'],
    L_src:['Problème de source','Vérifiez le PC (sortie active, mode étendu, résolution), le câble HDMI/SDI et l’entrée choisie sur le processeur.'],
    L_net:['Pas de données vers l’écran','Contrôlez le câble du port de sortie, le mode « blackout » ou « freeze » du processeur et la configuration des ports.'],
    L_bright:['Luminosité à zéro ou écran en noir forcé','Vérifiez la luminosité dans le processeur ou NovaLCT, la planification horaire et le capteur de luminosité.'],
    L_break:['Chaîne de données coupée','Remplacez le câble entre le dernier cabinet correct et le premier noir, puis permutez la carte réceptrice du premier cabinet noir. Une boucle de secours aurait évité la panne.'],
    L_power:['Ligne électrique coupée','Contrôlez le disjoncteur et le différentiel de ce départ, puis le connecteur de chaînage secteur.'],
    L_cabpow:['Alimentation ou carte réceptrice du cabinet','Mesurez le 5 V en sortie d’alimentation. Si la tension est bonne, permutez la carte réceptrice.'],
    L_rcfg:['Mauvais fichier de carte réceptrice','Renvoyez et sauvegardez le fichier .rcfgx / .rcvbp sur ce cabinet (fréquent après remplacement d’une carte).'],
    L_map:['Mapping ou câbles inversés','Affichez la mire numérotée et corrigez la connexion d’écran dans le logiciel, ou remettez les câbles dans l’ordre du plan.'],
    L_modbad:['Module défectueux','Remplacez le module (même référence, même sens), puis chargez ses coefficients de calibration.'],
    L_ribbon:['Nappe défectueuse','Gardez la nouvelle nappe et vérifiez les broches du connecteur.'],
    L_hub:['Carte HUB ou sortie de la carte réceptrice','Permutez la carte HUB, puis la carte réceptrice du cabinet.'],
    L_cat:['Humidité : effet « chenille »','Faites un préchauffage progressif à faible luminosité pendant plusieurs heures. Si la traînée persiste, remplacez la LED ou le module.'],
    L_dead:['Pixels morts','Remplacement de la LED en atelier (station à air chaud) ou du module si les pixels sont nombreux.']
  };
  var path = [];
  function go(k, label){
    if (label) path.push(label);
    body.innerHTML = ''; $('trCrumbs').textContent = path.join(' → ');
    if (L[k]){
      body.appendChild(el('div', {'class':'leaf'}, [el('span', {'class':'label', text:'Diagnostic'}), el('h4', {text:L[k][0]}), el('p', {text:L[k][1]})]));
      return;
    }
    var n = T[k];
    body.appendChild(el('p', {'class':'qtext', text:n[0]}));
    var a = el('div', {'class':'answers'});
    n[1].forEach(function(o){ a.appendChild(el('button', {type:'button', text:o[0], onclick:function(){ go(o[1], o[0]); }})); });
    body.appendChild(a);
  }
  $('trReset').addEventListener('click', function(){ path = []; go('start'); });
  go('start');
})();

/* ================= Suivi, attestation, espace formateur ================= */
TR = {db:null, user:null, ref:null, uid:null, timer:null, admin:false};
function syncStatus(t, on){ var s = $('meStatus'); if (s){ s.textContent = t; s.className = 'sync' + (on ? ' on' : ''); } }
function progressDoc(){
  var modsOut = {};
  mods.forEach(function(s){ modsOut[s.id] = {seen: Math.min(seenCount(s.id), stepsOf(s).length), total: stepsOf(s).length, quiz: st.quiz[s.id] || 0, ok: isDone(s)}; });
  var validated = mods.filter(isDone).length;
  return {name: (st.name || '').slice(0, 80), validated: validated, total: mods.length, final: st.final || 0, finalTries: st.finalTries || 0, bonus: st.bonus || 0, certified: eligible(), certNo: st.certNo || null, certAt: st.certAt || null, modules: modsOut, updatedAt: new Date().toISOString()};
}
function schedulePush(){
  if (!TR.ref) return;
  clearTimeout(TR.timer);
  TR.timer = setTimeout(function(){
    TR.ref.set(progressDoc()).then(function(){
      syncStatus('Progression partagée avec le formateur · ' + new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}), true);
    }, function(e){
      if (e && e.code === 'invalid_argument') { syncStatus('Le formateur ne vous a pas donné le droit d’enregistrer : progression gardée sur cet appareil.', false); TR.ref = null; }
      else syncStatus('Enregistrement en attente (connexion). Nouvel essai au prochain changement.', false);
    });
  }, 2000);
}
function eligible(){ return mods.every(isDone) && (st.final || 0) >= 16 && !!(st.name || '').trim(); }
function mergeRemote(d){
  if (!d) return;
  if (d.modules) Object.keys(d.modules).forEach(function(id){
    var m = d.modules[id], s = $(id); if (!s) return;
    var loc = st.seen[id] = st.seen[id] || [];
    for (var i = 0; i < Math.min(m.seen || 0, stepsOf(s).length); i++) if (loc.indexOf(i) < 0 && loc.length < (m.seen || 0)) loc.push(i);
    st.quiz[id] = Math.max(st.quiz[id] || 0, m.quiz || 0);
  });
  st.final = Math.max(st.final || 0, d.final || 0);
  st.finalTries = Math.max(st.finalTries || 0, d.finalTries || 0);
  st.bonus = d.bonus || 0;
  if (!st.certNo && d.certNo){ st.certNo = d.certNo; st.certAt = d.certAt; }
  if (!st.name && d.name) st.name = d.name;
}
(function(){
  var inp = $('meName');
  inp.value = st.name || '';
  inp.addEventListener('input', function(){ st.name = inp.value; save(); });
  syncStatus('Progression enregistrée sur cet appareil.', false);
  if (!window.claude || !window.claude.use){ return; }
  Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function(r){
    var db = r[0], user = r[1];
    if (!db || !user) return;
    TR.db = db; TR.user = user;
    return user.id().then(function(uid){
      if (!uid) return;
      TR.uid = uid; TR.ref = db.doc('results/' + uid);
      return TR.ref.get().then(function(snap){
        if (snap.exists) mergeRemote(snap.data());
        var p = st.name ? Promise.resolve() : user.me().then(function(me){ if (me.name && !st.name) st.name = me.name; });
        return p.then(function(){
          inp.value = st.name || ''; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e){}
          syncStatus('Progression partagée avec le formateur.', true);
          if (!$('home').hidden) buildHome();
          schedulePush();
        });
      }, function(){ syncStatus('Suivi partagé indisponible pour le moment : progression gardée sur cet appareil.', false); TR.ref = null; });
    }).then(function(){ return user.canEdit(); }).then(function(adm){
      TR.admin = !!adm;
      if (TR.admin){ $('formateur').dataset.hide = ''; if (!$('home').hidden) buildHome(); watchClass(); }
    });
  }, function(){});
})();
TR.rows = [];
function watchClass(){
  var body = $('fmBody'), msgEl = $('fmMsg');
  $('fmExport').addEventListener('click', exportCsv);
  TR.db.collection('results').onSnapshot(function(snap){
    var rows = snap.docs.map(function(d){ var o = Object.assign({}, d.data() || {}); o.id = d.id; return o; });
    rows.sort(function(a, b){ return (b.validated || 0) - (a.validated || 0) || String(a.name || '').localeCompare(String(b.name || '')); });
    TR.rows = rows; body.innerHTML = '';
    $('fmExport').disabled = !rows.length;
    if (!rows.length){ msgEl.textContent = 'Aucun stagiaire pour l’instant. Partagez la page avec eux en « Peut interagir ».'; $('fmDetail').innerHTML = ''; return; }
    msgEl.textContent = rows.length + ' stagiaire' + (rows.length > 1 ? 's' : '') + ' · ' + rows.filter(function(r){ return r.certified; }).length + ' certifié(s). Cliquez une ligne pour le détail.';
    rows.forEach(function(r){
      var pct = r.total ? (r.validated || 0) / r.total * 100 : 0;
      var tr = el('tr', {tabindex:'0', style:'cursor:pointer'}, [
        el('td', {text: r.name || 'Sans nom'}),
        el('td', null, [el('span', {'class':'pb'}, [el('i', {style:'width:' + pct + '%'})])]),
        el('td', {'class':'num', text: (r.validated || 0) + ' / ' + (r.total || '–')}),
        el('td', {'class':'num', text: (r.final ? r.final + ' / 20' : '–') + ' · ' + (r.finalTries || 0) + ' essai' + ((r.finalTries || 0) > 1 ? 's' : '')}),
        el('td', null, [el('span', {'class':'badge' + (r.certified ? ' ok' : ''), text: r.certified ? (r.certNo || 'Certifié') : 'En cours'})]),
        el('td', {'class':'num', text: r.updatedAt ? new Date(r.updatedAt).toLocaleString('fr-FR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : '–'})
      ]);
      tr.addEventListener('click', function(){ detail(r.id); });
      tr.addEventListener('keydown', function(e){ if (e.key === 'Enter') detail(r.id); });
      body.appendChild(tr);
    });
    if (TR.open) detail(TR.open, true);
  }, function(){ msgEl.textContent = 'Impossible de lire les résultats pour le moment.'; });
}
function detail(id, refresh){
  var r = TR.rows.filter(function(x){ return x.id === id; })[0], box = $('fmDetail');
  if (!r){ box.innerHTML = ''; TR.open = null; return; }
  TR.open = id; box.innerHTML = '';
  box.appendChild(el('h4', {text: 'Détail : ' + (r.name || 'Sans nom')}));
  var t = el('table'), tb = el('tbody');
  t.appendChild(el('thead', null, [el('tr', null, [el('th', {text:'Module'}), el('th', {text:'Étapes vues'}), el('th', {text:'Quiz'}), el('th', {text:'Statut'})])]));
  mods.forEach(function(s){
    var m = (r.modules || {})[s.id] || {};
    tb.appendChild(el('tr', null, [el('td', {text: s.dataset.num + ' · ' + s.dataset.title}), el('td', {'class':'num', text: (m.seen || 0) + ' / ' + (m.total || stepsOf(s).length)}), el('td', {'class':'num', text: s.id === 'm0' ? '—' : (m.quiz || 0) + ' / 3'}), el('td', null, [el('span', {'class':'badge' + (m.ok ? ' ok' : (m.seen ? ' go' : '')), text: m.ok ? 'Validé' : (m.seen ? 'En cours' : 'À faire')})])]));
  });
  t.appendChild(tb); box.appendChild(el('div', {'class':'tbl'}, [t]));
  box.appendChild(el('p', {text: 'Évaluation finale : ' + (r.final ? r.final + ' / 20' : 'non passée') + ' · essais utilisés : ' + (r.finalTries || 0) + ' sur ' + (3 + (r.bonus || 0)) + (r.certNo ? ' · attestation ' + r.certNo : '')}));
  var fb = el('p', {'class':'msg', hidden:''});
  var bonus = el('button', {'class':'btn', type:'button', text:'Accorder un essai supplémentaire', onclick:function(){
    TR.db.doc('results/' + id).update({bonus: (r.bonus || 0) + 1}).then(function(){ fb.hidden = false; fb.className = 'msg ok'; fb.textContent = 'Essai accordé. Le stagiaire doit recharger la page pour le voir.'; }, function(){ fb.hidden = false; fb.className = 'msg bad'; fb.textContent = 'Impossible d’enregistrer pour le moment. Réessayez.'; });
  }});
  var del = el('button', {'class':'btn', type:'button', text:'Retirer ce stagiaire du tableau'});
  del.addEventListener('click', function(){
    if (del.dataset.confirm !== '1'){ del.dataset.confirm = '1'; del.textContent = 'Confirmer la suppression'; del.style.borderColor = 'var(--bad)'; del.style.color = 'var(--bad)'; return; }
    TR.db.doc('results/' + id).delete().then(function(){ TR.open = null; box.innerHTML = ''; }, function(){ fb.hidden = false; fb.className = 'msg bad'; fb.textContent = 'Suppression impossible pour le moment. Réessayez.'; });
  });
  box.appendChild(el('div', {'class':'row'}, [bonus, del, el('button', {'class':'btn', type:'button', text:'Fermer', onclick:function(){ TR.open = null; box.innerHTML = ''; }})]));
  box.appendChild(fb);
  if (!refresh) box.scrollIntoView({block:'nearest'});
}
function exportCsv(){
  var head = ['Stagiaire','Modules validés','Total modules','Évaluation finale /20','Essais utilisés','Certifié','N° attestation','Dernière activité'].concat(mods.map(function(s){ return 'M' + s.dataset.num; }));
  var esc = function(v){ v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  var lines = [head.map(esc).join(';')];
  TR.rows.forEach(function(r){
    var row = [r.name || 'Sans nom', r.validated || 0, r.total || '', r.final || '', r.finalTries || 0, r.certified ? 'oui' : 'non', r.certNo || '', r.updatedAt ? new Date(r.updatedAt).toLocaleString('fr-FR') : ''];
    mods.forEach(function(s){ var m = (r.modules || {})[s.id] || {}; row.push(m.ok ? 'validé' : (m.seen || 0) + '/' + (m.total || '')); });
    lines.push(row.map(esc).join(';'));
  });
  var csv = '﻿' + lines.join('\r\n'), fm = $('fmMsg');
  window.claude.use('downloads').then(function(dl){
    if (!dl){ fm.textContent = 'Export indisponible ici.'; return; }
    dl.save({filename: 'resultats-formation-led-' + new Date().toISOString().slice(0, 10) + '.csv', data: csv}).then(function(){ fm.textContent = 'Export enregistré. Il s’ouvre dans Excel.'; }, function(e){ fm.textContent = e && e.code === 'declined' ? 'Export annulé.' : 'Export impossible pour le moment.'; });
  });
}
function renderAttest(){
  var box = $('attBox'); if (!box) return;
  box.innerHTML = '';
  var miss = el('ul', {'class':'missing'});
  var nOk = mods.filter(isDone).length;
  miss.appendChild(el('li', {'class': nOk === mods.length ? 'ok' : '', text: 'Modules validés : ' + nOk + ' / ' + mods.length}));
  miss.appendChild(el('li', {'class': (st.final || 0) >= 16 ? 'ok' : '', text: 'Évaluation finale : ' + (st.final ? st.final + ' / 20' : 'non passée') + ' (16 minimum)'}));
  miss.appendChild(el('li', {'class': (st.name || '').trim() ? 'ok' : '', text: 'Nom pour l’attestation : ' + ((st.name || '').trim() || 'à saisir sur l’accueil')}));
  box.appendChild(miss);
  if (!eligible()){
    var todo = mods.filter(function(s){ return !isDone(s); });
    if (todo.length){
      box.appendChild(el('p', {text:'Modules restant à valider :'}));
      var ul = el('div', {'class':'chips'});
      todo.forEach(function(s){ ul.appendChild(el('button', {'class':'chip', type:'button', text: s.dataset.num + ' · ' + s.dataset.title, onclick:function(){ openMod(s.id); }})); });
      box.appendChild(ul);
    }
    return;
  }
  if (!st.certNo){
    var seed = (TR && TR.uid ? TR.uid : '') + (st.name || '') + Date.now(), h = 2166136261;
    for (var ci = 0; ci < seed.length; ci++){ h ^= seed.charCodeAt(ci); h = Math.imul(h, 16777619) >>> 0; }
    st.certNo = 'LED-' + new Date().getFullYear() + '-' + ('000000' + h.toString(36).toUpperCase()).slice(-6);
    st.certAt = new Date().toISOString(); save();
  }
  box.appendChild(el('p', {text: 'N° d\u2019attestation : ' + st.certNo + '. Le formateur retrouve ce numéro dans son tableau pour confirmer l\u2019attestation.'}));
  var cvs = el('canvas', {id:'attCanvas', width:'1600', height:'1131', 'aria-label':'Attestation de formation'});
  box.appendChild(cvs); drawAttest(cvs);
  var b = el('button', {'class':'btn primary', type:'button', text:'Télécharger l’attestation (PNG)'});
  var m = el('p', {'class':'msg', hidden:''});
  box.appendChild(b); box.appendChild(m);
  (window.claude && window.claude.use ? window.claude.use('downloads') : Promise.resolve(null)).then(function(dl){
    if (!dl){ b.hidden = true; m.hidden = false; m.textContent = 'Le téléchargement n’est pas disponible ici : faites une capture de l’attestation.'; return; }
    b.addEventListener('click', function(){
      cvs.toBlob(function(blob){
        var fn = 'attestation-formation-ecrans-led-' + (st.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') + '.png';
        dl.save({filename: fn, data: blob}).then(function(){ m.hidden = false; m.className = 'msg ok'; m.textContent = 'Attestation enregistrée.'; }, function(e){
          m.hidden = false; m.className = 'msg bad';
          m.textContent = e && e.code === 'declined' ? 'Téléchargement annulé.' : 'Téléchargement impossible pour le moment. Réessayez dans un instant.';
        });
      }, 'image/png');
    });
  });
}
function drawAttest(c){
  var x = c.getContext('2d'), W = c.width, H = c.height;
  x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#07090C'; x.fillRect(0, 0, W, 180);
  for (var i = 0; i < 80; i++) for (var j = 0; j < 9; j++){ x.fillStyle = 'rgba(255,255,255,' + (0.04 + ((i*7+j*3) % 5) * 0.012) + ')'; x.fillRect(12 + i*20, 12 + j*18, 4, 4); }
  ['#E0352A','#17A454','#2563EB'].forEach(function(col, k){ x.fillStyle = col; x.fillRect(90 + k*20, 62, 12, 56); });
  x.fillStyle = '#F2F5F8'; x.font = '800 54px Archivo, "Arial Narrow", Arial, sans-serif'; x.textBaseline = 'middle';
  x.fillText('ATTESTATION DE FORMATION', 170, 92);
  x.strokeStyle = '#15191F'; x.lineWidth = 3; x.strokeRect(40, 220, W - 80, H - 260);
  x.fillStyle = '#56606C'; x.font = '500 26px "IBM Plex Mono", Menlo, monospace'; x.fillText('DÉLIVRÉE À', 110, 300);
  x.fillStyle = '#15191F'; x.font = '800 86px Archivo, "Arial Narrow", Arial, sans-serif'; x.fillText((st.name || '').trim().toUpperCase().slice(0, 34), 106, 385);
  x.fillStyle = '#15191F'; x.font = '400 32px "IBM Plex Sans", "Segoe UI", sans-serif';
  x.fillText('qui a suivi et validé la formation', 110, 470);
  x.font = '700 40px "IBM Plex Sans", "Segoe UI", sans-serif'; x.fillStyle = '#1650B8';
  x.fillText('Écrans LED : installation de tous les types et programmation', 110, 525);
  x.fillStyle = '#15191F'; x.font = '400 28px "IBM Plex Sans", "Segoe UI", sans-serif';
  var facts = [['Durée', '35 heures'], ['Modules validés', mods.length + ' / ' + mods.length], ['Évaluation finale', (st.final || 0) + ' / 20'], ['Date', new Date(st.certAt || Date.now()).toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'})]];
  facts.forEach(function(f, k){
    var fx = 110 + k * 350;
    x.fillStyle = '#56606C'; x.font = '500 20px "IBM Plex Mono", Menlo, monospace'; x.fillText(f[0].toUpperCase(), fx, 610);
    x.fillStyle = '#15191F'; x.font = '700 34px "IBM Plex Sans", "Segoe UI", sans-serif'; x.fillText(f[1], fx, 652);
  });
  x.fillStyle = '#56606C'; x.font = '500 20px "IBM Plex Mono", Menlo, monospace'; x.fillText('PROGRAMME', 110, 735);
  x.fillStyle = '#15191F'; x.font = '400 21px "IBM Plex Sans", "Segoe UI", sans-serif';
  mods.forEach(function(s, k){ var col = k < 8 ? 0 : 1, row = k % 8; x.fillText(s.dataset.num + '  ' + s.dataset.title, 110 + col * 700, 775 + row * 32); });
  x.strokeStyle = '#15191F'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(1080, 1040); x.lineTo(1480, 1040); x.stroke();
  x.fillStyle = '#56606C'; x.font = '500 20px "IBM Plex Mono", Menlo, monospace'; x.fillText('SIGNATURE DU FORMATEUR', 1080, 1065);
  x.fillText('N° ' + (st.certNo || ''), 110, 1065);
}

var LAZY = {};
route();
})();
