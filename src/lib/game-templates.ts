// Ready-to-run single-file HTML5 game templates for the ChatUltra Playground.
// NOTE: game code intentionally avoids template literals so it can live safely
// inside TS template strings.

export interface GameTemplate {
  id: string;
  name: string;
  genre: string;
  icon: string; // lucide-style emoji-free glyph key
  desc: string;
  code: string;
}

const PONG = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Neon Pong</title>
<style>
  html,body{margin:0;height:100%;background:#05070d;display:flex;align-items:center;justify-content:center;font-family:monospace}
  canvas{border:1px solid #164e63;border-radius:10px;box-shadow:0 0 40px rgba(34,211,238,.15)}
  .hud{position:fixed;top:10px;width:100%;text-align:center;color:#22d3ee;letter-spacing:4px;font-size:13px}
</style>
</head>
<body>
<div class="hud">NEON PONG — W/S or Up/Down — first to 5</div>
<canvas id="c" width="800" height="480"></canvas>
<script>
var c=document.getElementById('c'),x=c.getContext('2d');
var W=c.width,H=c.height,ph=90,pw=12;
var l={y:H/2-ph/2,s:0},r={y:H/2-ph/2,s:0};
var b={x:W/2,y:H/2,vx:5,vy:3,r:8,speed:5};
var keys={};
addEventListener('keydown',function(e){keys[e.key]=true});
addEventListener('keyup',function(e){keys[e.key]=false});
function reset(dir){b.x=W/2;b.y=H/2;b.speed=5;b.vx=dir*5;b.vy=(Math.random()*4-2)}
function update(){
  if(keys['w']||keys['ArrowUp'])l.y-=7;
  if(keys['s']||keys['ArrowDown'])l.y+=7;
  l.y=Math.max(0,Math.min(H-ph,l.y));
  r.y+=((b.y-ph/2)-r.y)*0.09;
  r.y=Math.max(0,Math.min(H-ph,r.y));
  b.x+=b.vx;b.y+=b.vy;
  if(b.y<b.r||b.y>H-b.r){b.vy*=-1;b.y=Math.max(b.r,Math.min(H-b.r,b.y))}
  if(b.x<pw+18&&b.x>pw&&b.y>l.y&&b.y<l.y+ph){b.vx=Math.abs(b.vx)*1.04;b.vy+=((b.y-(l.y+ph/2))/ph)*4}
  if(b.x>W-pw-18&&b.x<W-pw&&b.y>r.y&&b.y<r.y+ph){b.vx=-Math.abs(b.vx)*1.04;b.vy+=((b.y-(r.y+ph/2))/ph)*4}
  if(b.x<-20){r.s++;reset(1)}
  if(b.x>W+20){l.s++;reset(-1)}
  if(l.s>=5||r.s>=5){l.s=0;r.s=0}
}
function draw(){
  x.fillStyle='#05070d';x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(34,211,238,.25)';x.setLineDash([8,10]);x.beginPath();x.moveTo(W/2,0);x.lineTo(W/2,H);x.stroke();x.setLineDash([]);
  x.fillStyle='#22d3ee';x.fillRect(14,l.y,pw,ph);
  x.fillStyle='#a78bfa';x.fillRect(W-14-pw,r.y,pw,ph);
  x.beginPath();x.arc(b.x,b.y,b.r,0,7);x.fillStyle='#fff';x.fill();
  x.font='28px monospace';x.fillStyle='rgba(255,255,255,.6)';
  x.fillText(l.s,W/2-60,40);x.fillText(r.s,W/2+40,40);
}
function loop(){update();draw();requestAnimationFrame(loop)}
loop();
</script>
</body>
</html>`;

const SNAKE = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Neon Snake</title>
<style>
  html,body{margin:0;height:100%;background:#05070d;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:monospace;color:#34d399}
  canvas{border:1px solid #064e3b;border-radius:10px;box-shadow:0 0 40px rgba(52,211,153,.12);margin-top:10px}
</style>
</head>
<body>
<div>NEON SNAKE — arrows / WASD — score: <span id="s">0</span></div>
<canvas id="c" width="480" height="480"></canvas>
<script>
var c=document.getElementById('c'),x=c.getContext('2d');
var G=24,N=c.width/G;
var snake=[{x:8,y:12},{x:7,y:12},{x:6,y:12}];
var dir={x:1,y:0},food={x:16,y:8},score=0,dead=false;
addEventListener('keydown',function(e){
  var k=e.key;
  if((k==='ArrowUp'||k==='w')&&dir.y===0)dir={x:0,y:-1};
  if((k==='ArrowDown'||k==='s')&&dir.y===0)dir={x:0,y:1};
  if((k==='ArrowLeft'||k==='a')&&dir.x===0)dir={x:-1,y:0};
  if((k==='ArrowRight'||k==='d')&&dir.x===0)dir={x:1,y:0};
});
function place(){food={x:Math.floor(Math.random()*N),y:Math.floor(Math.random()*N)}}
function step(){
  if(dead)return;
  var h={x:(snake[0].x+dir.x+N)%N,y:(snake[0].y+dir.y+N)%N};
  for(var i=0;i<snake.length;i++){if(snake[i].x===h.x&&snake[i].y===h.y){dead=true}}
  snake.unshift(h);
  if(h.x===food.x&&h.y===food.y){score+=10;document.getElementById('s').textContent=score;place()}
  else snake.pop();
}
function draw(){
  x.fillStyle='#05070d';x.fillRect(0,0,c.width,c.height);
  x.strokeStyle='rgba(52,211,153,.07)';
  for(var i=0;i<=N;i++){x.beginPath();x.moveTo(i*G,0);x.lineTo(i*G,c.height);x.stroke();x.beginPath();x.moveTo(0,i*G);x.lineTo(c.width,i*G);x.stroke()}
  x.fillStyle='#fbbf24';x.beginPath();x.arc(food.x*G+G/2,food.y*G+G/2,G/2.6,0,7);x.fill();
  snake.forEach(function(s,i){
    x.fillStyle=i===0?'#a7f3d0':'#34d399';
    x.globalAlpha=i===0?1:Math.max(.35,1-i/snake.length);
    x.fillRect(s.x*G+2,s.y*G+2,G-4,G-4);x.globalAlpha=1;
  });
  if(dead){x.fillStyle='rgba(5,7,13,.75)';x.fillRect(0,0,c.width,c.height);x.fillStyle='#f43f5e';x.font='22px monospace';x.textAlign='center';x.fillText('GAME OVER — press R',c.width/2,c.height/2);x.textAlign='left'}
}
addEventListener('keydown',function(e){if(e.key==='r'&&dead){snake=[{x:8,y:12},{x:7,y:12},{x:6,y:12}];dir={x:1,y:0};score=0;document.getElementById('s').textContent=0;dead=false}});
setInterval(step,110);
setInterval(draw,16);
</script>
</body>
</html>`;

const BREAKOUT = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Neon Breakout</title>
<style>
  html,body{margin:0;height:100%;background:#05070d;display:flex;align-items:center;justify-content:center;font-family:monospace}
  canvas{border:1px solid #6d28d9;border-radius:10px;box-shadow:0 0 40px rgba(167,139,250,.15)}
</style>
</head>
<body>
<canvas id="c" width="720" height="520"></canvas>
<script>
var c=document.getElementById('c'),x=c.getContext('2d');
var W=c.width,H=c.height;
var paddle={x:W/2-55,w:110,h:12,y:H-30};
var ball={x:W/2,y:H-60,vx:4.5,vy:-5,r:7};
var cols=10,rows=6,bw=(W-80)/cols,bh=22,bricks=[],score=0,lives=3,win=false;
var colors=['#f43f5e','#f97316','#fbbf24','#34d399','#22d3ee','#a78bfa'];
for(var r=0;r<rows;r++)for(var col=0;col<cols;col++)bricks.push({x:40+col*bw,y:60+r*(bh+8),alive:true,color:colors[r]});
addEventListener('mousemove',function(e){var rect=c.getBoundingClientRect();paddle.x=Math.max(0,Math.min(W-paddle.w,e.clientX-rect.left-paddle.w/2))});
function reset(){ball.x=W/2;ball.y=H-60;ball.vx=(Math.random()>.5?1:-1)*4.5;ball.vy=-5}
function update(){
  ball.x+=ball.vx;ball.y+=ball.vy;
  if(ball.x<ball.r||ball.x>W-ball.r)ball.vx*=-1;
  if(ball.y<ball.r)ball.vy*=-1;
  if(ball.y>H+30){lives--;if(lives<=0){score=0;lives=3;bricks.forEach(function(b){b.alive=true})}reset()}
  if(ball.y>paddle.y-ball.r&&ball.y<paddle.y+paddle.h&&ball.x>paddle.x&&ball.x<paddle.x+paddle.w){ball.vy=-Math.abs(ball.vy)*1.02;ball.vx+=((ball.x-(paddle.x+paddle.w/2))/paddle.w)*5}
  bricks.forEach(function(b){if(b.alive&&ball.x>b.x&&ball.x<b.x+bw&&ball.y>b.y&&ball.y<b.y+bh){b.alive=false;ball.vy*=-1;score+=10}});
  win=bricks.every(function(b){return !b.alive});
  if(win){bricks.forEach(function(b){b.alive=true});ball.vy-=0.4}
}
function draw(){
  x.fillStyle='#05070d';x.fillRect(0,0,W,H);
  bricks.forEach(function(b){if(b.alive){x.fillStyle=b.color;x.globalAlpha=.9;x.fillRect(b.x,b.y,bw-4,bh);x.globalAlpha=1}});
  x.fillStyle='#a78bfa';x.fillRect(paddle.x,paddle.y,paddle.w,paddle.h);
  x.beginPath();x.arc(ball.x,ball.y,ball.r,0,7);x.fillStyle='#fff';x.fill();
  x.font='16px monospace';x.fillStyle='#c4b5fd';x.fillText('SCORE '+score+'   LIVES '+lives,16,26);
}
function loop(){update();draw();requestAnimationFrame(loop)}
loop();
</script>
</body>
</html>`;

const SHOOTER = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Space Blaster</title>
<style>
  html,body{margin:0;height:100%;background:#05070d;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:monospace;color:#67e8f9}
  canvas{border:1px solid #155e75;border-radius:10px;box-shadow:0 0 40px rgba(34,211,238,.12);margin-top:8px}
</style>
</head>
<body>
<div>SPACE BLASTER — Left/Right move · SPACE fire — score <span id="s">0</span></div>
<canvas id="c" width="560" height="620"></canvas>
<script>
var c=document.getElementById('c'),x=c.getContext('2d');
var W=c.width,H=c.height;
var ship={x:W/2,y:H-60,w:34};
var bullets=[],enemies=[],stars=[],keys={},score=0,over=false,frame=0;
for(var i=0;i<70;i++)stars.push({x:Math.random()*W,y:Math.random()*H,s:Math.random()*1.6+.3});
addEventListener('keydown',function(e){keys[e.key]=true;if(e.key===' ')e.preventDefault()});
addEventListener('keyup',function(e){keys[e.key]=false});
function spawn(){if(frame%46===0&&!over){enemies.push({x:Math.random()*(W-40)+20,y:-20,r:16,vy:1.4+Math.random()})}}
function update(){
  frame++;stars.forEach(function(s){s.y+=s.s;if(s.y>H){s.y=0;s.x=Math.random()*W}});
  if(keys['ArrowLeft'])ship.x-=6;if(keys['ArrowRight'])ship.x+=6;
  ship.x=Math.max(20,Math.min(W-20,ship.x));
  if(keys[' ']&&frame%9===0&&!over)bullets.push({x:ship.x,y:ship.y-18});
  bullets.forEach(function(b){b.y-=9});
  bullets=bullets.filter(function(b){return b.y>-10});
  enemies.forEach(function(e){e.y+=e.vy});
  for(var i=enemies.length-1;i>=0;i--){
    var e=enemies[i];
    if(e.y>H+30){enemies.splice(i,1);continue}
    if(Math.abs(e.x-ship.x)<26&&Math.abs(e.y-ship.y)<26){over=true}
    for(var j=bullets.length-1;j>=0;j--){
      var b=bullets[j];
      if(Math.abs(b.x-e.x)<e.r+4&&Math.abs(b.y-e.y)<e.r+6){enemies.splice(i,1);bullets.splice(j,1);score+=25;document.getElementById('s').textContent=score;break}
    }
  }
}
function draw(){
  x.fillStyle='#05070d';x.fillRect(0,0,W,H);
  x.fillStyle='#e0f2fe';stars.forEach(function(s){x.globalAlpha=s.s/2;x.fillRect(s.x,s.y,1.6,1.6)});x.globalAlpha=1;
  bullets.forEach(function(b){x.fillStyle='#22d3ee';x.fillRect(b.x-2,b.y-10,4,14)});
  enemies.forEach(function(e){
    x.fillStyle='#fb7185';x.beginPath();x.moveTo(e.x,e.y+e.r);x.lineTo(e.x+e.r,e.y-e.r);x.lineTo(e.x-e.r,e.y-e.r);x.closePath();x.fill();
  });
  x.fillStyle='#67e8f9';x.beginPath();x.moveTo(ship.x,ship.y-20);x.lineTo(ship.x+18,ship.y+16);x.lineTo(ship.x-18,ship.y+16);x.closePath();x.fill();
  if(over){x.fillStyle='rgba(5,7,13,.8)';x.fillRect(0,0,W,H);x.fillStyle='#f43f5e';x.font='24px monospace';x.textAlign='center';x.fillText('SHIP DESTROYED — R to restart',W/2,H/2);x.textAlign='left'}
}
addEventListener('keydown',function(e){if(e.key==='r'&&over){over=false;score=0;document.getElementById('s').textContent=0;enemies=[];bullets=[]}});
function loop(){spawn();update();draw();requestAnimationFrame(loop)}
loop();
</script>
</body>
</html>`;

const FLAPPY = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Flappy Orb</title>
<style>
  html,body{margin:0;height:100%;background:#05070d;display:flex;align-items:center;justify-content:center;font-family:monospace}
  canvas{border:1px solid #0e7490;border-radius:10px;box-shadow:0 0 40px rgba(34,211,238,.12)}
</style>
</head>
<body>
<canvas id="c" width="480" height="620"></canvas>
<script>
var c=document.getElementById('c'),x=c.getContext('2d');
var W=c.width,H=c.height;
var bird={y:H/2,v:0},pipes=[],score=0,best=0,started=false,over=false,frame=0;
function flap(){if(over){bird.y=H/2;bird.v=0;pipes=[];score=0;over=false;started=false;return}started=true;bird.v=-7.2}
addEventListener('mousedown',flap);addEventListener('touchstart',function(e){e.preventDefault();flap()});addEventListener('keydown',function(e){if(e.key===' '){e.preventDefault();flap()}});
function resetPipe(p){p.x=W+40;p.gap=170;p.top=80+Math.random()*(H-360);p.scored=false}
pipes.push({x:W+40,gap:170,top:180,scored:false});
function update(){
  frame++;
  if(!started)return;
  bird.v+=0.38;bird.y+=bird.v;
  pipes.forEach(function(p){p.x-=3});
  if(pipes[pipes.length-1].x<W-240)pipes.push({x:W+40,gap:170,top:80+Math.random()*(H-360),scored:false});
  pipes=pipes.filter(function(p){return p.x>-70});
  pipes.forEach(function(p){
    if(60+14>p.x&&60-14<p.x+64){if(bird.y-14<p.top||bird.y+14>p.top+p.gap)over=true}
    if(!p.scored&&p.x+64<60-14){p.scored=true;score++;best=Math.max(best,score)}
  });
  if(bird.y>H-10||bird.y<0)over=true;
}
function draw(){
  x.fillStyle='#05070d';x.fillRect(0,0,W,H);
  for(var i=0;i<40;i++){var sx=(i*97+frame*0.4)%W,sy=(i*61)%H;x.fillStyle='rgba(255,255,255,'+(i%5/28)+')';x.fillRect(sx,sy,1.5,1.5)}
  pipes.forEach(function(p){
    x.fillStyle='#0e7490';x.fillRect(p.x,0,64,p.top);
    x.fillRect(p.x,p.top+p.gap,64,H-p.top-p.gap);
    x.fillStyle='#22d3ee';x.fillRect(p.x,p.top-14,64,14);x.fillRect(p.x,p.top+p.gap,64,14);
  });
  var g=x.createRadialGradient(60,bird.y,2,60,bird.y,16);g.addColorStop(0,'#a5f3fc');g.addColorStop(1,'#7c3aed');
  x.beginPath();x.arc(60,bird.y,13,0,7);x.fillStyle=g;x.fill();
  x.font='30px monospace';x.fillStyle='#fff';x.textAlign='center';x.fillText(score,W/2,60);
  if(!started){x.font='15px monospace';x.fillStyle='#67e8f9';x.fillText('CLICK / SPACE to start',W/2,H/2+80)}
  if(over){x.fillStyle='#f43f5e';x.fillText('GAME OVER',W/2,H/2);x.font='13px monospace';x.fillStyle='#94a3b8';x.fillText('best: '+best+' — click to retry',W/2,H/2+28)}
  x.textAlign='left';
}
function loop(){update();draw();requestAnimationFrame(loop)}
loop();
</script>
</body>
</html>`;

const CLICKER = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Orb Tycoon — Idle Clicker</title>
<style>
  body{margin:0;min-height:100vh;background:radial-gradient(circle at 30% 20%,#0b1026,#05070d 60%);color:#e2e8f0;font-family:monospace;display:flex;align-items:center;justify-content:center;gap:40px}
  .orb{width:180px;height:180px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#a5f3fc,#7c3aed 70%);box-shadow:0 0 60px rgba(124,58,237,.5);cursor:pointer;transition:transform .07s;border:none}
  .orb:active{transform:scale(.92)}
  h1{color:#22d3ee;letter-spacing:3px;font-size:18px}
  .stat{font-size:14px;color:#94a3b8;margin:6px 0}
  .stat b{color:#fbbf24}
  .shop{display:flex;flex-direction:column;gap:8px;margin-top:14px}
  button.buy{background:#0e1424;border:1px solid #1e293b;color:#e2e8f0;padding:8px 12px;border-radius:8px;cursor:pointer;text-align:left;font-family:monospace}
  button.buy:hover{border-color:#22d3ee}
  button.buy small{color:#64748b;display:block}
</style>
</head>
<body>
<div style="text-align:center">
  <h1>ORB TYCOON</h1>
  <button class="orb" id="orb"></button>
  <div class="stat">Energy: <b id="n">0</b></div>
  <div class="stat">per click: <b id="pc">1</b> · per sec: <b id="ps">0</b></div>
</div>
<div>
  <h1 style="visibility:hidden">.</h1>
  <div class="shop">
    <button class="buy" id="b1">Amplifier (+1/click) — <span id="c1">15</span><small>more energy per tap</small></button>
    <button class="buy" id="b2">Drone (+1/sec) — <span id="c2">50</span><small>auto energy</small></button>
    <button class="buy" id="b3">Reactor (+5/sec) — <span id="c3">400</span><small>big auto energy</small></button>
  </div>
</div>
<script>
var n=0,pc=1,ps=0;
var c1=15,c2=50,c3=400;
function fmt(v){return v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(1)+'k':Math.floor(v)}
function render(){
  document.getElementById('n').textContent=fmt(n);
  document.getElementById('pc').textContent=fmt(pc);
  document.getElementById('ps').textContent=fmt(ps);
  document.getElementById('c1').textContent=fmt(c1);
  document.getElementById('c2').textContent=fmt(c2);
  document.getElementById('c3').textContent=fmt(c3);
}
document.getElementById('orb').onclick=function(){n+=pc;render()};
document.getElementById('b1').onclick=function(){if(n>=c1){n-=c1;pc++;c1=Math.floor(c1*1.7);render()}};
document.getElementById('b2').onclick=function(){if(n>=c2){n-=c2;ps+=1;c2=Math.floor(c2*1.8);render()}};
document.getElementById('b3').onclick=function(){if(n>=c3){n-=c3;ps+=5;c3=Math.floor(c3*1.8);render()}};
setInterval(function(){n+=ps;render()},1000);
render();
</script>
</body>
</html>`;

const BLANK = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>My Creation</title>
<style>
  body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 30%,#0b1026,#05070d 65%);color:#e2e8f0;font-family:monospace;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px}
  h1{color:#22d3ee;letter-spacing:4px}
  button{background:#22d3ee22;border:1px solid #22d3ee66;color:#a5f3fc;padding:10px 22px;border-radius:10px;cursor:pointer;font-family:monospace;font-size:14px}
</style>
</head>
<body>
<h1>HELLO CHATULTRA</h1>
<div id="out">press the button…</div>
<button onclick="document.getElementById('out').textContent='You clicked at '+new Date().toLocaleTimeString()">Click me</button>
<script>
// Start building! Or press "Build with AI" and describe your dream game.
console.log('ChatUltra playground ready');
</script>
</body>
</html>`;

export const GAME_TEMPLATES: GameTemplate[] = [
  { id: "pong", name: "Neon Pong", genre: "Arcade", icon: "pong", desc: "Classic paddle duel vs AI, first to 5", code: PONG },
  { id: "snake", name: "Neon Snake", genre: "Arcade", icon: "snake", desc: "Grid slithering with wrap-around walls", code: SNAKE },
  { id: "breakout", name: "Neon Breakout", genre: "Arcade", icon: "breakout", desc: "Paddle & bricks with power ramps", code: BREAKOUT },
  { id: "shooter", name: "Space Blaster", genre: "Shooter", icon: "shooter", desc: "Wave shooter with starfield parallax", code: SHOOTER },
  { id: "flappy", name: "Flappy Orb", genre: "Arcade", icon: "flappy", desc: "One-tap flyer through neon pipes", code: FLAPPY },
  { id: "clicker", name: "Orb Tycoon", genre: "Idle", icon: "clicker", desc: "Idle clicker with upgrades & drones", code: CLICKER },
  { id: "blank", name: "Blank Canvas", genre: "Starter", icon: "blank", desc: "Empty starter — build anything", code: BLANK },
];
