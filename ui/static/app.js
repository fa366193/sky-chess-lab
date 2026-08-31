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
const visionCanvas = document.querySelector('#vision-canvas');
const visionContext = visionCanvas.getContext('2d',{willReadFrequently:true});
let boardBaseline = null;
let previousFeatures = null;
let visionTimer = null;
let motionSeen = false;
let settledFrames = 0;
let detectorBusy = false;
let expectedPhysicalMove = null;
let sessionActive = false;
let boardFlipped = false;
let stableSignature = '';
let stableSignatureFrames = 0;
let verificationTimer = null;
let verificationBaseline = null;
let verificationPrevious = null;
let verificationStep = -1;
let verificationSignature = '';
let verificationFrames = 0;
let learnedChangeThreshold = 4.2;

function showScreen(name) { Object.entries(screens).forEach(([key,node]) => node.classList.toggle('active', key === name)); }

async function enableCamera() {
  if (stream&&stream.active) return true;
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
    return true;
  } catch (error) {
    help.textContent = 'Camera access is required. In your browser settings, allow camera access for 127.0.0.1, then try again.';
    connectionLabel.textContent = 'Camera permission needed';
    return false;
  }
}

function stopCamera() {
  if(stream)stream.getTracks().forEach(track=>track.stop());
  stream=null;video.srcObject=null;placeholder.hidden=false;
  connectionLabel.textContent='Camera off';
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
  const cornerNames=['TOP LEFT','TOP RIGHT','BOTTOM RIGHT','BOTTOM LEFT'];
  points.forEach((p,index)=>{
    ctx.beginPath(); ctx.arc(p.x*scale,p.y*scale,17*scale,0,Math.PI*2); ctx.fillStyle='#b95f2d'; ctx.fill(); ctx.strokeStyle='#fff8eb'; ctx.lineWidth=3*scale; ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font=`600 ${15*scale}px Manrope`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(index+1),p.x*scale,p.y*scale);
    ctx.font=`600 ${9*scale}px DM Mono`;ctx.textAlign=index===1||index===2?'right':'left';ctx.fillStyle='#fff8eb';ctx.strokeStyle='rgba(20,43,67,.8)';ctx.lineWidth=3*scale;
    const labelX=(p.x+(index===1||index===2?-24:24))*scale,labelY=p.y*scale;ctx.strokeText(cornerNames[index],labelX,labelY);ctx.fillText(cornerNames[index],labelX,labelY);
  });
}

function updateSteps() {
  document.querySelector('#point-count').textContent = `${points.length} / 4 CORNERS`;
  [...document.querySelectorAll('#corner-list li')].forEach((item,index)=>item.classList.toggle('active',index===points.length));
  const setupLines=[
    'Great—click the top-left inner corner of the 8×8 playing grid.',
    'Perfect. Now click the top-right inner corner.',
    'Good. Next, click the bottom-right inner corner.',
    'One more: click the bottom-left inner corner.',
    'I can see the whole board now. Keep the camera and board exactly here.'
  ];
  document.querySelector('#setup-message').textContent=stream?setupLines[points.length]:'Hi! First, allow camera access so I can help you frame the physical board.';
  document.querySelector('#setup-sky-image').src=`${window.SKY_ASSET_ROOT}/${points.length===4?skyAssets.happy:skyAssets.teaching}`;
  if (points.length === 4 && verificationStep < 0) beginSmartVerification();
}

view.addEventListener('click', event => {
  if (!stream || points.length === 4) return;
  const rect = view.getBoundingClientRect();
  points.push({x:event.clientX-rect.left,y:event.clientY-rect.top,nx:(event.clientX-rect.left)/rect.width,ny:(event.clientY-rect.top)/rect.height});
  localStorage.setItem('skyChessCalibration',JSON.stringify(points.map(({nx,ny})=>({nx,ny}))));
  drawCalibration(); updateSteps();
});

document.querySelector('#enable-camera').addEventListener('click',enableCamera);
function resetVerificationUi(){document.querySelector('#corner-list').hidden=false;document.querySelector('#verification-panel').hidden=true;document.querySelector('#reset-corners').textContent='Reset points';}
document.querySelector('#reset-corners').addEventListener('click',()=>{stopVerification();resetVerificationUi();points=[];localStorage.removeItem('skyChessCalibration');drawCalibration();updateSteps();help.textContent='Click the top-left inner corner first.';});
document.querySelector('#recalibrate').addEventListener('click',()=>{clearInterval(visionTimer);visionTimer=null;stopVerification();resetVerificationUi();points=[];drawCalibration();updateSteps();showScreen('calibration');});
window.addEventListener('resize',resizeOverlay);

