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
let recognition = null;
let listening = false;
let speaking = false;
let idleTimer = null;
let selectedVoice = null;

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
  showScreen('play'); updatePlay(); startPresence(); initializeVoice();
  if (!state.lastSkyMove) setTimeout(()=>speakSky(state.message),350);
}));

function setSkyPose(pose) {
  const file=skyAssets[pose]||skyAssets.neutral;
  const next=`${window.SKY_ASSET_ROOT}/${file}`;
  if (skyImage.getAttribute('src')===next) return;
  portrait.classList.add('transitioning');
  setTimeout(()=>{skyImage.src=next;portrait.classList.remove('transitioning');},140);
}

function startPresence() {
  clearTimeout(idleTimer);
  const perform = () => {
    if (!speaking && screens.play.classList.contains('active')) {
      const idlePoses = ['neutral','thinking','neutral','playful','neutral'];
      const pose = idlePoses[Math.floor(Math.random()*idlePoses.length)];
      setSkyPose(pose);
      portrait.classList.remove('micro-look');
      void portrait.offsetWidth;
      portrait.classList.add('micro-look');
    }
    idleTimer=setTimeout(perform,7000+Math.random()*6000);
  };
  idleTimer=setTimeout(perform,4500);
}

function chooseVoice() {
  const voices=speechSynthesis.getVoices().filter(voice=>voice.lang.startsWith('en'));
  const preferred=['Ava (Premium)','Zoe (Premium)','Samantha (Enhanced)','Ava','Samantha','Google US English'];
  selectedVoice=preferred.map(name=>voices.find(voice=>voice.name.includes(name))).find(Boolean)||voices.find(voice=>voice.localService)||voices[0]||null;
}

function initializeVoice() {
  chooseVoice();
  speechSynthesis.onvoiceschanged=chooseVoice;
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if (!Recognition) {
    document.querySelector('#voice-status').textContent='VOICE INPUT UNAVAILABLE';
    document.querySelector('#listen').disabled=true;
    return;
  }
  recognition=new Recognition();
  recognition.lang='en-US'; recognition.continuous=true; recognition.interimResults=true;
  recognition.onstart=()=>{listening=true;document.querySelector('#voice-status').classList.add('listening');document.querySelector('#voice-status').lastChild.textContent=' LISTENING';};
  recognition.onend=()=>{listening=false;document.querySelector('#voice-status').classList.remove('listening');document.querySelector('#voice-status').lastChild.textContent=' VOICE READY';if(!speaking&&screens.play.classList.contains('active'))setTimeout(startListening,500);};
  recognition.onerror=event=>{if(event.error==='not-allowed')document.querySelector('#voice-status').lastChild.textContent=' MICROPHONE NEEDED';};
  recognition.onresult=event=>{
    let interim='';
    for(let i=event.resultIndex;i<event.results.length;i++){
      const words=event.results[i][0].transcript;
      if(event.results[i].isFinal) respondToSpeech(words); else interim+=words;
    }
    document.querySelector('#transcript').textContent=interim?`I hear: “${interim}”`:'';
  };
  startListening();
}

function startListening() {
  if (!recognition||listening||speaking) return;
  try { recognition.start(); } catch (_) {}
}

function stopListening() {
  if (recognition&&listening) recognition.stop();
}

async function respondToSpeech(text) {
  document.querySelector('#transcript').textContent=`You said: “${text}”`;
  setSkyPose('thinking');
  state=await (await fetch('/api/talk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})})).json();
  message.textContent=state.message;
  setSkyPose(state.mood||'neutral');
  speakSky(state.message);
}

function speakSky(text) {
  speechSynthesis.cancel(); stopListening(); speaking=true;
  portrait.classList.add('speaking');
  const utterance=new SpeechSynthesisUtterance(text);
  if(selectedVoice)utterance.voice=selectedVoice;
  utterance.rate=.94; utterance.pitch=1.04; utterance.volume=1;
  utterance.onboundary=()=>{portrait.classList.toggle('talk-beat');};
  utterance.onend=()=>{speaking=false;portrait.classList.remove('speaking','talk-beat');setSkyPose(state?.mood||'neutral');setTimeout(startListening,350);};
  utterance.onerror=utterance.onend;
  speechSynthesis.speak(utterance);
}

function updatePlay() {
  message.textContent=state.message;
  setSkyPose(state.mood||'neutral');
  const uci=state.lastSkyMove;
  document.querySelector('#move-notation').textContent=uci?`${uci.slice(0,2)} → ${uci.slice(2,4)}`:'—';
  document.querySelector('#move-instruction').textContent=uci?`Move my piece from ${uci.slice(0,2)} to ${uci.slice(2,4)} on the physical board.`:'I’m watching the physical chessboard.';
  document.querySelector('#move-card').classList.toggle('visible',Boolean(uci));
  document.querySelector('#turn-label').textContent=state.gameOver?'GAME COMPLETE':'YOUR TURN';
  if (uci) { setSkyPose('move'); setTimeout(()=>speakSky(state.message),260); }
}

document.querySelector('#move-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const value=document.querySelector('#move-input').value.trim().toLowerCase().replace(/[^a-h1-8qrbn]/g,'');
  if (value.length<4) return;
  setSkyPose('thinking');
  const response=await fetch('/api/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:value.slice(0,2),to:value.slice(2,4),promotion:value[4]||'q'})});
  state=await response.json(); updatePlay(); document.querySelector('#move-input').value='';
});
document.querySelector('#speak').addEventListener('click',()=>speakSky(message.textContent));
document.querySelector('#listen').addEventListener('click',()=>{if(listening)stopListening();else startListening();});

enableCamera();
