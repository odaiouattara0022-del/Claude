W = {}
W['chain'] = ('Atelier : la chaîne du signal', '''<div class="lab" id="labChain">
  <p class="intro">Cliquez sur chaque maillon pour découvrir son rôle, ce qu'on y règle et la panne typique associée.</p>
  <div class="chain" id="chainBtns"></div>
  <div class="infopanel" id="chainInfo" aria-live="polite"></div>
</div>''')
W['gallery'] = ('Atelier : les familles d\'écrans', '''<div class="lab" id="labGallery">
  <p class="intro">Filtrez par usage, puis cliquez sur une famille pour afficher sa fiche.</p>
  <div class="chips" id="galFilters"></div>
  <div class="gallery" id="galGrid"></div>
  <div class="infopanel" id="galInfo" aria-live="polite"></div>
</div>''')
W['scen'] = ('Atelier : quel écran pour quel lieu ?', '''<div class="lab" id="labScen">
  <p class="intro">Cinq demandes de clients. Choisissez la solution la plus adaptée : la correction s'affiche aussitôt.</p>
  <div class="qs" id="scenList"></div>
</div>''')
W['arc'] = ('Atelier : calculer un écran courbe', '''<div class="lab" id="labArc">
  <p class="intro">Réglez le rayon et la largeur des cabinets : l'outil donne l'angle à régler sur les verrous et le nombre de cabinets.</p>
  <div class="row">
    <label class="f" for="aR">Rayon (m)<input id="aR" type="number" min="1" step="0.5" value="6"></label>
    <label class="f" for="aW">Largeur cabinet (mm)<input id="aW" type="number" min="100" step="10" value="500"></label>
    <label class="f" for="aA">Arc total (°)<input id="aA" type="number" min="5" max="360" step="5" value="90"></label>
  </div>
  <div class="out"><div><span>Angle entre cabinets</span><b id="aoAng">–</b></div><div><span>Cabinets sur l'arc</span><b id="aoN">–</b></div><div><span>Longueur d'arc</span><b id="aoL">–</b></div></div>
  <p class="msg" id="aoMsg"></p>
</div>''')
W['lines'] = ('Atelier : répartir l\'alimentation', '''<div class="lab" id="labLines">
  <p class="intro">Combien de cabinets par ligne, combien de départs, combien de différentiels ? Modifiez les valeurs.</p>
  <div class="row">
    <label class="f" for="lN">Nombre de cabinets<input id="lN" type="number" min="1" value="84"></label>
    <label class="f" for="lP">Puissance max / cabinet (W)<input id="lP" type="number" min="10" step="10" value="150"></label>
    <label class="f" for="lI">Disjoncteur (A)<select id="lI"><option>10</option><option selected>16</option><option>20</option><option>32</option></select></label>
    <label class="f" for="lF">Fuite par alimentation (mA)<input id="lF" type="number" min="0.1" step="0.1" value="0.8"></label>
    <label class="f" for="lA">Alimentations / cabinet<input id="lA" type="number" min="1" value="1"></label>
  </div>
  <div class="out"><div><span>Cabinets par ligne (80 %)</span><b id="loC">–</b></div><div><span>Départs nécessaires</span><b id="loL">–</b></div><div><span>Différentiels 30 mA min.</span><b id="loD">–</b></div><div><span>Puissance totale max</span><b id="loP">–</b></div><div><span>Par phase (tri)</span><b id="loPh">–</b></div><div><span>Fuite totale</span><b id="loF">–</b></div></div>
  <p class="msg" id="loMsg"></p>
</div>''')
W['order'] = ('Atelier : remettre la procédure dans l\'ordre', '''<div class="lab" id="labOrder">
  <p class="intro">Les 12 étapes d'une installation sont mélangées. Remettez-les dans l'ordre avec les flèches, puis vérifiez.</p>
  <ol class="order" id="orderList"></ol>
  <div class="row"><button class="btn primary" id="orderCheck" type="button">Vérifier</button><button class="btn" id="orderShuffle" type="button">Mélanger</button></div>
  <p class="msg" id="orderMsg" hidden></p>
</div>''')
W['wire'] = ('Atelier : câbler un mur', '''<div class="lab wire" id="labWire">
  <p class="intro">Mur de 6 × 3 cabinets P2.6 (192 × 192 px chacun). Un port Gigabit porte au plus 650 000 pixels, soit 17 cabinets. Choisissez un port, puis cliquez les cabinets dans l'ordre du câble : chaque cabinet doit toucher le précédent.</p>
  <div class="row"><div class="chips" id="wirePorts"></div><button class="btn" id="wireUndo" type="button">Annuler le dernier</button><button class="btn" id="wireClear" type="button">Tout effacer</button><button class="btn primary" id="wireCheck" type="button">Vérifier</button></div>
  <svg id="wireSvg" viewBox="0 0 620 320" role="img" aria-label="Grille de 18 cabinets à câbler"></svg>
  <p class="msg" id="wireMsg">Port A sélectionné. Cliquez le premier cabinet.</p>
</div>''')
W['nova'] = ('Simulateur NovaLCT', '''<div class="lab" id="labNova">
  <p class="intro">Mission : configurer un mur de 2 × 2 cabinets de zéro. Le câblage réel part du coin haut gauche vu de face, va à droite, descend, puis revient à gauche (serpentin). Suivez les objectifs.</p>
  <div class="nova">
    <div class="win">
      <div class="tb"><span>NovaLCT · Screen Configuration</span><span id="nvUser">Utilisateur : invité</span></div>
      <div class="tabs" role="tablist">
        <button role="tab" id="nvT0" aria-selected="true" type="button">Connexion</button>
        <button role="tab" id="nvT1" aria-selected="false" type="button" disabled>Carte émettrice</button>
        <button role="tab" id="nvT2" aria-selected="false" type="button" disabled>Carte réceptrice</button>
        <button role="tab" id="nvT3" aria-selected="false" type="button" disabled>Connexion écran</button>
      </div>
      <div class="pane" id="nvP0">
        <p>Menu <kbd>User</kbd> → <kbd>Advanced Synchronous System User Login</kbd></p>
        <label class="f" for="nvPwd">Mot de passe<input id="nvPwd" type="password" autocomplete="off" placeholder="mot de passe d'usine"></label>
        <button class="btn primary" id="nvLogin" type="button">Se connecter</button>
        <p class="msg" id="nvLoginMsg" hidden></p>
      </div>
      <div class="pane" id="nvP1" hidden>
        <p><b>Carte émettrice détectée :</b> MCTRL300 · COM3</p>
        <p class="label" style="text-transform:none;letter-spacing:0">Entrée HDMI · 1920 × 1080 à 60 Hz · 2 ports de sortie</p>
        <p>Rien à changer ici pour cette mission. Passez à la carte réceptrice.</p>
      </div>
      <div class="pane" id="nvP2" hidden>
        <p><b>Étiquette au dos d'un module :</b> <code>P2.6 · driver ICN2153 · scan 1/32 · cabinet 192×192</code></p>
        <p>Choisissez le fichier fourni par le fabricant :</p>
        <div class="files" id="nvFiles"></div>
      </div>
      <div class="pane" id="nvP3" hidden>
        <p>Cliquez les cabinets dans l'ordre du câblage réel (vue de face).</p>
        <div class="mapgrid" id="nvMap"></div>
        <button class="btn" id="nvMapClear" type="button" style="width:max-content">Effacer le tracé</button>
      </div>
      <div class="act">
        <button class="btn" id="nvSend" type="button" disabled>Send to HW</button>
        <button class="btn" id="nvSave" type="button" disabled>Save</button>
        <button class="btn" id="nvPower" type="button">Couper / rallumer l'écran</button>
      </div>
    </div>
    <div class="screen">
      <span class="label">Mur LED (vue de face)</span>
      <div class="ledwall" id="nvWall"><div></div><div></div><div></div><div></div></div>
      <p class="msg" id="nvMsg">Écran allumé, cartes non configurées.</p>
      <span class="label">Objectifs</span>
      <ul class="goals" id="nvGoals">
        <li>Se connecter en utilisateur avancé</li>
        <li>Choisir le bon fichier de carte réceptrice</li>
        <li>Tracer la connexion comme le câblage réel</li>
        <li>Envoyer au matériel : chaque cabinet affiche son numéro 1-2 / 3-4</li>
        <li>Sauvegarder dans les cartes</li>
        <li>Couper et rallumer : l'image revient correcte</li>
      </ul>
    </div>
  </div>
</div>''')
W['playlist'] = ('Atelier : programmer un totem', '''<div class="lab" id="labPl">
  <p class="intro">Composez la boucle de diffusion d'un totem asynchrone, réglez les horaires, puis lancez l'aperçu (accéléré 10 fois).</p>
  <div class="pl">
    <div style="display:flex;flex-direction:column;gap:12px;min-width:0">
      <ul class="plist" id="plList"></ul>
      <div class="row"><button class="btn" id="plAdd" type="button">+ Ajouter une page</button><button class="btn primary" id="plPlay" type="button">Aperçu</button></div>
      <div class="row">
        <label class="f" for="plFrom">Allumage<select id="plFrom"></select></label>
        <label class="f" for="plTo">Extinction<select id="plTo"></select></label>
      </div>
      <div class="out"><div><span>Durée de la boucle</span><b id="plLoop">–</b></div><div><span>Boucles par heure</span><b id="plPerH">–</b></div><div><span>Passages par jour</span><b id="plPerD">–</b></div></div>
      <p class="msg" id="plMsg" hidden></p>
    </div>
    <div class="totem" id="plTotem" aria-live="polite"><span id="plNow">Prêt</span><div class="pb"><i id="plBar"></i></div></div>
  </div>
</div>''')
W['res'] = ('Atelier : pixel pour pixel', '''<div class="lab resviz" id="labRes">
  <p class="intro">Comparez la sortie de l'ordinateur et la résolution de l'écran LED, en mode découpe ou mise à l'échelle.</p>
  <div class="row">
    <label class="f" for="rW">Écran LED largeur (px)<input id="rW" type="number" min="64" step="16" value="2304"></label>
    <label class="f" for="rH">Écran LED hauteur (px)<input id="rH" type="number" min="64" step="16" value="1344"></label>
    <label class="f" for="rSrc">Sortie du PC<select id="rSrc"><option value="1920x1080">1920 × 1080</option><option value="3840x2160">3840 × 2160</option><option value="led">Résolution personnalisée = LED</option></select></label>
  </div>
  <div class="chips" id="rMode"><button class="chip" type="button" data-m="crop" aria-pressed="true">Découpe</button><button class="chip" type="button" data-m="scale" aria-pressed="false">Mise à l'échelle</button></div>
  <svg id="rSvg" viewBox="0 0 620 360" role="img" aria-label="Comparaison des résolutions"></svg>
  <p class="msg" id="rMsg"></p>
</div>''')
W['defects'] = ('Atelier : trouver les défauts', '''<div class="lab" id="labDef">
  <p class="intro">Ce mur de 8 × 4 cabinets cache 4 défauts. Affichez les mires une par une et cliquez sur chaque cabinet défectueux. Certains défauts ne se voient qu'avec une seule mire.</p>
  <div class="chips" id="defPat"></div>
  <div class="dwall" id="defWall"></div>
  <p class="msg" id="defMsg">Défauts trouvés : 0 / 4</p>
</div>''')
W['tree'] = ('Atelier : arbre de dépannage', '''<div class="lab tree" id="labTree">
  <p class="intro">Répondez aux questions comme devant un écran en panne : l'arbre vous mène à la cause probable et à l'action.</p>
  <p class="crumbs" id="trCrumbs"></p>
  <div id="trBody" aria-live="polite"></div>
  <button class="btn" id="trReset" type="button" style="width:max-content">Recommencer</button>
</div>''')