const verificationInstructions=[
  ['Find the white side','Lift the white pawn on e2 and hold it above the board.'],
  ['White identified','Return that white pawn to e2.'],
  ['Find the black side','Lift the black pawn on e7 and hold it above the board.'],
  ['Black identified','Return that black pawn to e7.'],
  ['Test a white move','Move the white pawn from e2 to e4, then remove your hand.'],
  ['Reset the white pawn','Return the white pawn from e4 to e2.'],
  ['Test a black move','Move the black pawn from e7 to e5, then remove your hand.'],
  ['Reset the black pawn','Return the black pawn from e5 to e7.']
];

function setVerificationPrompt(step,note=''){
  verificationStep=step;
  const [title,detail]=verificationInstructions[step]||['Board verified','Sky can identify both colors and complete moves.'];
  document.querySelector('#verification-title').textContent=title;
  document.querySelector('#verification-detail').textContent=detail;
  document.querySelector('#verification-reading').textContent=note||'Watching for a stable change…';
  document.querySelector('#setup-message').textContent=detail;
  [...document.querySelectorAll('.verification-progress i')].forEach((dot,index)=>dot.classList.toggle('active',index<=Math.min(3,Math.floor(step/2))));
  verificationSignature='';verificationFrames=0;
}

function stopVerification(){clearInterval(verificationTimer);verificationTimer=null;verificationStep=-1;verificationBaseline=null;}

function beginSmartVerification(){
  document.querySelector('#corner-list').hidden=true;
  document.querySelector('#verification-panel').hidden=false;
  document.querySelector('#reset-corners').textContent='Restart setup';
  help.textContent='Now Sky will verify orientation, piece colors, and full move recognition.';
  document.querySelector('#setup-message').textContent='Great. Keep every piece in its normal starting square while I learn the board.';
  setTimeout(()=>{
    verificationBaseline=captureFeatures();verificationPrevious=verificationBaseline;
    if(!verificationBaseline){document.querySelector('#verification-reading').textContent='Camera frame unavailable. Restart setup.';return;}
    setVerificationPrompt(0);
    verificationTimer=setInterval(analyzeVerification,300);
  },1800);
}

function verificationIndex(square,flipped){const file='abcdefgh'.indexOf(square[0]),rank=Number(square[1]);const col=flipped?7-file:file;const row=flipped?rank-1:8-rank;return row*8+col;}
function closeToBaseline(features){return Math.max(...features.map((item,index)=>featureDistance(item,verificationBaseline[index])))<3.2;}

function stableVerificationChanges(current){
  const scores=current.map((item,index)=>({index,score:featureDistance(item,verificationBaseline[index])})).sort((a,b)=>b.score-a.score);
  const changed=scores.filter(item=>item.score>learnedChangeThreshold).slice(0,6);
  const live=Math.max(...current.map((item,index)=>featureDistance(item,verificationPrevious[index])));
  verificationPrevious=current;
  const signature=changed.map(item=>item.index).sort((a,b)=>a-b).join(',');
  if(live<3.2&&signature&&signature===verificationSignature)verificationFrames++;else{verificationSignature=signature;verificationFrames=1;}
  document.querySelector('#verification-reading').textContent=`Camera sees ${changed.length} changed ${changed.length===1?'square':'squares'} · signal ${scores[0].score.toFixed(1)}`;
  return verificationFrames>=4?changed:null;
}

function containsSquares(changes,squares){const seen=new Set(changes.map(item=>item.index));return squares.every(square=>seen.has(cameraIndex(square)));}

function advanceAfterReturn(nextStep,current){
  if(!closeToBaseline(current))return false;
  verificationBaseline=current;verificationPrevious=current;setVerificationPrompt(nextStep);return true;
}

