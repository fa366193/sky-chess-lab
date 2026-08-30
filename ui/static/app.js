const boardEl = document.querySelector('#board');
const messageEl = document.querySelector('#message');
const selectionEl = document.querySelector('#selection');
const portraitEl = document.querySelector('#portrait');
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
    const response = await fetch('/api/move', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({from:selected, to:name})});
    state = await response.json();
    selected = null; legal = [];
    update();
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
  portraitEl.dataset.mood = state.mood || 'neutral';
  document.querySelector('#move-number').textContent = String(state.moveNumber).padStart(2, '0');
  document.querySelector('#turn-title').textContent = state.gameOver ? 'Game complete' : 'Your turn';
  if (!selected) selectionEl.textContent = state.check ? 'Your king is in check' : 'Select a white piece';
  render();
}

document.querySelector('#reset').addEventListener('click', async () => {
  state = await (await fetch('/api/reset', {method:'POST'})).json(); selected = null; legal = []; update();
});
document.querySelector('#speak').addEventListener('click', () => {
  speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(messageEl.textContent); utterance.rate = .96; utterance.pitch = 1.06; speechSynthesis.speak(utterance);
});

fetch('/api/game').then(r => r.json()).then(data => { state = data; update(); });

