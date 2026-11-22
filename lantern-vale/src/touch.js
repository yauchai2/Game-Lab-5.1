export function bindTouch(g) {
  if (!matchMedia('(pointer: coarse)').matches) return;
  const hud=document.getElementById('hud');
  const pad=document.createElement('button');pad.className='travel-pad';pad.setAttribute('aria-label','拖曳移動');
  const knob=document.createElement('span');pad.append(knob);hud.append(pad);
  const interact=document.createElement('button');interact.className='touch-action';interact.textContent='互動';hud.append(interact);
  const clear=()=>{for(const k of ['w','a','s','d'])g.keys[k]=false;knob.style.transform='';};
  const move=e=>{
    const r=pad.getBoundingClientRect();
    const dx=(e.clientX-r.left-r.width/2)/(r.width/2),dz=(e.clientY-r.top-r.height/2)/(r.height/2);
    const scale=Math.max(1,Math.hypot(dx,dz));
    knob.style.transform='translate('+dx/scale*20+'px,'+dz/scale*20+'px)';
    g.keys.a=dx<-.23;g.keys.d=dx>.23;g.keys.w=dz<-.23;g.keys.s=dz>.23;
  };
  pad.onpointerdown=e=>{pad.setPointerCapture(e.pointerId);move(e);};
  pad.onpointermove=e=>{if(pad.hasPointerCapture(e.pointerId))move(e);};
  pad.onlostpointercapture=clear;
  const key=(code,down)=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true}));
  interact.onclick=()=>{if(g.raid){g.net.send({t:'raidLeave'});return;}key('KeyF',true);key('KeyF',false);};
  const actions={lmb:'attack',rmb:'bolt',roll:'Space',q:'KeyQ',e:'KeyE',r:'KeyR'};
  for(const [id,action] of Object.entries(actions)) {
    const el=document.getElementById('sk-'+id);
    el.onpointerdown=e=>{
      e.preventDefault();el.setPointerCapture(e.pointerId);
      if(action==='attack'||action==='bolt') {
        let target=null,distance=Infinity;
        for(const enemy of g.enemies){const d=enemy.pos.distanceTo(g.player.pos);if(!enemy.dead&&d<distance){target=enemy;distance=d;}}
        if(target){const [x,y]=g.ui.screenPos(target.pos.x,target.pos.y,target.pos.z);g.mouse.x=x;g.mouse.y=y;}
        g.mouse[action==='attack'?'l':'r']=true;
      } else key(action,true);
    };
    el.onlostpointercapture=()=>{
      if(action==='attack'||action==='bolt')g.mouse[action==='attack'?'l':'r']=false;
      else key(action,false);
    };
  }
  g.touchInteract=interact;
}
