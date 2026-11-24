// Display only. Dialogue, queues and persistence remain owned by the story controller.
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.EventStillPresentation=api;
})(globalThis,function(){
 const ASSETS=Object.freeze({
  'chapter.1.intro':'web/still_opening_lab.webp',
  'chapter.2.intro':'web/still_chapter2_frog.webp',
  'chapter.3.intro':'web/still_chapter3_poison.webp',
  'chapter.4.intro':'web/still_chapter4_birth.webp',
  'chapter.5.intro':'web/still_chapter5_finalresearch.webp',
  'stage.renewal-14.clear':'web/still_stage14_threeflowers.webp',
  'stage.renewal-15.before':'web/still_stage15_beforefinal.webp',
  'stage.renewal-15.clear':'web/still_stage15_clear.webp',
  'ending.all':'web/still_ending_nextjourney.webp'
 });
 function createPresenter({document:doc,imageFactory=()=>new Image()}={}){
  if(!doc?.createElement)return null;
  const panel=doc.getElementById('storyWindow');
  if(!panel?.parentNode)return null;
  const home=doc.createComment('Normal conversation position');
  panel.parentNode.insertBefore(home,panel);
  const layer=doc.createElement('section');
  layer.id='eventStillLayer';layer.hidden=true;
  layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');
  layer.setAttribute('aria-labelledby','storyEventTitle');
  const stage=doc.createElement('div');stage.className='event-still-stage';
  const mount=doc.createElement('div');mount.className='event-still-dialogue';
  stage.appendChild(mount);layer.appendChild(stage);doc.body.appendChild(layer);
  // A click on the artwork is never a game action or an implicit "next".
  layer.addEventListener('click',e=>e.stopPropagation());
  const cache=new Map();
  let current=null,shownImage=null,background=[];
  function hide(){
   if(shownImage){shownImage.remove();shownImage=null;}
   if(panel.parentNode===mount)home.parentNode.insertBefore(panel,home.nextSibling);
   layer.hidden=true;doc.body.classList.remove('event-still-open');
   for(const [element,inert] of background)element.inert=inert;
   background=[];
  }
  function activate(entry,event){
   if(current?.id!==event.id||entry.status!=='ready')return;
   const wasHidden=layer.hidden;
   if(shownImage!==entry.image){
    shownImage?.remove();shownImage=entry.image;
    shownImage.className='event-still-image';shownImage.alt=event.title;
    shownImage.draggable=false;stage.insertBefore(shownImage,mount);
   }
   if(wasHidden){
    background=Array.from(doc.querySelectorAll('body > header,body > main'))
     .map(element=>[element,element.inert]);
    for(const [element] of background)element.inert=true;
   }
   if(panel.parentNode!==mount)mount.appendChild(panel);
   layer.hidden=false;
   doc.body.classList.add('event-still-open');
   if(wasHidden)doc.getElementById('storyNext')?.focus({preventScroll:true});
  }
  function show(event){
   current=event;
   const file=event&&ASSETS[event.id];
   if(!file){hide();return;}
   let entry=cache.get(file);
   if(!entry){
    entry={status:'pending',image:imageFactory()};cache.set(file,entry);
    entry.image.onload=()=>{
     if(!entry.image.naturalWidth||!entry.image.naturalHeight){entry.image.onerror();return;}
     entry.status='ready';
     if(current?.id===event.id)activate(entry,current);
    };
    entry.image.onerror=()=>{
     entry.status='failed';
     if(current?.id===event.id)hide();
    };
    entry.image.src='assets/'+file;
   }
   if(entry.status==='ready')activate(entry,event);
   else hide();
  }
  // Keep keyboard focus in the modal, without changing dialogue key handlers.
  layer.addEventListener('keydown',e=>{
   if(e.key!=='Tab'||layer.hidden)return;
   const items=Array.from(panel.querySelectorAll('button:not([disabled]),[tabindex="0"]'))
    .filter(element=>!element.hidden&&element.getClientRects().length);
   const index=items.indexOf(doc.activeElement);
   if(!items.length)return;
   if(e.shiftKey&&(index<=0)){e.preventDefault();items.at(-1).focus();}
   else if(!e.shiftKey&&(index===items.length-1||index<0)){e.preventDefault();items[0].focus();}
  });
  return {show,get active(){return !layer.hidden;}};
 }
 return {ASSETS,createPresenter};
});