function analyzeVerification(){
  const current=captureFeatures();if(!current)return;
  if([1,3,5,7].includes(verificationStep)){
    if(!advanceAfterReturn(verificationStep+1,current))return;
    if(verificationStep===8)finishVerification();
    return;
  }
  const changes=stableVerificationChanges(current);if(!changes)return;
  const strongest=changes[0];
  if(verificationStep===0){
    const normal=verificationIndex('e2',false),flipped=verificationIndex('e2',true);
    if(strongest.index!==normal&&strongest.index!==flipped){document.querySelector('#verification-reading').textContent='That was not e2. Return it and lift the white e2 pawn.';return;}
    boardFlipped=strongest.index===flipped;learnedChangeThreshold=Math.max(3,Math.min(8,strongest.score*.42));setVerificationPrompt(1,'White e2 recognized. Return it to e2.');return;
  }
  if(verificationStep===2){
    if(strongest.index!==cameraIndex('e7')){document.querySelector('#verification-reading').textContent='That was not the black e7 pawn. Please try e7.';return;}
    setVerificationPrompt(3,'Black e7 recognized. Return it to e7.');return;
  }
  if(verificationStep===4){
    if(!containsSquares(changes,['e2','e4'])){document.querySelector('#verification-reading').textContent='I need to see exactly e2 and e4 change. Return the pawn and try again.';return;}
    setVerificationPrompt(5,'White move e2 → e4 recognized. Now return it to e2.');return;
  }
  if(verificationStep===6){
    if(!containsSquares(changes,['e7','e5'])){document.querySelector('#verification-reading').textContent='I need to see exactly e7 and e5 change. Return the pawn and try again.';return;}
    setVerificationPrompt(7,'Black move e7 → e5 recognized. Now return it to e7.');
  }
}

function finishVerification(){
  clearInterval(verificationTimer);verificationTimer=null;
  document.querySelector('#verification-title').textContent='Board verified';
  document.querySelector('#verification-detail').textContent='Sky recognized White, Black, e2 → e4, and e7 → e5.';
  document.querySelector('#verification-reading').textContent='Orientation and sensitivity saved for this game.';
  document.querySelector('#setup-message').textContent='Perfect—I can identify both sides and recognize complete moves. Now choose your color.';
  document.querySelector('#setup-sky-image').src=`${window.SKY_ASSET_ROOT}/${skyAssets.happy}`;
  setTimeout(()=>showScreen('color'),1200);
}

