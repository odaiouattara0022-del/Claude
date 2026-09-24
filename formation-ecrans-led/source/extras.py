# Étapes supplémentaires : module -> {prefixe h3 : [(type, titre, html)]}
X = {}
X[9] = {'9.2': [('atelier','Simulateur NovaLCT','<h3>Simulateur NovaLCT (NovaStar)</h3><div class="lab" data-sim="nova"></div>')], '9.3': [('atelier','Simulateur LEDVISION','<h3>Simulateur LEDVISION (Colorlight)</h3><div class="lab" data-sim="ledvision"></div>')],
        '9.4': [('cours','Processeurs VX et série H','''<h3>Processeurs tout-en-un : VX et série H</h3>
<p>Un processeur tout-en-un réunit la carte émettrice, la mise à l'échelle et le mélange de sources. C'est l'équipement type d'une église, d'une salle de conférence ou d'une scène.</p>
<div class="tbl"><table>
<thead><tr><th>Modèle</th><th>Ports Gigabit</th><th>Capacité</th><th>Usage type</th></tr></thead>
<tbody>
<tr><td>NovaStar VX400</td><td class="num">4</td><td class="num">≈ 2,6 M px</td><td>Écran de salle jusqu'à ≈ 20 m² en P2.6</td></tr>
<tr><td>NovaStar VX600</td><td class="num">6</td><td class="num">≈ 3,9 M px</td><td>Écran d'auditorium, grande église</td></tr>
<tr><td>NovaStar VX1000</td><td class="num">10</td><td class="num">≈ 6,5 M px</td><td>Scène, grands murs 4K</td></tr>
<tr><td>NovaStar série H</td><td class="num">modulaire</td><td class="num">des dizaines de M px</td><td>Salles de contrôle, très grands murs, multi-fenêtres</td></tr>
</tbody></table></div>
<h4>Réglages depuis la façade (molette et écran)</h4>
<ol class="steps">
<li><div><strong>Configuration rapide de l'écran</strong> Nombre de cabinets en lignes et colonnes, taille d'un cabinet, sens du câblage de chaque port. Pour un mur complexe, préférez NovaLCT ou SmartLCT depuis un PC relié en Ethernet.</div></li>
<li><div><strong>Entrées</strong> Choix de la source (HDMI, DP, SDI, DVI), EDID personnalisé à la résolution de l'écran pour que le PC sorte directement la bonne taille.</div></li>
<li><div><strong>Couches (layers)</strong> Une couche principale plein écran et une ou plusieurs incrustations (PIP) : position, taille, source. Exemple : paroles en plein écran et caméra de l'orateur en PIP.</div></li>
<li><div><strong>Préréglages (presets)</strong> Enregistrez une combinaison de couches par moment de l'événement (louange, prédication, annonces) et rappelez-la d'un bouton.</div></li>
<li><div><strong>Secours d'entrée</strong> Déclarez une source de secours : si le PC principal perd le signal, le processeur bascule automatiquement.</div></li>
<li><div><strong>Sortie</strong> Luminosité globale, synchronisation (genlock) si l'écran est filmé avec d'autres sources, mode faible latence.</div></li>
<li><div><strong>Verrouillage</strong> Verrouillez la façade après réglage pour éviter les fausses manipulations.</div></li>
</ol>
<div class="note warn"><strong>Menus</strong><p>L'intitulé exact des menus change selon la version du firmware. Gardez le manuel de votre version à portée de main.</p></div>''')]}
X[10] = {'10.2': [('atelier','Simulateur HDPlayer','<h3>Simulateur HDPlayer (Huidu)</h3><div class="lab" data-sim="hdplayer"></div>')],
         '10.4': [('cours','VNNOX, 4G et mises à jour','''<h3>VNNOX, 4G et mises à jour du firmware</h3>
<h4>Relier un lecteur Taurus à VNNOX</h4>
<ol class="steps">
<li><div><strong>Créer le compte</strong> Sur la plateforme VNNOX, créez le compte de l'entreprise. Notez le nom d'utilisateur et l'adresse du serveur de votre région.</div></li>
<li><div><strong>Lier le terminal</strong> Dans ViPlex Express ou ViPlex Handy, ouvrez les paramètres du terminal, rubrique VNNOX. Saisissez le serveur et le nom d'utilisateur, puis liez.</div></li>
<li><div><strong>Vérifier</strong> Le terminal apparaît « en ligne » dans VNNOX. Vous pouvez publier des solutions, planifier, prendre des captures d'écran à distance et recevoir des alertes.</div></li>
</ol>
<h4>Connexion 4G</h4>
<ul>
<li>Carte SIM sans code PIN, forfait données adapté au volume de contenus (une vidéo 1080p de 30 s pèse souvent 20 à 60 Mo).</li>
<li>Réglage de l'APN de l'opérateur dans ViPlex si la connexion ne monte pas seule. Vérifiez le niveau de signal avant de refermer le caisson.</li>
<li>Préférez l'envoi des contenus lourds la nuit, et gardez le Wi-Fi du lecteur désactivé s'il n'est pas utile.</li>
</ul>
<h4>Mettre à jour le firmware</h4>
<ul>
<li>Téléchargez le firmware sur le site officiel, pour le modèle exact (TB40 ≠ TB40 Plus).</li>
<li>Lecteurs : mise à jour depuis ViPlex. Cartes émettrices et réceptrices : fonction de chargement du programme de NovaLCT.</li>
<li>Ne coupez jamais le courant pendant une mise à jour. Mettez toutes les cartes réceptrices d'un écran à la même version.</li>
<li>Sauvegardez la configuration avant, notez les versions dans le dossier de l'écran après.</li>
</ul>''')]}
X[11] = {'11.4': [('cours','Écrans de forme spéciale','''<h3>Écrans de forme spéciale : le plan de pixels</h3>
<p>Colonne, cylindre, ruban, cube : l'image rectangulaire de l'ordinateur doit être découpée et placée sur des surfaces qui ne sont pas planes ni alignées. C'est le rôle du plan de pixels (pixel map).</p>
<ol class="steps">
<li><div><strong>Relever la géométrie</strong> Pour chaque face ou chaque rangée de modules : dimensions, position, orientation, ordre de câblage.</div></li>
<li><div><strong>Placer les cartes dans le logiciel</strong> Dans NovaLCT (configuration d'écran complexe ou irrégulière) ou LEDVISION, positionnez chaque carte réceptrice à ses coordonnées X/Y dans l'image, avec rotation si besoin.</div></li>
<li><div><strong>Produire l'image de plan de pixels</strong> Un canevas rectangulaire où toutes les faces sont « dépliées », avec leurs contours et numéros. C'est le gabarit des graphistes.</div></li>
<li><div><strong>Mapper le contenu</strong> Pour une simple découpe : Resolume (Advanced Output). Pour une vraie scène 3D : un serveur média (disguise, Pixera, MadMapper) qui projette le contenu sur un modèle 3D de l'écran.</div></li>
<li><div><strong>Tester la continuité</strong> Faites défiler une mire (ligne ou damier) : elle doit passer d'une face à l'autre sans saut ni décalage.</div></li>
</ol>
<div class="formula">Exemple : colonne cylindrique, diamètre 1 m, hauteur 3 m, modules flexibles P2.5
Périmètre   = π × 1 000 mm = 3 142 mm  → 3 142 / 2,5 ≈ 1 257 px de large
Hauteur     = 3 000 / 2,5             = 1 200 px
Canevas     = 1 257 × 1 200 px, avec une jointure de fermeture à placer à l'arrière</div>''')]}
X[13] = {'13.4': [('cours','Réparer un module en atelier','''<h3>Réparer un module en atelier</h3>
<p>Remplacer quelques LED sur un module SMD est rentable et rapide avec le bon matériel. Les modules GOB et COB (résine ou puces nues) repartent en usine.</p>
<div class="cols2">
<div><h4>Matériel</h4><ul><li>Station à air chaud réglable, buse fine</li><li>Plaque de préchauffage</li><li>Brucelles antistatiques, bracelet et tapis ESD</li><li>Flux sans nettoyage, étain fin ou pâte à braser</li><li>Loupe ou microscope</li><li>LED de rechange de même référence et même classe de couleur (bin)</li></ul></div>
<div><h4>Précautions</h4><ul><li>Suivez les températures du fabricant : trop chaud, les LED voisines et le plastique souffrent.</li><li>Respectez la polarité et l'orientation (repère sur la LED et le circuit).</li><li>Travaillez vite : quelques secondes de chauffe suffisent.</li><li>Notez chaque intervention (module, position, date).</li></ul></div>
</div>
<ol class="steps">
<li><div><strong>Repérer</strong> Affichez les mires couleur, marquez la LED défectueuse au feutre au dos du module (position ligne/colonne).</div></li>
<li><div><strong>Préchauffer</strong> Posez le module sur la plaque pour limiter le choc thermique.</div></li>
<li><div><strong>Déposer</strong> Chauffez la LED à l'air chaud, débit faible, puis retirez-la aux brucelles dès que l'étain fond.</div></li>
<li><div><strong>Préparer</strong> Nettoyez les pastilles, ajoutez un peu de flux et d'étain.</div></li>
<li><div><strong>Poser</strong> Placez la LED neuve dans le bon sens, chauffez jusqu'à ce qu'elle se centre d'elle-même.</div></li>
<li><div><strong>Tester</strong> Laissez refroidir, testez le module sur le banc avec les mires avant de le remonter.</div></li>
</ol>''')]}

