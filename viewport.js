// The same game document is used on every screen. Its own viewport keeps all
// desktop media queries, fixed modals and animation coordinates in one space.
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else {root.EcosystemViewport=api;api.mount(root,document);}
})(globalThis,function(){
 // Existing PC reference in qa.html and BROWSER-QA.md, not a new mobile layout.
 const REFERENCE=Object.freeze({width:1280,height:900});
 function layout(width,height,coarse=false,insets={}){
  const phone=width<=700||(width<=1100&&height<=600)||(coarse&&Math.min(width,height)<=700);
  const mode=!phone?'desktop':height>width?'portrait':'landscape';
  const left=mode==='desktop'?0:Math.max(0,insets.left||0),right=mode==='desktop'?0:Math.max(0,insets.right||0);
  const top=mode==='desktop'?0:Math.max(0,insets.top||0),bottom=mode==='desktop'?0:Math.max(0,insets.bottom||0);
  const availableWidth=Math.max(1,width-left-right),availableHeight=Math.max(1,height-top-bottom);
  const logicalWidth=mode==='desktop'?width:REFERENCE.width,logicalHeight=mode==='desktop'?height:REFERENCE.height;
  const scale=mode==='desktop'?1:Math.min(availableWidth/logicalWidth,availableHeight/logicalHeight);
  return {mode,logicalWidth,logicalHeight,scale,left:left+(availableWidth-logicalWidth*scale)/2,top:top+(availableHeight-logicalHeight*scale)/2};
 }
 function mount(win,doc){
  const viewport=doc.getElementById('gameViewport'),frame=doc.getElementById('gameScreen'),notice=doc.getElementById('orientationNotice');
  const pointer=win.matchMedia('(pointer: coarse)');let scheduled=false;
  function update(){
   scheduled=false;
   const visual=win.visualViewport,width=visual?.width||win.innerWidth,height=visual?.height||win.innerHeight;
   // Visual viewport dimensions and offsets are CSS pixels, including browser UI changes.
   const initial=layout(width,height,pointer.matches);doc.documentElement.dataset.viewportMode=initial.mode;
   Object.assign(viewport.style,{left:(visual?.offsetLeft||0)+'px',top:(visual?.offsetTop||0)+'px',width:width+'px',height:height+'px'});
   const style=win.getComputedStyle(viewport),px=value=>parseFloat(value)||0;
   const next=layout(width,height,pointer.matches,{left:px(style.paddingLeft),right:px(style.paddingRight),top:px(style.paddingTop),bottom:px(style.paddingBottom)});
   Object.assign(frame.style,{width:next.logicalWidth+'px',height:next.logicalHeight+'px',left:next.left+'px',top:next.top+'px',transform:`scale(${next.scale})`});
   frame.dataset.scale=String(next.scale);frame.hidden=next.mode==='portrait';frame.inert=frame.hidden;notice.hidden=!frame.hidden;
  }
  function schedule(){if(!scheduled){scheduled=true;win.requestAnimationFrame(update);}}
  update();
  // Load once. Rotation, address-bar changes and resizes never replace the game or its state.
  frame.src=frame.dataset.src;
  win.addEventListener('resize',schedule);win.addEventListener('orientationchange',schedule);
  win.visualViewport?.addEventListener('resize',schedule);win.visualViewport?.addEventListener('scroll',schedule);
  pointer.addEventListener?.('change',schedule);
  return {update};
 }
 return {REFERENCE,layout,mount};
});
