const boardEl = document.querySelector('#board');
const messageEl = document.querySelector('#message');
const selectionEl = document.querySelector('#selection');
const portraitEl = document.querySelector('#portrait');
const skyImageEl = document.querySelector('#sky-image');
const skyAssets = {
  neutral:'01-watching.png', thinking:'02-thinking.png', happy:'03-encouraging.png',
  playful:'04-playful.png', teaching:'05-teaching.png', surprised:'06-surprised.png',
  move:'07-my-move.png', celebrating:'08-celebrating.png'
};
const glyphs = {K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙', k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟'};
let state = null;
let selected = null;
let legal = [];

function squareName(row, column) { return 'abcdefgh'[column] + (8 - row); }

function render() {
  boardEl.replaceChildren();
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      const name = squareName(row, column);
      const square = document.createElement('button');
      square.className = `square ${(row + column) % 2 ? 'dark' : 'light'}`;
      square.dataset.square = name;
      square.setAttribute('aria-label', name);
      if (selected === name) square.classList.add('selected');
      if (legal.includes(name)) square.classList.add('legal');
      if ([state.lastHumanMove, state.lastSkyMove].some(m => m && (m.slice(0,2) === name || m.slice(2,4) === name))) square.classList.add('last');
      if (state.pieces[name]) {
        square.textContent = glyphs[state.pieces[name]];
        square.classList.add(state.pieces[name] === state.pieces[name].toUpperCase() ? 'white-piece' : 'black-piece');
      }
      square.addEventListener('click', () => choose(name));
      boardEl.append(square);
    }
  }
}

async function choose(name) {
  if (state.gameOver || state.turn !== 'white') return;
  if (selected && legal.includes(name)) {
    selectionEl.textContent = `${selected.toUpperCase()} → ${name.toUpperCase()} · Sky is thinking…`;
    setSkyPose('thinking');
    const response = await fetch('/api/move', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({from:selected, to:name})});
    state = await response.json();
    selected = null; legal = [];
    update();
    if (state.lastSkyMove) announceSkyMove();
    return;
  }
  if (!state.pieces[name] || state.pieces[name] !== state.pieces[name].toUpperCase()) {
    selected = null; legal = []; selectionEl.textContent = 'Select one of your white pieces'; render(); return;
  }
  selected = name;
  const response = await fetch('/api/legal-moves', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({square:name})});
  legal = (await response.json()).moves;
  selectionEl.textContent = legal.length ? `${name.toUpperCase()} selected · ${legal.length} legal ${legal.length === 1 ? 'move' : 'moves'}` : `${name.toUpperCase()} has no legal moves`;
  render();
}

function update() {
  messageEl.textContent = state.message;
  setSkyPose(state.mood || 'neutral');
  document.querySelector('#move-number').textContent = String(state.moveNumber).padStart(2, '0');
  document.querySelector('#turn-title').textContent = state.gameOver ? 'Game complete' : 'Your turn';
  if (!selected) selectionEl.textContent = state.check ? 'Your king is in check' : 'Select a white piece';
  render();
}

function setSkyPose(pose) {
  const resolved = skyAssets[pose] ? pose : 'neutral';
  const next = `${window.SKY_ASSET_ROOT}/${skyAssets[resolved]}`;
  if (skyImageEl.getAttribute('src') === next) return;
  portraitEl.classList.add('transitioning');
  window.setTimeout(() => {
    skyImageEl.src = next;
    skyImageEl.alt = `Sky is ${resolved}`;
    portraitEl.dataset.mood = resolved;
    portraitEl.classList.remove('transitioning');
  }, 150);
}

function announceSkyMove() {
  const reaction = state.mood || 'neutral';
  setSkyPose('move');
  portraitEl.classList.add('speaking');
  window.setTimeout(() => {
    portraitEl.classList.remove('speaking');
    setSkyPose(reaction);
  }, 3200);
}

document.querySelector('#reset').addEventListener('click', async () => {
  state = await (await fetch('/api/reset', {method:'POST'})).json(); selected = null; legal = []; update();
});
document.querySelector('#speak').addEventListener('click', () => {
  speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(messageEl.textContent); utterance.rate = .96; utterance.pitch = 1.06; speechSynthesis.speak(utterance);
});

fetch('/api/game').then(r => r.json()).then(data => { state = data; update(); });