document.querySelectorAll('[data-color]').forEach(button=>button.addEventListener('click',async()=>{
  humanColor=button.dataset.color;
  state=await (await fetch('/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({color:humanColor})})).json();
  document.querySelector('#color-label').textContent=humanColor.toUpperCase();
  sessionActive=true;showScreen('play'); updatePlay(); startPresence(); initializeVoice();
  expectedPhysicalMove=state.lastSkyMove||null;
  startBoardVision();
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
  recognition.onend=()=>{listening=false;document.querySelector('#voice-status').classList.remove('listening');document.querySelector('#voice-status').lastChild.textContent=' VOICE READY';if(sessionActive&&!speaking&&screens.play.classList.contains('active'))setTimeout(startListening,500);};
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
  if (!sessionActive||!recognition||listening||speaking) return;
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

function boardPoint(u,v) {
  const [tl,tr,br,bl]=points;
  return {
    x:(1-u)*(1-v)*tl.nx+u*(1-v)*tr.nx+u*v*br.nx+(1-u)*v*bl.nx,
    y:(1-u)*(1-v)*tl.ny+u*(1-v)*tr.ny+u*v*br.ny+(1-u)*v*bl.ny
  };
}

function captureFeatures() {
  if (!stream||video.readyState<2||points.length!==4) return null;
  const width=640,height=400;
  visionCanvas.width=width; visionCanvas.height=height;
  const videoRatio=video.videoWidth/video.videoHeight;
  const canvasRatio=width/height;
  let sx=0,sy=0,sw=video.videoWidth,sh=video.videoHeight;
  if(videoRatio>canvasRatio){sw=video.videoHeight*canvasRatio;sx=(video.videoWidth-sw)/2;}else{sh=video.videoWidth/canvasRatio;sy=(video.videoHeight-sh)/2;}
  visionContext.drawImage(video,sx,sy,sw,sh,0,0,width,height);
  const image=visionContext.getImageData(0,0,width,height).data;
  const features=[];
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){
    const center=boardPoint((col+.5)/8,(row+.5)/8);
    const right=boardPoint((col+.72)/8,(row+.5)/8);
    const down=boardPoint((col+.5)/8,(row+.72)/8);
    const rx=Math.max(3,Math.abs(right.x-center.x)*width);
    const ry=Math.max(3,Math.abs(down.y-center.y)*height);
    let r=0,g=0,b=0,edge=0,count=0;
    const cx=center.x*width,cy=center.y*height;
    for(let y=Math.max(1,Math.floor(cy-ry));y<Math.min(height-1,Math.ceil(cy+ry));y+=2){
      for(let x=Math.max(1,Math.floor(cx-rx));x<Math.min(width-1,Math.ceil(cx+rx));x+=2){
        const i=(y*width+x)*4;r+=image[i];g+=image[i+1];b+=image[i+2];
        const j=(y*width+x+1)*4;edge+=Math.abs(image[i]-image[j])+Math.abs(image[i+1]-image[j+1])+Math.abs(image[i+2]-image[j+2]);count++;
      }
    }
    features.push([r/count,g/count,b/count,edge/count]);
  }
  return features;
}

function featureDistance(a,b){return Math.abs(a[0]-b[0])*.28+Math.abs(a[1]-b[1])*.38+Math.abs(a[2]-b[2])*.22+Math.abs(a[3]-b[3])*.12;}
function cameraSquare(index){const row=Math.floor(index/8),col=index%8;const file=boardFlipped?7-col:col;const rank=boardFlipped?row+1:8-row;return 'abcdefgh'[file]+rank;}
function cameraIndex(square){const file='abcdefgh'.indexOf(square[0]),rank=Number(square[1]);const col=boardFlipped?7-file:file;const row=boardFlipped?rank-1:8-rank;return row*8+col;}
function pieceBelongsToHuman(symbol){if(!symbol)return false;return humanColor==='white'?symbol===symbol.toUpperCase():symbol===symbol.toLowerCase();}

function setBoardWatch(text,stateName='watching'){
  const label=document.querySelector('#board-watch');label.lastChild.textContent=` ${text}`;label.dataset.state=stateName;
}

function startBoardVision(){
  clearInterval(visionTimer);boardBaseline=null;previousFeatures=null;motionSeen=false;settledFrames=0;stableSignature='';stableSignatureFrames=0;
  setBoardWatch('HOLD STILL — LEARNING POSITION','learning');
  setTimeout(()=>{
    boardBaseline=captureFeatures();previousFeatures=boardBaseline;
    if(!boardBaseline){setBoardWatch('CAMERA NOT READY','error');return;}
    setBoardWatch(expectedPhysicalMove?'WAITING FOR SKY’S PIECE':'WATCHING PHYSICAL BOARD');
    visionTimer=setInterval(analyzeBoard,320);
  },1800);
}

function stopGameResources(){
  sessionActive=false;
  clearInterval(visionTimer);visionTimer=null;clearTimeout(idleTimer);idleTimer=null;
  speechSynthesis.cancel();speaking=false;stopListening();stopCamera();
}

async function pauseGame(){
  stopGameResources();document.querySelector('#pause-modal').hidden=false;
}

async function resumeGame(){
  document.querySelector('#pause-modal').hidden=true;
  const ready=await enableCamera();
  if(!ready){document.querySelector('#pause-modal').hidden=false;return;}
  sessionActive=true;startBoardVision();startPresence();initializeVoice();
}

async function endGame(){
  stopGameResources();await fetch('/api/reset',{method:'POST'});document.querySelector('#end-modal').hidden=false;
}

async function newGame(){
  document.querySelector('#end-modal').hidden=true;points=[];boardBaseline=null;expectedPhysicalMove=null;
  stopVerification();resetVerificationUi();localStorage.removeItem('skyChessCalibration');drawCalibration();updateSteps();showScreen('calibration');
  document.querySelector('#enable-camera').disabled=false;document.querySelector('#enable-camera').textContent='Enable camera';
  await enableCamera();
}

document.querySelector('#pause-game').addEventListener('click',pauseGame);
document.querySelector('#resume-game').addEventListener('click',resumeGame);
document.querySelector('#end-game').addEventListener('click',endGame);
document.querySelector('#new-game').addEventListener('click',newGame);

async function analyzeBoard(){
  if(detectorBusy||!boardBaseline)return;
  const current=captureFeatures();if(!current)return;
  const liveScores=current.map((item,i)=>featureDistance(item,previousFeatures[i]));
  const liveMotion=liveScores.reduce((sum,score)=>sum+score,0)/64;
  const peakMotion=Math.max(...liveScores);
  const changes=current.map((item,i)=>({index:i,score:featureDistance(item,boardBaseline[i])})).sort((a,b)=>b.score-a.score);
  previousFeatures=current;
  const changed=changes.filter(change=>change.score>learnedChangeThreshold);
  document.querySelector('#vision-meter').textContent=`Δ ${changes[0].score.toFixed(1)} · ${changed.length} ${changed.length===1?'square':'squares'}`;
  if(peakMotion>7.5){motionSeen=true;settledFrames=0;stableSignatureFrames=0;setBoardWatch('I SEE MOVEMENT — FINISH THE MOVE','motion');return;}
  if(changed.length<1){stableSignature='';stableSignatureFrames=0;return;}
  const signature=changed.slice(0,6).map(change=>change.index).sort((a,b)=>a-b).join(',');
  if(signature===stableSignature)stableSignatureFrames++;else{stableSignature=signature;stableSignatureFrames=1;}
  if(liveMotion<2.8)settledFrames++;else settledFrames=0;
  if(stableSignatureFrames<4||settledFrames<3){setBoardWatch('BOARD CHANGED — HOLD STILL','thinking');return;}
  motionSeen=false;settledFrames=0;
  stableSignatureFrames=0;
  const candidates=changed.slice(0,6);
  if(candidates.length<2){setBoardWatch('I SEE ONE SQUARE — WAITING FOR THE SECOND','thinking');return;}
  detectorBusy=true;setBoardWatch('CHECKING MOVE…','thinking');
  try{
    if(expectedPhysicalMove){
      const syncResult=checkSkyPlacement(candidates,expectedPhysicalMove);
      if(syncResult.correct){
        boardBaseline=current;expectedPhysicalMove=null;setBoardWatch('SKY’S MOVE CONFIRMED');message.textContent='Perfect—that is exactly where I wanted my piece. The physical board and I are synchronized. Your turn.';setSkyPose('happy');speakSky(message.textContent);return;
      }
      setBoardWatch('SKY’S PIECE IS ON THE WRONG SQUARE','error');
      message.textContent=syncResult.message;setSkyPose('teaching');speakSky(message.textContent);return;
    }
    const detected=await inferLegalMove(candidates);
    if(detected){boardBaseline=current;state=detected;expectedPhysicalMove=state.lastSkyMove||null;updatePlay();setBoardWatch(expectedPhysicalMove?'WAITING FOR SKY’S PIECE':'WATCHING PHYSICAL BOARD');}
    else{setBoardWatch('MOVE UNCLEAR — TRY AGAIN','error');message.textContent='I saw the board change, but I couldn’t match it to a legal move. Put the pieces back and try once more, or use the recovery field below.';setSkyPose('surprised');}
  }finally{detectorBusy=false;}
}

function checkSkyPlacement(candidates,uci){
  const expectedFrom=uci.slice(0,2),expectedTo=uci.slice(2,4);
  const changed=new Set(candidates.map(candidate=>candidate.index));
  const fromSeen=changed.has(cameraIndex(expectedFrom));
  const toSeen=changed.has(cameraIndex(expectedTo));
  if(fromSeen&&toSeen)return {correct:true};
  const changedSquares=candidates.slice(0,3).map(candidate=>cameraSquare(candidate.index));
  if(fromSeen){
    const observed=changedSquares.find(square=>square!==expectedFrom);
    return {correct:false,message:observed?`That’s the correct piece, but I see it on ${observed}. Please move it to ${expectedTo}.`:`I saw you lift my piece from ${expectedFrom}, but I need it placed on ${expectedTo}.`};
  }
  return {correct:false,message:`I’m waiting for my announced move: ${expectedFrom} to ${expectedTo}. Please move that exact piece.`};
}

async function inferLegalMove(candidates){
  const changedSquares=candidates.map(candidate=>cameraSquare(candidate.index));
  const origins=changedSquares.filter(square=>pieceBelongsToHuman(state.pieces[square]));
  for(const from of origins){
    const legalResponse=await fetch('/api/legal-moves',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({square:from})});
    const legal=(await legalResponse.json()).moves;
    for(const to of changedSquares){
      if(from===to||!legal.includes(to))continue;
      const response=await fetch('/api/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to,promotion:'q'})});
      if(response.ok)return await response.json();
    }
  }
  return null;
}

document.querySelector('#move-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const value=document.querySelector('#move-input').value.trim().toLowerCase().replace(/[^a-h1-8qrbn]/g,'');
  if (value.length<4) return;
  setSkyPose('thinking');
  const response=await fetch('/api/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:value.slice(0,2),to:value.slice(2,4),promotion:value[4]||'q'})});
  state=await response.json(); updatePlay(); document.querySelector('#move-input').value='';
  expectedPhysicalMove=state.lastSkyMove||null;
  boardBaseline=captureFeatures();
});
document.querySelector('#speak').addEventListener('click',()=>speakSky(message.textContent));
document.querySelector('#listen').addEventListener('click',()=>{if(listening)stopListening();else startListening();});

enableCamera();
