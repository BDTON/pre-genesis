import {artProfile} from './art-direction.js';

// Original tabletop interpretations. Silhouettes and attributes are deliberately
// legible at map scale; these share a sculptural vocabulary, not borrowed models.
export function mythicChampion(b,id,y){
 const p=artProfile(id),gold='#c9ad69',ivory='#e4dcc4',dark='#444c51';
 const add=(g,c,x,dy,z,sx,sy,sz,rx=0,ry=0,rz=0)=>b.add(g,c,x,y+dy,z,sx,sy,sz,rx,ry,rz);
 // Shallow armor relief stays inside the original miniature's silhouette.
 // Boxes and eight-sided cylinders share the renderer's existing instance batches.
 add('box',gold,0,.102,-.083,.145,.147,.016);
 add('box',p.color,0,.11,-.094,.112,.108,.012);
 add('box',ivory,0,.115,-.103,.025,.077,.008);
 add('cylinder',gold,0,.181,0,.068,.025,.065);
 add('cylinder',dark,0,-.022,0,.117,.046,.101);
 add('box',gold,0,-.02,-.103,.051,.04,.017);
 add('box',p.color,0,-.02,-.114,.023,.022,.009);
 for(const side of [-1,1]){
   add('cone4',gold,side*.109,.14,0,.071,.061,.067,0,Math.PI/4);
   add('box',p.color,side*.104,.101,-.059,.052,.051,.014);
   add('cylinder',ivory,side*.143,.055,-.016,.024,.105,.025,0,0,side*.22);
   add('cylinder',gold,side*.153,.012,-.016,.029,.04,.03,0,0,side*.22);
   add('box',gold,side*.049,-.093,-.079,.021,.082,.012,0,0,side*.12);
 }
 const shaft=()=>{
   add('cylinder',gold,.19,.15,0,.017,.65,.017);
   add('cylinder',dark,.19,.057,0,.023,.15,.023);
   for(const dy of [-.025,.14])add('cylinder',ivory,.19,dy,0,.027,.026,.027);
 };
 const head=p.head;
 if(['fourarms','fourfaces'].includes(head)){
   for(const side of [-1,1])for(const tier of [0,1]){add('cylinder',p.color,side*.14,.12-tier*.12,0,.027,.25,.027,0,0,side*(1.1+tier*.38));add('sphere',ivory,side*.255,.18-tier*.17,0,.035,.04,.035);}
   if(head==='fourfaces')for(const side of [-1,1])add('sphere','#bb9372',side*.067,.25,.025,.065,.075,.065);
 }
 if(head==='beard'||head==='eyepatch'){add('sphere',dark,0,.30,.027,.09,.07,.085);add('cone','#aea69a',0,.18,-.067,.07,.16,.045,0,0,Math.PI);}
 if(head==='eyepatch')add('box',dark,.032,.26,-.075,.042,.025,.014);
 if(['crown','fourarms','fourfaces','lotus'].includes(head)){
   add('cylinder',gold,0,.33,0,.084,.09,.084);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;add('cone',gold,Math.cos(a)*.07,.41,Math.sin(a)*.07,.025,.14,.025);}
 }
 if(['halo','sun','crescent'].includes(head)){add('torus',gold,0,.34,.09,.15,.15,.02);if(head==='sun')for(let i=0;i<10;i++){const a=i*Math.PI/5;add('cone',gold,Math.sin(a)*.18,.34+Math.cos(a)*.18,.09,.02,.095,.02,0,0,-a);}}
 if(['falcon','ibis','fox'].includes(head)){add('sphere',head==='fox'?ivory:dark,0,.26,0,.082,.11,.08);add('cone',gold,0,.24,-.11,.032,head==='ibis'?.23:.13,.025,-Math.PI/2);if(head==='fox')for(const side of [-1,1])add('cone',ivory,side*.06,.37,0,.04,.14,.03);}
 if(['feathers','wings','atef','horns'].includes(head))for(const side of [-1,1]){
   const count=head==='feathers'?5:head==='wings'?3:1;
   for(let i=0;i<count;i++)add('leaf',i%2?gold:p.color,side*(.065+i*.031),.35-i*.016,.02,.035,.21+i*.012,.035,0,0,-side*(.25+i*.21));
 }
 if(head==='helmet'){add('sphere',gold,0,.30,0,.09,.08,.085);add('box',p.color,0,.40,0,.035,.12,.16);}
 if(head==='veil'||head==='hood'){add('sphere',head==='veil'?ivory:p.color,0,.28,.025,.104,.13,.093);add('sphere','#c7a984',0,.25,-.048,.068,.082,.038);add('cone',p.color,0,.10,.08,.19,.34,.095);}
 if(head==='knot'){add('sphere',dark,0,.30,.024,.088,.07,.086);add('sphere',dark,0,.39,0,.048,.05,.048);}
 if(head==='goggles')for(const side of [-1,1])add('torus',gold,side*.037,.26,-.075,.039,.039,.012);
 if(head==='shell')for(let i=0;i<5;i++)add('leaf',ivory,(i-2)*.036,.34,.01,.035,.14,.025,0,0,(i-2)*.22);
 if(head==='wreath')for(let i=0;i<9;i++){const a=i*Math.PI*2/9;add('leaf','#839b57',Math.sin(a)*.085,.31,Math.cos(a)*.08,.029,.04,.025,0,0,a);}
 if(head==='wheels')for(const side of [-1,1])b.add('torus',gold,side*.13,.10,0,.085,.085,.025,0,Math.PI/2);
 const attribute=p.attribute;
 if(['spear','staff','trident','axe','hammer','crook','ankh','water','wave','sun','star'].includes(attribute))shaft();
 if(attribute==='spear')add('cone',ivory,.19,.54,0,.039,.18,.035);
 else if(attribute==='staff'){add('torus',gold,.19,.49,0,.085,.105,.024);add('cone',p.color,.19,.50,0,.046,.13,.035);}
 else if(attribute==='trident'){add('box',gold,.19,.43,0,.22,.025,.027);for(const x of [.1,.19,.28])add('cone',gold,x,.52,0,.025,.20,.025);}
 else if(attribute==='axe'){for(const side of [-1,1])add('leaf',ivory,.19+side*.068,.43,0,.09,.11,.025,0,0,side*.4);}
 else if(attribute==='hammer'){add('box',ivory,.19,.46,0,.21,.13,.10);add('box',gold,.19,.46,-.058,.047,.14,.014);for(const side of [-1,1])add('box',dark,.19+side*.105,.46,0,.021,.14,.11);}
 else if(['blade','sword'].includes(attribute)){add('box',ivory,.19,.29,-.03,.039,.58,.017);add('box',gold,.19,.02,-.03,.14,.025,.029);add('cylinder',dark,.19,-.044,-.03,.021,.11,.021);add('cone4',gold,.19,-.111,-.03,.034,.04,.027,0,Math.PI/4);add('box',gold,.19,.26,-.042,.010,.42,.007);}
 else if(attribute==='bolt'){for(let i=0;i<3;i++)add('box',gold,.18+(i%2)*.04,.39-i*.13,-.03,.04,.20,.027,0,0,i%2?-.6:.6);}
 else if(['bow','hook','crook'].includes(attribute)){add('torus',gold,.20,.17,0,.11,.23,.035);add('box',ivory,.20,.17,0,.009,.43,.01);}
 else if(['book','tablets','scroll'].includes(attribute)){for(const side of [-1,1]){add('box',attribute==='tablets'?'#aaa38d':ivory,side*.10,.06,-.13,.17,.23,.027,0,side*.15);for(let i=0;i<3;i++)add('box',gold,side*.10,.12-i*.055,-.15,.10,.012,.008);}}
 else if(attribute==='trumpet'){add('cylinder',gold,.12,.21,-.17,.024,.33,.024,Math.PI/2);add('cone',gold,.12,.21,-.35,.10,.14,.10,Math.PI/2);}
 else if(['lotus','grain','fan','flame'].includes(attribute)){for(let i=0;i<5;i++)add('leaf',attribute==='flame'?'#c87943':attribute==='grain'?gold:ivory,.19+(i-2)*.035,.16+Math.abs(i-2)*.014,-.04,.038,.14,.03,0,0,-(i-2)*.35);}
 else if(['vase','cauldron'].includes(attribute)){add('sphere',p.color,.18,.08,-.10,.11,.12,.09);add('torus',gold,.18,.18,-.10,.07,.07,.019,Math.PI/2);}
 else if(attribute==='lute'){add('sphere',gold,.08,.04,-.14,.11,.13,.04);add('box',ivory,.13,.21,-.14,.037,.34,.023,0,0,-.3);}
 else if(attribute==='serpent'){for(let i=0;i<7;i++)add('sphere',p.color,.18+Math.sin(i*1.2)*.045,.01+i*.071,-.08,.044,.056,.038);add('cone',gold,.18,.49,-.14,.05,.12,.05,-Math.PI/2);}
 else if(['mirror','sun','star','ankh','necklace'].includes(attribute)){add('torus',gold,.19,.43,0,.09,.09,.022);add('disc',ivory,.19,.43,.015,.065,.018,.065,Math.PI/2);}
 else if(['water','wave'].includes(attribute)){for(let i=0;i<3;i++)add('torus','#91bbc5',.19,.43-i*.09,0,.08+i*.02,.055,.022);}
 if(id==='gabriel')for(const side of [-1,1])for(let i=0;i<4;i++)add('leaf',ivory,side*(.18+i*.04),.20-i*.025,.12,.055,.28,.035,0,0,-side*(.3+i*.18));
 if(['vishnu','shiva'].includes(id))add('sphere',id==='vishnu'?'#779bb1':'#b1bfc2',0,.25,-.017,.077,.09,.068);
}

