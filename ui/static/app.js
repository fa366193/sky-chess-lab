const screens = {calibration:document.querySelector('#calibration-screen'), color:document.querySelector('#color-screen'), play:document.querySelector('#play-screen')};
const video = document.querySelector('#camera');
const overlay = document.querySelector('#camera-overlay');
const view = document.querySelector('#camera-view');
const placeholder = document.querySelector('#camera-placeholder');
const help = document.querySelector('#camera-help');
const connectionLabel = document.querySelector('#connection-label');
const skyImage = document.querySelector('#sky-image');
const portrait = document.querySelector('#portrait');
const message = document.querySelector('#message');
const skyAssets = {neutral:'01-watching.png',thinking:'02-thinking.png',happy:'03-encouraging.png',playful:'04-playful.png',teaching:'05-teaching.png',surprised:'06-surprised.png',move:'07-my-move.png',celebrating:'08-celebrating.png'};
let stream = null;
let points = [];
let state = null;
let humanColor = 'white';

function showScreen(name) { Object.entries(screens).forEach(([key,node]) => node.classList.toggle('active', key === name)); }

async function enableCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}},audio:false});
    video.srcObject = stream;
    await video.play();
    placeholder.hidden = true;
    connectionLabel.textContent = 'Camera connected';
    document.querySelector('#enable-camera').textContent = 'Camera enabled';
    document.querySelector('#enable-camera').disabled = true;
    document.querySelector('#reset-corners').disabled = false;
    resizeOverlay();
  } catch (error) {
    help.textContent = 'Camera access is required. In your browser settings, allow camera access for 127.0.0.1, then try again.';
    connectionLabel.textContent = 'Camera permission needed';
  }
}

function resizeOverlay() {
  const rect = view.getBoundingClientRect();
  overlay.width = Math.round(rect.width * devicePixelRatio);
  overlay.height = Math.round(rect.height * devicePixelRatio);
  overlay.style.width = `${rect.width}px`; overlay.style.height = `${rect.height}px`;
  drawCalibration();
}

function drawCalibration() {
  const ctx = overlay.getContext('2d');
  const scale = devicePixelRatio;
  ctx.clearRect(0,0,overlay.width,overlay.height);
  if (points.length > 1) {
    ctx.beginPath(); ctx.moveTo(points[0].x*scale,points[0].y*scale);
    points.slice(1).forEach(p=>ctx.lineTo(p.x*scale,p.y*scale));
    if (points.length === 4) ctx.closePath();
    ctx.strokeStyle='#64a0e3'; ctx.lineWidth=3*scale; ctx.stroke();
    if (points.length === 4) { ctx.fillStyle='rgba(92,145,215,.16)'; ctx.fill(); }
  }
  points.forEach((p,index)=>{
    ctx.beginPath(); ctx.arc(p.x*scale,p.y*scale,17*scale,0,Math.PI*2); ctx.fillStyle='#b95f2d'; ctx.fill(); ctx.strokeStyle='#fff8eb'; ctx.lineWidth=3*scale; ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font=`600 ${15*scale}px Manrope`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(index+1),p.x*scale,p.y*scale);
  });
}

function updateSteps() {
  document.querySelector('#point-count').textContent = `${points.length} / 4 CORNERS`;
  [...document.querySelectorAll('#corner-list li')].forEach((item,index)=>item.classList.toggle('active',index===points.length));
  if (points.length === 4) {
    help.textContent = 'Board mapped. Keep the camera and board in this position.';
    window.setTimeout(()=>showScreen('color'),650);
  }
}

view.addEventListener('click', event => {
  if (!stream || points.length === 4) return;
  const rect = view.getBoundingClientRect();
  points.push({x:event.clientX-rect.left,y:event.clientY-rect.top,nx:(event.clientX-rect.left)/rect.width,ny:(event.clientY-rect.top)/rect.height});
  localStorage.setItem('skyChessCalibration',JSON.stringify(points.map(({nx,ny})=>({nx,ny}))));
  drawCalibration(); updateSteps();
});

document.querySelector('#enable-camera').addEventListener('click',enableCamera);
document.querySelector('#reset-corners').addEventListener('click',()=>{points=[];localStorage.removeItem('skyChessCalibration');drawCalibration();updateSteps();help.textContent='Click the top-left inner corner first.';});
document.querySelector('#recalibrate').addEventListener('click',()=>{points=[];drawCalibration();updateSteps();showScreen('calibration');});
window.addEventListener('resize',resizeOverlay);

document.querySelectorAll('[data-color]').forEach(button=>button.addEventListener('click',async()=>{
  humanColor=button.dataset.color;
  state=await (await fetch('/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({color:humanColor})})).json();
  document.querySelector('#color-label').textContent=humanColor.toUpperCase();
  showScreen('play'); updatePlay();
}));

function setSkyPose(pose) {
  const file=skyAssets[pose]||skyAssets.neutral;
  const next=`${window.SKY_ASSET_ROOT}/${file}`;
  if (skyImage.getAttribute('src')===next) return;
  portrait.classList.add('transitioning');
  setTimeout(()=>{skyImage.src=next;portrait.classList.remove('transitioning');},140);
}

function updatePlay() {
  message.textContent=state.message;
  setSkyPose(state.mood||'neutral');
  const uci=state.lastSkyMove;
  document.querySelector('#move-notation').textContent=uci?`${uci.slice(0,2)} → ${uci.slice(2,4)}`:'—';
  document.querySelector('#move-instruction').textContent=uci?`Move my piece from ${uci.slice(0,2)} to ${uci.slice(2,4)} on the physical board.`:'I’m watching the physical chessboard.';
  document.querySelector('#move-card').classList.toggle('visible',Boolean(uci));
  document.querySelector('#turn-label').textContent=state.gameOver?'GAME COMPLETE':'YOUR TURN';
  if (uci) { setSkyPose('move'); portrait.classList.add('speaking'); setTimeout(()=>{portrait.classList.remove('speaking');setSkyPose(state.mood||'neutral');},3200); }
}

document.querySelector('#move-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const value=document.querySelector('#move-input').value.trim().toLowerCase().replace(/[^a-h1-8qrbn]/g,'');
  if (value.length<4) return;
  setSkyPose('thinking');
  const response=await fetch('/api/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:value.slice(0,2),to:value.slice(2,4),promotion:value[4]||'q'})});
  state=await response.json(); updatePlay(); document.querySelector('#move-input').value='';
});
document.querySelector('#speak').addEventListener('click',()=>{speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(message.textContent);utterance.rate=.96;utterance.pitch=1.06;speechSynthesis.speak(utterance);});

enableCamera();
