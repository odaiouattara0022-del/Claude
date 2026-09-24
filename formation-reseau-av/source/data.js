const DOMAINES=[
  {id:'fond',nom:'Fondations réseau',mods:['m1','m2']},
  {id:'mc',nom:'Multicast et horloge',mods:['m3','m4']},
  {id:'media',nom:'Audio, vidéo et streaming',mods:['m5','m6','m7']},
  {id:'conc',nom:'Conception et contrôle',mods:['m8','m9']},
  {id:'expl',nom:'Configuration, dépannage, sécurité',mods:['m10','m11','m12']}
];
const MODS=[
  {id:'m1',jour:1},{id:'m2',jour:1},{id:'m3',jour:2},{id:'m4',jour:2},{id:'m5',jour:3},{id:'m6',jour:3},
  {id:'m7',jour:4},{id:'m8',jour:4},{id:'m9',jour:4},{id:'m10',jour:5},{id:'m11',jour:5},{id:'m12',jour:5},
  {id:'cas',jour:5},{id:'big',jour:5}
];
const DIAG={
m3:`Émetteur ── flux 239.255.1.1 ──▶ Switch (snooping)

Récepteur ── IGMP Join ────────▶ Switch
                                   └─▶ le flux sort sur CE port uniquement

Querier ─── Query (60 à 125 s) ──▶ tous les ports
Récepteur ── Report ───────────▶ Switch   (abonnement renouvelé)

Récepteur ── IGMP Leave ───────▶ Switch
                                   └─▶ flux coupé sur ce port`,
m4:`          Grandmaster (GPS ou console)
                      │
          Switch cœur · boundary clock
             ┌────────┴─────────┐
      Switch scène         Switch régie
   transparent clock    transparent clock
             │             ┌────┴────┐
         Stagebox       Console   Caméra`,
m9:`                 Internet
                     │
             Routeur pare-feu
                     │
       Switch cœur 10G · querier + PTP
     ┌─────────┬─────┴──────┬──────────┐
   Scène     Régie   Caméras PoE++   Salle`,
m11:`  1  Symptôme précis
  │
  2  Couche 1 · LED, câble, erreurs CRC
  │
  3  Couche 2 · VLAN, port, trunk
  │
  4  Couche 3 · IP, masque, ping
  │
  5  Multicast · IGMP, querier, PTP
  │
  6  Application · routage Dante, format`,
big:`  STADE · 45 caméras
     │  passerelles ST 2110 + JPEG XS
     ├── chemin A · 100G ──┐
     └── chemin B · 100G ──┤
                           ▼
            IBC · cœur rouge / bleu
            PTP sur GPS + NMOS
                    │
             Régies centrales
           ┌────────┴────────┐
      Diffuseurs        Hub Londres`
};
const PIEGES_EXTRA={
  m9:['Acheter les switchs avant d’avoir calculé la charge des liens montants.','Un seul switch cœur sans onduleur.','Réseaux Dante primaire et secondaire reliés entre eux.','Aucune documentation : personne ne sait ce qui est branché où.'],
  m10:['Oublier write memory : tout est perdu au redémarrage.','Interface vlan créée mais laissée en shutdown.','Querier configuré sur plusieurs switchs du même VLAN.','PortFast activé sur un lien entre switchs.'],
  m11:['Changer plusieurs réglages à la fois : on ne sait plus lequel a réparé.','Accuser le logiciel avant d’avoir vérifié le câble.','PC de Dante Controller branché sur la mauvaise carte réseau.'],
  m12:['Mots de passe d’usine sur les caméras et les switchs.','Interface web d’un switch ouverte sur Internet.','Wi-Fi invités dans le même VLAN que le son.']
};
const ANTI={
m1:[['/24','254 adresses utilisables'],['Port access','1 VLAN non tagué, pour un appareil'],['Port trunk','Plusieurs VLAN tagués, entre switchs'],['169.254.x.x','Adresse automatique sans DHCP (link-local)'],['mDNS','224.0.0.251, port 5353 : découverte Dante/NDI'],['UDP','Son et image temps réel ; TCP pour le contrôle']],
m2:[['Cat6','1 Gb/s à 100 m (10G jusqu’à ~55 m)'],['Cat6A','10 Gb/s à 100 m'],['OM4','10 Gb/s à 400 m'],['OS2','10 km et plus'],['PoE / PoE+ / PoE++','15,4 W / 30 W / 60–90 W'],['EEE','Toujours désactivé en AV']],
m3:[['Multicast AV','239.x.x.x'],['Dante / AES67','239.255.x.x / 239.69.x.x'],['PTP / mDNS','224.0.1.129 / 224.0.0.251'],['Querier','Un seul par VLAN, sur le cœur'],['DSCP Dante','PTP 56 (CS7) · audio 46 (EF)'],['File','Priorité stricte, trust DSCP']],
m4:[['PTP','IEEE 1588, ports UDP 319/320'],['BMCA','Priority1 plus petit = prioritaire'],['Domaine AES67','0'],['Domaine ST 2059','127'],['AVB / Milan','gPTP 802.1AS'],['Dante','Preferred Leader sur l’appareil stable']],
m5:[['Canal Dante 48k/24','~1,5 Mb/s'],['64 canaux 48 kHz','~100 Mb/s'],['Latence Dante','0,25 · 0,5 · 1 · 2 · 5 ms'],['Flux unicast','4 canaux par flux'],['Primaire / secondaire','Deux réseaux jamais reliés'],['Milan','2 ms garantis, switchs certifiés']],
m6:[['ST 2110-20 1080p60','~2,6 Gb/s'],['JPEG XS','~150–300 Mb/s'],['NDI plein débit','~125–150 Mb/s'],['NDI HX','~10–50 Mb/s'],['Par lien 1G','5 à 6 NDI plein débit max'],['ST 2022-7','Double chemin rouge / bleu']],
m7:[['RTMP(S)','Vers YouTube, Facebook'],['SRT','Contribution entre sites'],['Latence SRT','≥ 4 × RTT'],['1080p30','4,5–6 Mb/s vidéo'],['Montant','1,5 à 2 × le débit du flux'],['Audio','48 kHz partout']],
m8:[['VISCA over IP','UDP 52381'],['sACN','UDP 5568, multicast'],['Art-Net','UDP 6454'],['NMOS IS-04','Découverte'],['NMOS IS-05','Connexion'],['LLDP','Qui est branché où']],
m9:[['Charge max d’un lien','70 %'],['VLAN type','10 audio · 20 vidéo · 30 contrôle · 40 stream · 99 admin'],['Adresses /24','.1 passerelle · .2–.19 switchs · .20–.99 fixes'],['Redondance AV','Dante primaire/secondaire, ST 2022-7'],['LACP','2 câbles = 1 lien plus rapide et secouru'],['PortFast','Sur les ports d’appareils']],
m10:[['Entrer en config','enable · configure terminal'],['Port appareil','switchport mode access · switchport access vlan 10'],['Trunk','switchport trunk allowed vlan 10,20,30,99'],['IGMP','ip igmp snooping · ip igmp snooping querier'],['QoS','mls qos · mls qos trust dscp'],['Sauver','write memory']],
m11:[['Méthode','Couche 1 → 7, une chose à la fois'],['Coupure après 3–5 min','Querier absent'],['Clics','Horloge, EEE, latence trop basse'],['Débit réel','iperf3 -s / iperf3 -c'],['Wireshark','igmp · ptp · mdns'],['Avant chaque événement','Check-list de 7 points']],
m12:[['Séparer','AV isolé du bureau et du public'],['Accès','SSH/HTTPS, jamais Telnet/HTTP'],['Distant','VPN uniquement'],['Ports','Désactiver ceux qui ne servent pas'],['Dante','Domain Manager, Device Lock'],['NDI','Access Manager']]
};
const PRATIQUE={
m1:{tp:['TP 1 · Adresser 4 appareils en /24 et les pinger','TP 2 · Créer 2 VLAN et prouver l’isolation'],lab:'Missions 1 à 3 du simulateur'},
m2:{tp:['TP 3 · Sertir et tester un câble, lire les erreurs d’un port'],lab:null},
m3:{tp:['TP 4 · Observer l’inondation multicast puis la corriger','TP 5 · Supprimer le querier et observer la coupure'],lab:'Mission 5 du simulateur'},
m4:{tp:['TP 6 · Élire un leader PTP, provoquer une bascule'],lab:null},
m5:{tp:['TP 7 · Router 32 canaux Dante et enregistrer','TP 8 · Échanger un flux AES67'],lab:null},
m6:{tp:['TP 9 · Diffuser une source NDI et mesurer son débit'],lab:null},
m7:{tp:['TP 10 · Envoyer un flux SRT à 4 × RTT'],lab:null},
m8:{tp:[],lab:null},
m9:{tp:['Exercice · Dessiner le réseau de votre lieu : VLAN, plan IP, charge du lien le plus chargé'],lab:null},
m10:{tp:['TP 11 · Configurer un switch complet'],lab:'Missions 1 à 6 du simulateur'},
m11:{tp:['TP 12 · Résoudre 5 pannes cachées en 60 minutes'],lab:'Mission 7 du simulateur · Salle de panne'},
m12:{tp:[],lab:null},
cas:{tp:['Refaire la conception pour votre propre lieu'],lab:null},
big:{tp:['Redessiner une conception de référence à votre échelle'],lab:null}
};
const QCM=[
{id:'q1',m:'m1',q:'Combien d’adresses utilisables contient un sous-réseau /24 ?',o:['254','256','255','128'],e:'256 adresses moins l’adresse réseau et le broadcast.'},
{id:'q2',m:'m1',q:'Sur quel type de port branche-t-on une console Dante ?',o:['Access','Trunk','Routé','Miroir'],e:'Un appareil se branche en access, dans un seul VLAN non tagué.'},
{id:'q3',m:'m1',q:'Sans serveur DHCP, un appareil Dante prend une adresse en…',o:['169.254.x.x','192.168.1.x','10.0.0.x','127.0.0.x'],e:'C’est la plage link-local, attribuée automatiquement.'},
{id:'q4',m:'m1',q:'Quel protocole Dante et NDI utilisent-ils pour se découvrir ?',o:['mDNS','SNMP','LLDP','DHCP'],e:'mDNS (224.0.0.251, port 5353), limité au sous-réseau.'},
{id:'q5',m:'m2',q:'Distance maximale d’un lien 10G en Cat6A ?',o:['100 m','55 m','300 m','10 km'],e:'Cat6A tient 10 Gb/s sur 100 m ; le Cat6 seulement ~55 m.'},
{id:'q6',m:'m2',q:'Quelle norme PoE fournit 60 W au switch ?',o:['802.3bt Type 3','802.3at','802.3af','802.3bt Type 4'],e:'af 15,4 W · at 30 W · bt Type 3 60 W · bt Type 4 90 W.'},
{id:'q7',m:'m2',q:'Quelle fonction du switch provoque des coupures Dante ?',o:['EEE (802.3az)','IGMP snooping','LLDP','QoS'],e:'L’économie d’énergie met les ports en veille entre les paquets.'},
{id:'q8',m:'m2',q:'Pour relier deux bâtiments à 2 km en 10G, on choisit…',o:['Fibre monomode OS2','Fibre multimode OM3','Cuivre Cat6A','Cuivre Cat8'],e:'Seule la monomode dépasse quelques centaines de mètres.'},
{id:'q9',m:'m3',q:'Sans IGMP snooping, un flux multicast est envoyé…',o:['Sur tous les ports du VLAN','Uniquement aux abonnés','Au routeur seulement','Nulle part'],e:'Le switch le traite comme du broadcast.'},
{id:'q10',m:'m3',q:'Snooping actif mais aucun querier : que se passe-t-il ?',o:['Les abonnements expirent et les flux s’arrêtent au bout de quelques minutes','Rien du tout','Le switch redémarre','L’horloge PTP s’arrête'],e:'Sans query, personne ne renouvelle les abonnements.'},
{id:'q11',m:'m3',q:'Combien de queriers par VLAN ?',o:['Un seul','Un par switch','Deux obligatoirement','Aucun'],e:'Un seul, idéalement sur le switch cœur.'},
{id:'q12',m:'m3',q:'Quel DSCP Dante utilise-t-il pour l’audio ?',o:['46 (EF)','56 (CS7)','34 (AF41)','0 (BE)'],e:'56 pour le PTP, 46 pour l’audio.'},
{id:'q13',m:'m3',q:'Quel mode de file d’attente choisir pour l’AV ?',o:['Priorité stricte','Round robin pondéré','Une seule file FIFO','Aléatoire'],e:'Le temps réel doit toujours passer en premier.'},
{id:'q14',m:'m4',q:'Domaine PTP par défaut de SMPTE ST 2059-2 ?',o:['127','0','1','24'],e:'AES67 utilise 0, ST 2059-2 utilise 127.'},
{id:'q15',m:'m4',q:'Pour imposer un grandmaster, on baisse sa valeur…',o:['Priority1','de domaine','DSCP','de VLAN'],e:'Le BMCA choisit la plus petite Priority1.'},
{id:'q16',m:'m4',q:'Un switch qui devient maître PTP pour l’aval est une…',o:['Boundary clock','Transparent clock','Querier','Passerelle'],e:'La transparent clock se contente de corriger le temps de transit.'},
{id:'q17',m:'m5',q:'Débit d’un canal Dante 48 kHz / 24 bits avec en-têtes ?',o:['~1,5 Mb/s','~150 kb/s','~15 Mb/s','~48 Mb/s'],e:'48 000 × 24 = 1,15 Mb/s, plus les en-têtes.'},
{id:'q18',m:'m5',q:'Peut-on relier les réseaux Dante primaire et secondaire ?',o:['Non, jamais','Oui par un trunk','Oui dans le même VLAN','Oui en fibre'],e:'Ils doivent rester physiquement séparés.'},
{id:'q19',m:'m5',q:'Plage multicast des flux AES67 créés par Dante ?',o:['239.69.x.x','239.255.x.x','224.0.1.129','169.254.x.x'],e:'239.255.x.x est le multicast Dante natif.'},
{id:'q20',m:'m5',q:'Latence Dante conseillée jusqu’à ~10 sauts gigabit ?',o:['1 ms','0,25 ms','5 ms','10 ms'],e:'0,25 ms sur un seul switch, 1 ms jusqu’à ~10 sauts.'},
{id:'q21',m:'m6',q:'Débit d’un flux ST 2110-20 1080p60 4:2:2 10 bits ?',o:['~2,6 Gb/s','~150 Mb/s','~10 Gb/s','~1 Gb/s'],e:'1920 × 1080 × 20 × 60 = 2,49 Gb/s + en-têtes.'},
{id:'q22',m:'m6',q:'Débit d’un flux NDI plein débit 1080p60 ?',o:['~125–150 Mb/s','~10 Mb/s','~1 Gb/s','~2,6 Gb/s'],e:'NDI HX descend à 10–50 Mb/s.'},
{id:'q23',m:'m6',q:'Pour voir des sources NDI dans d’autres sous-réseaux ?',o:['NDI Discovery Server','Un querier IGMP','Un grandmaster PTP','Un flux SRT'],e:'mDNS ne traverse pas les VLAN.'},
{id:'q24',m:'m6',q:'Norme de redondance à double chemin en ST 2110 ?',o:['ST 2022-7','ST 2059-2','ST 2110-40','802.1AS'],e:'Chaque paquet voyage sur les réseaux rouge et bleu.'},
{id:'q25',m:'m7',q:'Latence SRT minimale pour un RTT de 40 ms ?',o:['160 ms','40 ms','80 ms','1 s'],e:'Au moins 4 × le RTT.'},
{id:'q26',m:'m7',q:'Protocole le plus courant pour envoyer vers YouTube ou Facebook ?',o:['RTMP(S)','NDI','AES67','sACN'],e:'RTMP ou RTMPS, en TCP.'},
{id:'q27',m:'m7',q:'Montant Internet conseillé pour un flux à 6 Mb/s ?',o:['9 à 12 Mb/s','6 Mb/s','3 Mb/s','100 Mb/s obligatoires'],e:'1,5 à 2 fois le débit du flux.'},
{id:'q28',m:'m8',q:'Spécification NMOS de connexion émetteur-récepteur ?',o:['IS-05','IS-04','IS-07','BCP-003'],e:'IS-04 découvre, IS-05 connecte.'},
{id:'q29',m:'m8',q:'Port UDP de VISCA over IP ?',o:['52381','5568','6454','5353'],e:'5568 sACN, 6454 Art-Net, 5353 mDNS.'},
{id:'q30',m:'m9',q:'Quelle charge maximale viser sur un lien ?',o:['70 %','100 %','90 %','30 %'],e:'Au-delà, les pics saturent le lien.'},
{id:'q31',m:'m9',q:'64 canaux Dante + 4 NDI plein débit ≈ 705 Mb/s sur un lien 1G. Que faire ?',o:['Passer en 10G ou mettre des caméras en NDI HX','Rien, ça passe','Baisser la latence Dante','Désactiver la QoS'],e:'705 Mb/s = 70 % : aucune marge.'},
{id:'q32',m:'m10',q:'Quelle commande montre qui est querier ?',o:['show ip igmp snooping querier','show vlan brief','show mls qos','show lldp neighbors'],e:'Elle liste le querier de chaque VLAN.'},
{id:'q33',m:'m10',q:'Une interface vlan 99 nouvellement créée est…',o:['En shutdown : il faut taper no shutdown','Active immédiatement','Supprimée au redémarrage','Un trunk'],e:'Sur Cisco, une SVI naît éteinte.'},
{id:'q34',m:'m11',q:'Le son se coupe toutes les 3 à 5 minutes. Cause la plus probable ?',o:['Pas de querier IGMP','Câble défectueux','Mauvais DSCP','Latence trop haute'],e:'Les abonnements expirent faute de query.'},
{id:'q35',m:'m11',q:'Par quelle couche commence un dépannage ?',o:['Couche 1, physique','Couche 7, application','Couche 3, réseau','Couche 4, transport'],e:'On part du câble.'},
{id:'q36',m:'m12',q:'Accès distant recommandé à un réseau AV ?',o:['VPN (WireGuard, Tailscale)','Redirection de port vers l’interface web','Telnet','Le Wi-Fi public'],e:'Jamais d’interface d’administration exposée.'}
];
const CARTES=[
['m1','Adresses utilisables dans un /24','254'],['m1','Plage link-local','169.254.0.0/16'],['m1','Port access ou trunk pour une caméra ?','Access'],
['m2','Distance d’un Cat6A en 10G','100 m'],['m2','PoE++ Type 3','60 W'],['m2','Fibre jaune','Monomode OS2, 10 km et plus'],
['m3','Querier : combien par VLAN ?','Un seul'],['m3','DSCP du PTP Dante','56 (CS7)'],['m3','DSCP de l’audio Dante','46 (EF)'],['m3','Multicast Dante natif','239.255.x.x'],
['m4','Domaine PTP ST 2059-2','127'],['m4','Domaine PTP AES67','0'],['m4','Ports UDP du PTP','319 et 320'],
['m5','Canaux par flux unicast Dante','4'],['m5','Débit d’un canal Dante 48 kHz','~1,5 Mb/s'],['m5','Latence garantie Milan','2 ms'],
['m6','ST 2110-20 1080p60','~2,6 Gb/s'],['m6','NDI plein débit 1080p60','~125–150 Mb/s'],['m6','Redondance rouge/bleu ST 2110','ST 2022-7'],
['m7','Latence SRT minimale','4 × RTT'],['m7','Montant pour un flux de 6 Mb/s','9 à 12 Mb/s'],
['m8','Port sACN','UDP 5568'],['m8','NMOS de connexion','IS-05'],
['m9','Charge max d’un lien','70 %'],['m9','Adresse .1 d’un /24','La passerelle'],
['m10','Sauvegarder la configuration','write memory'],['m10','Autoriser des VLAN sur un trunk','switchport trunk allowed vlan 10,20,30'],['m10','Faire confiance au marquage','mls qos trust dscp'],
['m11','Son coupé après 3–5 min','Querier absent'],['m11','Mesurer le débit réel','iperf3'],
['m12','Accès distant sûr','VPN'],['m12','Protocole d’administration à bannir','Telnet (et HTTP)']
].map((c,i)=>({id:'c'+(i+1),m:c[0],f:c[1],b:c[2]}));
const PANNES=[
{id:'p1',m:'m3',titre:'Le son se coupe toutes les quatre minutes',symptome:'Depuis l’ajout du nouveau switch de régie, le son Dante de la stagebox se coupe environ toutes les quatre minutes, puis revient après un « re-routage » dans Dante Controller.',
 cmds:[['show ip igmp snooping','IGMP snooping              : Enabled\nQuerier                    : Disabled\n\nVlan 10:\n--------\nIGMP snooping              : Enabled'],
       ['show ip igmp snooping querier','Vlan      IP Address      IGMP Version   Port\n-------------------------------------------------'],
       ['show interfaces status','Port      Name       Status       Vlan  Duplex  Speed\nGi1/0/1   CONSOLE    connected    10    a-full  a-1000\nTe1/1/1   COEUR      connected    trunk a-full  a-10G'],
       ['show mls qos','QoS is enabled']],
 causes:['Aucun querier IGMP dans le VLAN 10','Un câble défectueux','La QoS est désactivée','Le port de la console est en half duplex'],
 fix:'configure terminal\nip igmp snooping querier\nend\nwrite memory',
 explique:'Le snooping est actif mais la liste des queriers est vide : personne ne renouvelle les abonnements, qui expirent au bout de quelques minutes.'},
{id:'p2',m:'m11',titre:'La stagebox a disparu de Dante Controller',symptome:'Ce matin, la stagebox n’apparaît plus du tout dans Dante Controller. Sa LED réseau est éteinte. Personne ne se souvient d’avoir touché au switch.',
 cmds:[['show interfaces status','Port      Name       Status       Vlan\nGi1/0/1   STAGEBOX   disabled     10\nGi1/0/2   AMPLI      connected    10'],
       ['show lldp neighbors','Device ID     Local Intf   Capability\nAMPLI         Gi1/0/2      O\nSW-REGIE      Te1/1/1      B'],
       ['show running-config interface gi1/0/1','interface GigabitEthernet1/0/1\n description STAGEBOX\n switchport access vlan 10\n switchport mode access\n shutdown']],
 causes:['Le port de la stagebox est en shutdown','La stagebox est dans le mauvais VLAN','Le querier est absent','Le trunk ne transporte pas le VLAN 10'],
 fix:'configure terminal\ninterface gi1/0/1\n no shutdown\nend\nwrite memory',
 explique:'Le port est « disabled » et la configuration contient shutdown : il a été désactivé à la main.'},
{id:'p3',m:'m2',titre:'Des clics sur les voies de la console',symptome:'Des petits clics réguliers apparaissent sur toutes les voies qui viennent du PC multipiste. L’horloge Dante est stable, aucun appareil n’a changé de leader.',
 cmds:[['show running-config interface gi1/0/2','interface GigabitEthernet1/0/2\n description PC-MULTI\n switchport access vlan 10\n switchport mode access\n mls qos trust dscp\n spanning-tree portfast'],
       ['show interfaces counters errors','Port       Align-Err  FCS-Err  Rcv-Err\nGi1/0/2    0          0        0'],
       ['show power efficient-ethernet','Interface  EEE     Status\nGi1/0/1    Disabled\nGi1/0/2    Enabled  active']],
 causes:['EEE est actif sur le port du PC multipiste','Le câble du PC est abîmé','Le PC est dans le mauvais VLAN','La QoS n’est pas activée'],
 fix:'configure terminal\ninterface gi1/0/2\n no power efficient-ethernet\nend\nwrite memory',
 explique:'Aucune erreur de câble, mais EEE est actif sur Gi1/0/2 : le port se met en veille entre les paquets.'},
{id:'p4',m:'m10',titre:'Plus de son entre la régie et la scène',symptome:'La lumière et les caméras fonctionnent, mais aucun canal Dante ne passe plus entre la console (régie) et la stagebox (scène).',
 cmds:[['show interfaces trunk','Port      Mode  Status     Native vlan\nTe1/1/1   on    trunking   1\n\nPort      Vlans allowed on trunk\nTe1/1/1   20,30,99'],
       ['show vlan brief','VLAN Name       Ports\n10   AUDIO      Gi1/0/1, Gi1/0/2\n20   VIDEO      Gi1/0/5, Gi1/0/6, Gi1/0/7\n30   CONTROLE   Gi1/0/9'],
       ['ping 192.168.99.1','!!!!!\nSuccess rate is 100 percent (5/5)']],
 causes:['Le VLAN 10 n’est plus autorisé sur le trunk','Le port de la console est éteint','Le switch cœur est en panne','Le PTP a changé de domaine'],
 fix:'configure terminal\ninterface te1/1/1\n switchport trunk allowed vlan add 10\nend\nwrite memory',
 explique:'Le trunk ne transporte que 20, 30 et 99 : le VLAN 10 (audio) a été retiré.'},
{id:'p5',m:'m6',titre:'La caméra PTZ 2 a disparu de vMix',symptome:'La PTZ 2 n’apparaît plus dans la liste des sources NDI de vMix. La PTZ 1, branchée sur le même switch, fonctionne.',
 cmds:[['show vlan brief','VLAN Name       Ports\n20   VIDEO      Gi1/0/5, Gi1/0/7\n30   CONTROLE   Gi1/0/6, Gi1/0/9'],
       ['show interfaces status','Port      Name   Status     Vlan\nGi1/0/5   CAM1   connected  20\nGi1/0/6   CAM2   connected  30'],
       ['show lldp neighbors','Device ID   Local Intf\nCAM1        Gi1/0/5\nCAM2        Gi1/0/6']],
 causes:['Le port de la PTZ 2 est dans le VLAN 30','La PTZ 2 est débranchée','NDI Discovery Server est arrêté','Le querier du VLAN 20 est absent'],
 fix:'configure terminal\ninterface gi1/0/6\n switchport access vlan 20\nend\nwrite memory',
 explique:'La caméra est bien branchée (LLDP la voit) mais son port est dans le VLAN 30 : elle n’est plus dans le même réseau que vMix.'},
{id:'p6',m:'m3',titre:'Tout ralentit dès que les caméras démarrent',symptome:'Quand les 4 caméras NDI démarrent, les tablettes de contrôle et le Companion deviennent très lents, et une interface Dante 100 Mb/s perd le son.',
 cmds:[['show ip igmp snooping','IGMP snooping              : Disabled'],
       ['show interfaces gi1/0/20 counters','Port      OutOctets     OutDiscards\nGi1/0/20  4120938811    18234'],
       ['show interfaces status','Port      Name        Status     Vlan  Speed\nGi1/0/20  DANTE-100M  connected  20    a-100']],
 causes:['L’IGMP snooping est désactivé : le multicast NDI inonde tous les ports','Le câble de Gi1/0/20 est abîmé','Les caméras sont en NDI HX','La QoS priorise trop la vidéo'],
 fix:'configure terminal\nip igmp snooping\nip igmp snooping querier\nend\nwrite memory',
 explique:'Snooping désactivé : chaque flux multicast sort sur tous les ports, et le port 100 Mb/s rejette des milliers de paquets.'},
{id:'p7',m:'m7',titre:'Le direct YouTube décroche toutes les dix minutes',symptome:'Le direct du dimanche se coupe plusieurs fois. L’encodeur est réglé en 1080p30 à 6 Mb/s. Le Wi-Fi invités est très utilisé pendant le culte.',
 cmds:[['Test de débit filaire depuis la régie','Descendant : 95 Mb/s\nMontant    : 7,2 Mb/s'],
       ['Réglages de l’encodeur','Résolution : 1080p30\nDébit vidéo : 6 000 kb/s\nAudio : 160 kb/s AAC 48 kHz'],
       ['Configuration du Wi-Fi invités','VLAN : 40 (le même que l’encodeur)\nLimite de débit : aucune']],
 causes:['Montant trop juste et Wi-Fi invités non isolé ni limité','La clé de stream est erronée','L’audio est en 48 kHz','L’encodeur est en 1080p30'],
 fix:'Passer le Wi-Fi invités dans le VLAN 50, le limiter à 20 Mb/s\nBaisser l’encodeur à 4 500 kb/s ou augmenter le montant (≥ 12 Mb/s)',
 explique:'6,2 Mb/s sur 7,2 Mb/s de montant, partagés avec le Wi-Fi public : la moindre pointe fait décrocher le direct.'}
];
