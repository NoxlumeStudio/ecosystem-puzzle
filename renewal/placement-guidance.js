// Always-visible placement explanations. No stage data or simulation is changed.
const PLACEMENT_INTROS=Object.freeze({
 'renewal-2':{type:'bee',text:'ハチは花の蜜を使い、種子をまくよ。花の近くへ置き、植物のない散布先も残してみよう。'},
 'renewal-3':{type:'mushroom',text:'ナメクジはキノコへ進むよ。花に近づいたあと離れる流れを、キノコの位置で作ってみよう。'},
 'renewal-4':{type:'water',text:'カエルは隣に獲物がいないと水辺へ移るよ。池の位置と、移動後に届く餌を用意してみよう。'},
 'renewal-5':{type:'grass',text:'バッタは2マス先の草へ跳び、水辺を越えられるよ。向こう岸の草と、岸の種子を試してみよう。'},
 'renewal-6':{type:'ladybird',text:'アブラムシもイモムシも草を食べるよ。テントウムシをアブラムシの近くへ置き、草を守ってみよう。'},
 'renewal-7':{type:'slug',text:'毒キノコを食べたナメクジはその周期に死ぬよ。花へ近づいてからいなくなる順番を試そう。'},
 'renewal-8':{type:'earthworm',text:'ミミズは死亡痕跡を使い、同じマスの種子の成長を助けるよ。痕跡の上や近くに置いてみよう。'},
 'renewal-9':{type:'bird',text:'クモは隣のハチを食べ、小鳥はクモを食べるよ。小鳥が先に動く位置を考え、ハチを守ってみよう。'},
 'renewal-10':{type:'mushroom',text:'ナメクジは通常キノコを2回食べると出産するよ。食事の道と、子が生まれる空きマスを作ろう。'},
 'renewal-11':{type:'aphid',text:'アブラムシもナメクジも出産できるよ。先に生まれた子が次の出生先を変える様子を試そう。'},
 'renewal-12':{type:'frog',text:'カエルはナメクジを食べるよ。食事を成立させながら、親子のどちらを最後まで残すか考えてみよう。'},
 'renewal-13':{type:'ladybird',text:'離れたアブラムシもテントウムシが追うよ。クモの除去と、イモムシの食事場所も分けてみよう。'},
 'renewal-14':{type:'mushroom',text:'三輪とも、ナメクジが近づいたあと離れる変化が必要。キノコで食事の道を作り、岩で出生先も変えてみよう。'},
 'renewal-15':{type:'frog',text:'五周期で食事・誕生・開花をつなごう。ナメクジの食事と、カエルが食べる順番を分けて考えてみよう。'}
});
function speciesPlacementTip(type,st){
 const tips={
 grasshopper:'バッタは草を食べるよ。近くに草を置き、2マス先への跳躍も試してみよう。',
 caterpillar:'イモムシは草へ進んで食べるよ。次の食事に届くよう、草を離しすぎずに置いてみよう。',
 bird:'小鳥は動かず、隣の虫や足元の種子を食べるよ。餌が近づく場所で待たせてみよう。',
 aphid:'アブラムシも草を食べるよ。イモムシと草を奪い合う位置や、テントウムシとの距離を試そう。',
 ladybird:'テントウムシはアブラムシを追って食べるよ。草を食べられる前に届く位置を試してみよう。',
 slug:'ナメクジはキノコを食べるよ。花へ近づいたあと離れるよう、キノコの位置を考えてみよう。',
 frog:'カエルは隣のナメクジなどを食べるよ。獲物が隣にいないと陸から水辺へ移るので、池と餌を考えよう。',
 bee:'ハチは開花した花の蜜を使うよ。花の近くへ置き、隣に植物のない土を残して種子散布を試そう。',
 earthworm:'ミミズは前周期までの死亡痕跡を使うよ。同じマスに種子があると成長も助けるので、痕跡の近くへ置こう。',
 spider:'クモは動かず、隣のハチなどを食べるよ。残したい生物との距離や、小鳥が除く順番を考えよう。',
 grass:'草はバッタ・イモムシ・アブラムシの餌だよ。食べる順番を考え、次の食事になる草も用意してみよう。',
 seed:'種子は育つと草になり、小鳥の餌にもなるよ。食べさせる種子と、育てたい種子の場所を分けてみよう。',
 mushroom:'通常キノコはナメクジの餌だよ。食べに進む道を作り、花との距離がどう変わるか試してみよう。',
 poisonMushroom:'毒キノコを食べたナメクジは同じ周期に死ぬよ。食べる前後で花の周囲がどう変わるか考えよう。',
 water:'水辺に入れるのはカエルだけ。岸の種子は早く育ち、バッタは水辺を越せるので、岸と餌の位置を試そう。',
 rock:'岩は通路や出生先を塞ぐよ。餌への道や、生まれる子の居場所を変えたいときに置いてみよう。'
 };
 if(reproductionRules(st).enabled&&type==='aphid')return 'アブラムシは草を2回食べると出産するよ。続けて食べられる草と、子のための空いた土を用意しよう。';
 if(reproductionRules(st).enabled&&type==='slug')return 'ナメクジは通常キノコを2回食べると出産するよ。食事の道と出生先を用意し、花の周囲に親子が残るか考えよう。';
 return tips[type]||'';
}
function placementGuidePlan(st,selected,intro,introduced=[]){
 if(st.id==='renewal-1')return null;
 const fresh=[...newlyPlaceableTypes(st),...newlyFixedTypes(st).map(type=>'fixed:'+type)].filter(type=>!introduced.includes(type));
 if(intro){if(!fresh.length)return null;const preferred=PLACEMENT_INTROS[st.id]?.type;return newSpeciesNotice(st,fresh.includes(preferred)?preferred:fresh[0]);}
 if(fresh.includes(selected))return {...newSpeciesNotice(st,selected),focus:null};
 return {focus:null,type:selected,text:speciesPlacementTip(selected,st)};
}
// Announce only species newly available for placement, never fixed-only entities.
function newlyPlaceableTypes(st,stages=STAGES){const index=stages.findIndex(s=>s.id===st.id),earlier=new Set(stages.slice(0,index).flatMap(s=>Object.keys(s.pool||{})));return Object.keys(st.pool||{}).filter(t=>!earlier.has(t));}
function newlyFixedTypes(st,stages=STAGES){const index=stages.findIndex(s=>s.id===st.id),earlier=new Set(stages.slice(0,index).flatMap(s=>[...Object.keys(s.pool||{}),...s.fixed.map(e=>e.type)]));return [...new Set(st.fixed.map(e=>e.type))].filter(t=>!earlier.has(t)&&!st.pool[t]);}
function newSpeciesNotice(st,key){const fixed=key.startsWith('fixed:'),type=fixed?key.slice(6):key,target=fixed?st.fixed.find(e=>e.type===type):null;return {focus:fixed?'board':'inventory',type,target:target?{r:target.r,c:target.c}:null,introducedType:key,text:SPECIES[type].name+(fixed?'が登場！':'が置けるようになった！')+(fixed?PLACEMENT_INTROS[st.id]?.text||SPECIES[type].rule:speciesPlacementTip(type,st))};}