# Nouveau module
NEWMOD = {
 'title':'Chiffrage, contrats et logistique', 'dur':'2 h', 'day':5,
 'obj':'<div class="objectifs"><strong>Objectifs</strong><ul><li>Construire un devis complet et cohérent.</li><li>Proposer une garantie et un contrat de maintenance adaptés.</li><li>Organiser le transport, le stockage et le planning d\'un chantier.</li></ul></div>',
 'steps':[
  ('cours','Construire un devis','''<h3>Construire un devis</h3>
<p>Un devis d'écran LED ne se limite pas au prix au mètre carré. Oublier un poste coûte souvent plus que la marge.</p>
<div class="tbl"><table>
<thead><tr><th>Poste</th><th>Ce qu'il comprend</th><th>À ne pas oublier</th></tr></thead>
<tbody>
<tr><td>Écran</td><td>Cabinets, modules de rechange, cartes réceptrices</td><td>3 à 5 % de modules de rechange du même lot</td></tr>
<tr><td>Structure</td><td>Cadre, fixations, habillage, note de calcul</td><td>Bureau d'études et bureau de contrôle en extérieur</td></tr>
<tr><td>Contrôle</td><td>Processeur ou lecteur, capteur, carte multifonction</td><td>Ports de réserve, secours</td></tr>
<tr><td>Électricité et réseau</td><td>Tableau, câbles, parafoudre, fibre si besoin</td><td>Raccordement par un électricien habilité</td></tr>
<tr><td>Installation</td><td>Jours × techniciens, nacelle ou échafaudage</td><td>Déplacements, hébergement, heures de nuit</td></tr>
<tr><td>Mise en service</td><td>Configuration, calibration, recette, formation client</td><td>Burn-in de 24 à 72 h</td></tr>
<tr><td>Logistique</td><td>Transport, déchargement, évacuation des emballages</td><td>Accès camion, hayon, stockage sur site</td></tr>
<tr><td>Garantie et maintenance</td><td>Extension de garantie, contrat annuel</td><td>Délais d'intervention écrits</td></tr>
</tbody></table></div>'''),
  ('atelier','Atelier : chiffrer un chantier','<h3>Atelier : chiffrer un chantier</h3><div class="lab" data-sim="devis"></div>'),
  ('cours','Garanties et contrats de maintenance','''<h3>Garanties et contrats de maintenance</h3>
<ul>
<li><b>Garantie constructeur :</b> souvent 2 à 3 ans sur les pièces. Lisez les exclusions : surtension, humidité, chocs, vandalisme, installation non conforme.</li>
<li><b>Maintenance préventive :</b> visites planifiées (nettoyage, serrages, contrôles électriques, mises à jour, sauvegarde des configurations).</li>
<li><b>Maintenance curative :</b> intervention sur panne avec un délai garanti d'intervention (GTI) et parfois de rétablissement (GTR).</li>
<li><b>Télésurveillance :</b> alertes de température, de lecteur hors ligne ou de carte en défaut via VNNOX ou le cloud du fabricant.</li>
</ul>
<div class="tbl"><table>
<thead><tr><th>Formule</th><th>Préventif</th><th>Délai d'intervention</th><th>Inclus</th></tr></thead>
<tbody>
<tr><td>Essentiel</td><td class="num">1 visite / an</td><td class="num">5 jours ouvrés</td><td>Main-d'œuvre, pièces facturées</td></tr>
<tr><td>Confort</td><td class="num">2 visites / an</td><td class="num">48 h ouvrées</td><td>Télésurveillance, stock de rechange sur site</td></tr>
<tr><td>Événement</td><td class="num">avant chaque date clé</td><td class="num">4 h, technicien d'astreinte</td><td>Présence lors des événements majeurs</td></tr>
</tbody></table></div>
<p class="label" style="text-transform:none;letter-spacing:0">Exemple de gamme à adapter à votre activité.</p>'''),
  ('cours','Transport, stockage et planning','''<h3>Transport, stockage et planning</h3>
<div class="cols2">
<div><h4>Transport et manutention</h4><ul><li>Flight cases dédiés (souvent 6 ou 8 cabinets 500 × 500), face LED protégée, sangles.</li><li>Respecter le sens indiqué et la hauteur d'empilage maximale.</li><li>Inventaire par numéro de série au départ et au retour.</li><li>Jamais un cabinet posé sur sa face LED.</li></ul></div>
<div><h4>Stockage</h4><ul><li>Local sec et tempéré, sachets déshydratants dans les caisses.</li><li>Allumage régulier des écrans stockés longtemps, puis préchauffage progressif avant une date.</li><li>Modules de rechange rangés par lot, étiquetés.</li></ul></div>
</div>
<h4>Planning type d'un chantier fixe</h4>
<ol class="steps">
<li><div><strong>Étude</strong> Visite, dimensionnement, plans, note de calcul, validation du client.</div></li>
<li><div><strong>Préparation</strong> Commande (délais de fabrication souvent de plusieurs semaines), contrôle à réception, test en atelier.</div></li>
<li><div><strong>Travaux préalables</strong> Électricité et réseau par les corps d'état concernés, renforts éventuels.</div></li>
<li><div><strong>Installation</strong> Structure, écran, câblage, configuration.</div></li>
<li><div><strong>Mise en service</strong> Calibration, burn-in, recette, formation, remise du dossier.</div></li>
</ol>'''),
 ],
 'drill':['Chiffrez l\'écran de l\'église du module 4 avec l\'atelier de chiffrage, en listant vos hypothèses.','Rédigez une proposition de contrat de maintenance d\'une page pour ce client.','Préparez la liste de colisage (flight cases, câbles, outillage) pour une installation de 2 jours.'],
 'keep':['Chiffrer tous les postes, pas seulement le mètre carré d\'écran.','Écrire les délais d\'intervention et les exclusions de garantie.','Stocker au sec, inventorier par numéro de série.'],
}
