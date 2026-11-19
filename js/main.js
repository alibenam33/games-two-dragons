// UI glue for Two Dragons: renders the logic state, handles input, and drives
// art and sound. Game rules live in logic.js only.
(function () {
  'use strict';

  const L = window.TwoDragonsLogic;
  const Art = window.TwoDragonsArt;
  const AudioEngine = window.TwoDragonsAudio;

  const SIDES = {
    X: { name: 'Jade Dragon' },
    O: { name: 'Vermilion Phoenix' },
  };

  // In "Vs computer" mode the person plays the Dragon and the computer the Phoenix.
  const HUMAN = 'X';
  const COMPUTER = 'O';
  const MODES = ['pvp', 'ai'];
  const LEVELS = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

  const TEXT = {
    roundStart: 'The garden awaits your first stroke.',
    turn: { X: 'Jade Dragon’s turn — X.', O: 'Vermilion Phoenix’s turn — O.' },
    win: { X: 'The Jade Dragon wins the round!', O: 'The Vermilion Phoenix wins the round!' },
    draw: 'Balance reigns in the garden. It’s a draw.',
    playAgain: 'Press “New round” to play again.',
    invalid: {
      occupied: 'This cell already bears a seal.',
      'round-over': 'The round is over. Start a new round.',
      'not-your-turn': 'It is not your turn yet.',
      'out-of-bounds': 'That cell is not on the board.',
      'ai-thinking': 'The Phoenix is choosing its move…',
    },
    lots: (side) => `Lots drawn: the ${SIDES[side].name} begins.`,
    alternate: (side) => `The ${SIDES[side].name} begins this round.`,
    pillTurn: 'Your turn',
    pillWin: 'Wins the round',
    pillThinking: 'Thinking…',
    role: {
      pvp: { X: 'Player 1', O: 'Player 2' },
      ai: { X: 'You', O: (level) => `Computer · ${LEVELS[level]}` },
    },
    switchMode: {
      pvp: 'Switch to two players?',
      ai: 'Play against the computer?',
    },
  };

  const PREFS_KEY = 'two-dragons:prefs';

  function loadPrefs() {
    const defaults = { music: true, sfx: true, mode: 'pvp', level: 'normal' };
    let prefs;
    try {
      prefs = { ...defaults, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
    } catch (e) {
      prefs = defaults;
    }
    if (!MODES.includes(prefs.mode)) prefs.mode = defaults.mode;
    if (!(prefs.level in LEVELS)) prefs.level = defaults.level;
    return prefs;
  }

  function savePrefs(prefs) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* storage unavailable */ }
  }

  const $ = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const prefs = loadPrefs();
  const audio = new AudioEngine(prefs);
  let state = L.createGame();
  let focusIndex = 4;
  let busy = false;
  let hintTimer = 0;
  let aiTimer = 0;

  // ---- Setup ----------------------------------------------------------------

  Art.injectDefs();
  document.documentElement.style.setProperty('--paper-tex', `url(${Art.paperTexture().toDataURL('image/png')})`);

  const scene = new Art.BackgroundScene($('scenery'));
  scene.setReducedMotion(reducedMotion.matches);
  reducedMotion.addEventListener('change', (e) => scene.setReducedMotion(e.matches));

  const stage = $('stage');
  function fitStage() {
    const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    stage.style.setProperty('--s', s.toFixed(4));
  }
  fitStage();
  window.addEventListener('resize', fitStage);

  $('title-seal-x').innerHTML = Art.seal('X', { seed: 31 });
  $('title-seal-o').innerHTML = Art.seal('O', { seed: 32 });
  for (const side of ['X', 'O']) {
    document.querySelector(`[data-emblem="${side}"]`).innerHTML = Art.seal(side, { seed: side === 'X' ? 101 : 202, motifOpacity: 0.38 });
  }

  const boardEl = $('board');
  const cellsEl = $('cells');
  $('grid-layer').innerHTML = Art.gridSVG(9);
  const winLayer = $('win-layer');
  const ghosts = { X: Art.seal('X', { seed: 5 }), O: Art.seal('O', { seed: 6 }) };

  const cells = [];
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.index = String(i);
    cell.innerHTML = `<span class="ghost ghost-x">${ghosts.X}</span><span class="ghost ghost-o">${ghosts.O}</span>`;
    cell.addEventListener('click', () => onCell(i));
    cell.addEventListener('focus', () => { focusIndex = i; updateRoving(); });
    cellsEl.appendChild(cell);
    cells.push(cell);
  }

  const cards = {
    X: { el: $('card-X'), score: $('score-X'), pill: $('pill-X') },
    O: { el: $('card-O'), score: $('score-O'), pill: $('pill-O') },
  };

  // ---- Rendering ------------------------------------------------------------

  function isAiTurn() {
    return prefs.mode === 'ai' && state.status === 'playing' && state.current === COMPUTER;
  }

  function hasProgress() {
    const s = state.scores;
    return L.isRoundInProgress(state) || s.X + s.O + s.draws > 0;
  }

  function cellLabel(i) {
    const row = Math.floor(i / 3) + 1;
    const col = (i % 3) + 1;
    const v = state.board[i];
    let label = `Row ${row}, column ${col}: ${v ? `${SIDES[v].name}, ${v}` : 'empty'}`;
    if (state.winLine && state.winLine.includes(i)) label += ', winning line';
    return label;
  }

  function addPiece(cell, side, animate) {
    const piece = document.createElement('span');
    piece.className = 'piece' + (animate ? ' stamp' : '');
    piece.innerHTML = Art.seal(side);
    cell.appendChild(piece);
    if (animate && !reducedMotion.matches) {
      const holder = document.createElement('span');
      holder.className = 'splash-holder';
      holder.innerHTML = Art.splash(side);
      cell.appendChild(holder);
      setTimeout(() => holder.remove(), 900);
    }
  }

  function updateRoving() {
    cells.forEach((c, i) => { c.tabIndex = i === focusIndex ? 0 : -1; });
  }

  function render(placedIndex = -1) {
    const playing = state.status === 'playing';
    boardEl.dataset.status = state.status;
    const thinking = isAiTurn();
    boardEl.dataset.turn = playing && !thinking ? state.current : '';
    boardEl.dataset.thinking = String(thinking);

    cells.forEach((cell, i) => {
      const v = state.board[i];
      const piece = cell.querySelector('.piece');
      if (v && !piece) addPiece(cell, v, i === placedIndex);
      if (!v && piece) piece.remove();
      if (v) cell.dataset.value = v;
      else delete cell.dataset.value;
      const inLine = !!(state.winLine && state.winLine.includes(i));
      cell.classList.toggle('win', inLine);
      cell.classList.toggle('dim', state.status === 'won' && !!v && !inLine);
      cell.setAttribute('aria-label', cellLabel(i));
      cell.setAttribute('aria-disabled', String(!playing || !!v));
    });
    updateRoving();

    if (state.status === 'won' && !winLayer.firstChild) {
      winLayer.innerHTML = Art.winLineSVG(state.winLine, state.winner);
    }

    for (const side of ['X', 'O']) {
      const c = cards[side];
      const active = playing && state.current === side;
      const winner = state.status === 'won' && state.winner === side;
      c.el.classList.toggle('active', active);
      c.el.classList.toggle('winner', winner);
      c.el.classList.toggle('thinking', active && thinking);
      c.pill.textContent = winner ? TEXT.pillWin : active && thinking ? TEXT.pillThinking : TEXT.pillTurn;
      const role = TEXT.role[prefs.mode][side];
      $(`role-${side}`).textContent = typeof role === 'function' ? role(prefs.level) : role;
      setScore(c.score, state.scores[side]);
    }
    $('round-label').textContent = `Round ${state.round}`;
    $('draws-label').textContent = `Draws ${state.scores.draws}`;

    let headline;
    let sub = '';
    if (state.status === 'won') {
      headline = TEXT.win[state.winner];
      sub = TEXT.playAgain;
    } else if (state.status === 'draw') {
      headline = TEXT.draw;
      sub = TEXT.playAgain;
    } else if (state.moves === 0) {
      headline = TEXT.roundStart;
      sub = TEXT.turn[state.current];
    } else {
      headline = TEXT.turn[state.current];
    }
    $('status').textContent = headline;
    $('status').dataset.tone = state.status === 'won' ? state.winner : '';
    $('sub').textContent = sub;
    $('new-round').classList.toggle('attention', !playing);
  }

  function setScore(el, value) {
    if (el.textContent === String(value)) return;
    el.textContent = String(value);
    el.classList.remove('bump');
    void el.offsetWidth; // restart the animation
    el.classList.add('bump');
  }

  function showHint(text, ms = 2600) {
    const hint = $('hint');
    hint.textContent = text;
    hint.classList.add('show');
    $('status-wrap').classList.add('hinting');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(hideHint, ms);
  }

  function hideHint() {
    clearTimeout(hintTimer);
    $('hint').classList.remove('show');
    $('status-wrap').classList.remove('hinting');
  }

  // ---- Actions --------------------------------------------------------------

  function onCell(i) {
    audio.init();
    if (busy) return;
    const res = L.play(state, i, prefs.mode === 'ai' ? HUMAN : state.current);
    if (!res.ok) {
      const reason = res.reason === 'not-your-turn' && isAiTurn() ? 'ai-thinking' : res.reason;
      showHint(TEXT.invalid[reason]);
      audio.invalid();
      const cell = cells[i];
      cell.classList.remove('reject');
      void cell.offsetWidth;
      cell.classList.add('reject');
      return;
    }
    applyMove(res.state, i);
  }

  function applyMove(next, i) {
    hideHint();
    state = next;
    render(i);
    audio.place(state.board[i]);
    if (state.status === 'won') setTimeout(() => audio.win(state.winner), 260);
    else if (state.status === 'draw') setTimeout(() => audio.draw(), 260);
    scheduleAi();
  }

  // Lets the computer play after a short, slightly irregular pause.
  function scheduleAi() {
    clearTimeout(aiTimer);
    if (!isAiTurn()) return;
    aiTimer = setTimeout(() => {
      if (busy || !isAiTurn()) return;
      const i = L.aiMove(state.board, COMPUTER, prefs.level);
      const res = L.play(state, i, COMPUTER);
      if (res.ok) applyMove(res.state, i);
    }, 550 + Math.random() * 450);
  }

  // Wipes the board with a short fade, then installs the next state.
  function transition(makeState, hint) {
    busy = true;
    clearTimeout(aiTimer);
    const finish = () => {
      boardEl.classList.remove('clearing');
      winLayer.innerHTML = '';
      state = makeState();
      render();
      showHint(hint(state.current), 3200);
      busy = false;
      scheduleAi();
    };
    if (reducedMotion.matches || state.moves === 0) {
      finish();
      return;
    }
    audio.swish();
    boardEl.classList.add('clearing');
    setTimeout(finish, 320);
  }

  async function onNewRound() {
    audio.init();
    audio.click();
    if (busy) return;
    if (L.isRoundInProgress(state)) {
      const ok = await confirmAction({
        title: 'Abandon this round?',
        body: 'The seals on the board will be cleared and no point will be awarded.',
        confirm: 'New round',
      });
      if (!ok) return;
    }
    transition(() => L.newRound(state), TEXT.alternate);
  }

  async function onReset() {
    audio.init();
    audio.click();
    if (busy) return;
    if (hasProgress()) {
      const ok = await confirmAction({
        title: 'Reset the game?',
        body: 'The current round and all scores will be lost. New lots will decide who begins.',
        confirm: 'Reset game',
      });
      if (!ok) return;
    }
    transition(() => L.resetGame(), TEXT.lots);
  }

  function confirmAction({ title, body, confirm }) {
    const dlg = $('confirm-dialog');
    if (typeof dlg.showModal !== 'function') return Promise.resolve(window.confirm(body));
    $('confirm-title').textContent = title;
    $('confirm-body').textContent = body;
    $('confirm-ok').textContent = confirm;
    dlg.returnValue = '';
    return new Promise((resolve) => {
      dlg.addEventListener('close', () => resolve(dlg.returnValue === 'confirm'), { once: true });
      dlg.showModal();
      $('confirm-cancel').focus();
    });
  }

  async function onModeChange(mode) {
    audio.init();
    audio.click();
    if (mode === prefs.mode) return;
    if (busy) {
      syncModeUI();
      return;
    }
    if (hasProgress()) {
      const ok = await confirmAction({
        title: TEXT.switchMode[mode],
        body: 'Changing opponent starts a new game: the current round and all scores will be lost.',
        confirm: 'Change opponent',
      });
      if (!ok) {
        syncModeUI();
        return;
      }
    }
    prefs.mode = mode;
    savePrefs(prefs);
    syncModeUI();
    transition(() => L.resetGame(), TEXT.lots);
  }

  function onLevelChange(level) {
    audio.init();
    audio.click();
    prefs.level = level;
    savePrefs(prefs);
    render();
  }

  function syncModeUI() {
    for (const input of document.querySelectorAll('input[name="mode"]')) input.checked = input.value === prefs.mode;
    for (const input of document.querySelectorAll('input[name="level"]')) input.checked = input.value === prefs.level;
    $('level-picker').hidden = prefs.mode !== 'ai';
  }

  function syncToggles() {
    $('music-toggle').setAttribute('aria-pressed', String(prefs.music));
    $('sfx-toggle').setAttribute('aria-pressed', String(prefs.sfx));
  }

  // ---- Events ---------------------------------------------------------------

  cellsEl.addEventListener('keydown', (e) => {
    const r = Math.floor(focusIndex / 3);
    const c = focusIndex % 3;
    let next = focusIndex;
    if (e.key === 'ArrowLeft' && c > 0) next -= 1;
    else if (e.key === 'ArrowRight' && c < 2) next += 1;
    else if (e.key === 'ArrowUp' && r > 0) next -= 3;
    else if (e.key === 'ArrowDown' && r < 2) next += 3;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 8;
    else return;
    e.preventDefault();
    focusIndex = next;
    updateRoving();
    cells[next].focus();
  });

  for (const input of document.querySelectorAll('input[name="mode"]')) {
    input.addEventListener('change', () => onModeChange(input.value));
  }
  for (const input of document.querySelectorAll('input[name="level"]')) {
    input.addEventListener('change', () => onLevelChange(input.value));
  }

  $('new-round').addEventListener('click', onNewRound);
  $('reset').addEventListener('click', onReset);

  $('music-toggle').addEventListener('click', () => {
    audio.init();
    prefs.music = !prefs.music;
    audio.setMusic(prefs.music);
    savePrefs(prefs);
    syncToggles();
  });

  $('sfx-toggle').addEventListener('click', () => {
    audio.init();
    prefs.sfx = !prefs.sfx;
    audio.setSfx(prefs.sfx);
    audio.click();
    savePrefs(prefs);
    syncToggles();
  });

  const fsBtn = $('fullscreen-toggle');
  // The Android app (which provides window.NativeAudio) is always full screen.
  if (!document.fullscreenEnabled || window.NativeAudio) {
    fsBtn.hidden = true;
  } else {
    fsBtn.addEventListener('click', async () => {
      audio.init();
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await document.documentElement.requestFullscreen();
          if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => {});
        }
      } catch (e) { /* fullscreen refused */ }
    });
    document.addEventListener('fullscreenchange', () => {
      fsBtn.setAttribute('aria-pressed', String(!!document.fullscreenElement));
    });
  }

  // Called by the Android app (MainActivity) when it is paused or resumed.
  window.TwoDragonsPause = (paused) => audio.setPaused(paused);

  // Audio can only start after a user gesture.
  const unlock = () => audio.init();
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });

  syncToggles();
  syncModeUI();
  render();
  showHint(TEXT.lots(state.current), 3600);
  scheduleAi();
})();