export function mythicCapital(view,b,id){
 const p=artProfile(id),stone='#e4dec8',gold='#c3a064',roof=p.color;
 const east=['susanoo','inari','amaterasu','nezha','guanyin'].includes(id);
 const stepped=['quetzalcoatl','kukulkan','tlaloc','huitzilopochtli','itzamna','inti','viracocha','marduk','enki','inanna'].includes(id);
 const lotus=['vishnu','shiva','brahma','durga','lakshmi','saraswati'].includes(id);
 if(['zeus','poseidon','demeter','artemis','hermes'].includes(id)){view.elvenCity(b);return;}
 if(['osiris','isis','horus','thoth'].includes(id)){view.rohanCity(b);return;}
 if(['odin','freyja','freyr','skadi','perun'].includes(id)){view.mordorCity(b);return;}
 if(['gabriel'].includes(id)){view.gondorCity(b);return;}
 b.add('box','#b6bda6',0,.09,0,1.18,.15,1.03);
 b.add('box',stone,0,.165,0,1.10,.055,.95);
 b.add('box',gold,0,.192,0,1.02,.024,.88);
 for(let step=0;step<5;step++)b.add('box',stone,0,.04+step*.045,.63-step*.045,.35,.045,.16);
 // A beam between authored endpoints makes roof ribs without new geometry types.
 const rib=(a,z,width=.018,color=gold)=>{
   const dx=z[0]-a[0],dy=z[1]-a[1],dz=z[2]-a[2],length=Math.hypot(dx,dy,dz);
   b.add('box',color,(a[0]+z[0])/2,(a[1]+z[1])/2,(a[2]+z[2])/2,width,length,width,Math.atan2(dz,dy),0,-Math.atan2(dx,Math.hypot(dy,dz)));
 };
 let doorY=.30,doorZ=.295;
 if(stepped){
   for(let i=0;i<4;i++){
     const width=1.0-i*.19,depth=.9-i*.17,y=.19+i*.17;
     b.add('box',i%2?stone:'#c4c5ab',0,y,0,width,.17,depth);
     b.add('box',gold,0,y+.082,0,width+.025,.025,depth+.025);
   }
   b.add('box',roof,0,.91,0,.33,.22,.28);b.add('box',gold,0,1.05,0,.40,.05,.35);
   // One continuous ceremonial stair climbs to the summit sanctuary.
   for(let i=0;i<7;i++)b.add('box',stone,0,.31+i*.075,.435-i*.044,.19,.055,.10);
   for(const side of [-1,1]){
     rib([side*.13,.24,.48],[side*.13,.84,.15],.029);
     b.add('box',gold,side*.125,.91,.148,.032,.22,.025);
     b.add('box',roof,side*.39,.39,.32,.08,.23,.07);
   }
   doorY=.91;doorZ=.152;
 } else if(east){
   for(let i=0;i<3;i++){
     const size=.76-i*.18,y=.30+i*.28;
     b.add('box',stone,0,y,0,size,.23,size*.8);
     // Dark window recesses and pale timber frames give the pagoda floors depth.
     for(const side of [-1,1]){
       b.add('box','#415b62',side*size*.24,y,size*.405,size*.18,.095,.018);
       b.add('box',stone,side*size*.24,y,size*.417,.015,.103,.013);
       b.add('box',gold,side*size*.24,y-.054,size*.413,size*.23,.018,.025);
     }
     b.add('cone4',roof,0,y+.21,0,size*.86,.20,size*.7,0,Math.PI/4);
     const corners=[[.495,.495],[.608,-.608],[-.495,-.495],[-.608,.608]];
     for(let corner=0;corner<corners.length;corner++){
       const a=corners[corner],z=corners[(corner+1)%corners.length];
       rib([a[0]*size,y+.111,a[1]*size],[z[0]*size,y+.111,z[1]*size],.021);
       rib([0,y+.315,0],[a[0]*size,y+.115,a[1]*size],.017);
     }
     for(const side of [-1,1]){
       b.add('box',gold,side*size*.43,y,0,.026,.22,size*.81);
       b.add('cone',gold,side*size*.65,y+.20,0,.027,.11,.027);
     }
   }
   b.add('cylinder',gold,0,1.18,0,.022,.30,.022);
   for(const y of [1.11,1.20,1.29])b.add('cylinder',gold,0,y,0,.062-(y-1.11)*.12,.023,.062-(y-1.11)*.12);
   doorZ=.315;
 } else if(lotus){
   b.add('box',stone,0,.32,0,.64,.45,.55);
   for(const side of [-1,1])for(const z of [-.15,.12]){
     b.add('box','#c9c8ad',side*.329,.36,z,.045,.36,.10);
     b.add('box',gold,side*.35,.50,z,.056,.027,.12);
   }
   for(const side of [-1,1]){
     b.add('box',stone,side*.43,.37,0,.17,.60,.19);b.add('cone',gold,side*.43,.78,0,.12,.24,.12);
     b.add('box',gold,side*.43,.61,0,.205,.05,.23);
     b.add('box',roof,side*.43,.40,.101,.071,.27,.018);
     b.add('box',gold,side*.25,.39,.295,.041,.36,.041);
   }
   for(let i=0;i<5;i++){
     const radius=.33-i*.051,y=.62+i*.11;
     b.add('cylinder',i%2?stone:gold,0,y,0,radius,.12,radius);
     b.add('cylinder',gold,0,y+.053,0,radius+.018,.026,radius+.018);
   }
   for(const side of [-1,1])for(const front of [-1,1])rib([side*.224,.63,front*.224],[side*.07,1.1,front*.07],.022);
   b.add('box',gold,0,.575,.295,.64,.052,.073);
   b.add('cone',gold,0,1.22,0,.066,.23,.066);
   for(const side of [-1,1])b.add('arch',stone,side*.18,.345,.301,.13,.22,.24);
 } else {
   b.add('cylinder',stone,0,.34,0,.41,.49,.35);b.add('cone',roof,0,.75,0,.51,.44,.43);
   b.add('cylinder',gold,0,.555,0,.47,.039,.40);
   for(let i=0;i<7;i++){
     const a=i*Math.PI*2/7;
     rib([Math.sin(a)*.49,.537,Math.cos(a)*.414],[0,.976,0],.021);
   }
   for(const side of [-1,1]){
     b.add('cylinder',stone,side*.42,.35,.15,.12,.45,.12);b.add('cone',roof,side*.42,.65,.15,.16,.23,.16);
     b.add('cylinder',gold,side*.42,.535,.15,.14,.035,.14);
     b.add('box',gold,side*.24,.35,.285,.029,.31,.04);
     b.add('box','window',side*.42,.37,.272,.047,.076,.023);
   }
   b.add('sphere',gold,0,1.0,0,.05,.06,.05);
   doorZ=.354;
 }
 // Recessed entrance and projecting jambs remain on each building's own facade.
 b.add('box','#465151',0,doorY,doorZ,.12,.20,.021);
 for(const side of [-1,1])b.add('box',stone,side*.081,doorY,doorZ+.009,.032,.235,.045);
 b.add('box',gold,0,doorY+.123,doorZ+.009,.203,.038,.047);
 b.add('box',stone,0,doorY-.10,doorZ+.031,.19,.035,.095);
 if(!stepped)for(const side of [-1,1])b.add('box','window',side*.17,.37,east||lotus?doorZ+.001:.318,.047,.076,.023);
}
