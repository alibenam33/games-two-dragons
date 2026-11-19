// Pure game rules for Two Dragons. No DOM access: every function takes a state
// and returns a new one, so the rules can be tested in isolation (tests/logic.test.html).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TwoDragonsLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const X = 'X'; // Jade Dragon
  const O = 'O'; // Vermilion Phoenix

  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6],            // diagonals
  ];

  function other(side) {
    return side === X ? O : X;
  }

  function drawStarter(rng = Math.random) {
    return rng() < 0.5 ? X : O;
  }

  function freshRound(starter) {
    return {
      board: Array(9).fill(null),
      current: starter,
      starter,
      status: 'playing', // 'playing' | 'won' | 'draw'
      winner: null,
      winLine: null,
      moves: 0,
    };
  }

  function createGame(rng = Math.random) {
    return { ...freshRound(drawStarter(rng)), scores: { X: 0, O: 0, draws: 0 }, round: 1 };
  }

  function findWin(board) {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line: line.slice() };
      }
    }
    return null;
  }

  // Returns { ok: true, state } or { ok: false, reason, state } where state is
  // the untouched input. Reasons: 'round-over', 'out-of-bounds', 'not-your-turn', 'occupied'.
  function play(state, index, side = state.current) {
    if (state.status !== 'playing') return { ok: false, reason: 'round-over', state };
    if (!Number.isInteger(index) || index < 0 || index > 8) return { ok: false, reason: 'out-of-bounds', state };
    if (side !== state.current) return { ok: false, reason: 'not-your-turn', state };
    if (state.board[index] !== null) return { ok: false, reason: 'occupied', state };

    const board = state.board.slice();
    board[index] = side;
    const next = { ...state, board, moves: state.moves + 1, scores: { ...state.scores } };

    // Win is checked before draw: the ninth move can be a winning one.
    const win = findWin(board);
    if (win) {
      next.status = 'won';
      next.winner = side;
      next.winLine = win.line;
      next.scores[side] += 1;
    } else if (board.every((cell) => cell !== null)) {
      next.status = 'draw';
      next.scores.draws += 1;
    } else {
      next.current = other(side);
    }
    return { ok: true, state: next };
  }

  // Clears the board, keeps scores, and alternates who begins (even after a draw).
  function newRound(state) {
    return { ...state, ...freshRound(other(state.starter)), round: state.round + 1 };
  }

  // Clears the board, zeroes scores, and draws lots again for the first player.
  function resetGame(rng = Math.random) {
    return createGame(rng);
  }

  function isRoundInProgress(state) {
    return state.status === 'playing' && state.moves > 0;
  }

  // ---- Computer opponent ----------------------------------------------------

  function emptyCells(board) {
    const out = [];
    board.forEach((cell, i) => { if (cell === null) out.push(i); });
    return out;
  }

  function winsAt(board, index, side) {
    const next = board.slice();
    next[index] = side;
    const win = findWin(next);
    return !!win && win.winner === side;
  }

  // Negamax-style search scored from `me`'s point of view; faster wins and
  // slower losses score higher. Memoised per search on the board contents.
  function minimax(board, toMove, me, depth, memo) {
    const key = board.map((c) => c || '-').join('');
    if (memo.has(key)) return memo.get(key);
    const win = findWin(board);
    let score;
    if (win) score = win.winner === me ? 10 - depth : depth - 10;
    else if (board.every((c) => c !== null)) score = 0;
    else {
      score = toMove === me ? -Infinity : Infinity;
      for (const i of emptyCells(board)) {
        board[i] = toMove;
        const s = minimax(board, other(toMove), me, depth + 1, memo);
        board[i] = null;
        score = toMove === me ? Math.max(score, s) : Math.min(score, s);
      }
    }
    memo.set(key, score);
    return score;
  }

  // All moves with the best minimax score for `side`.
  function bestMoves(board, side) {
    const memo = new Map();
    const work = board.slice();
    let best = -Infinity;
    let moves = [];
    for (const i of emptyCells(work)) {
      work[i] = side;
      const s = minimax(work, other(side), side, 1, memo);
      work[i] = null;
      if (s > best) { best = s; moves = [i]; }
      else if (s === best) moves.push(i);
    }
    return moves;
  }

  // Chooses a cell for the computer. Levels:
  //  easy   — mostly random, takes an immediate win only half the time;
  //  normal — always wins or blocks when it can, otherwise plays well half the time;
  //  hard   — perfect play (cannot be beaten).
  function aiMove(board, side, level = 'normal', rng = Math.random) {
    const empty = emptyCells(board);
    if (!empty.length) return -1;
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const winning = empty.filter((i) => winsAt(board, i, side));
    if (level === 'easy') {
      return winning.length && rng() < 0.5 ? pick(winning) : pick(empty);
    }
    if (level === 'normal') {
      if (winning.length) return pick(winning);
      const blocking = empty.filter((i) => winsAt(board, i, other(side)));
      if (blocking.length) return pick(blocking);
      return rng() < 0.5 ? pick(empty) : pick(bestMoves(board, side));
    }
    return pick(bestMoves(board, side));
  }

  return { X, O, LINES, other, createGame, findWin, play, newRound, resetGame, isRoundInProgress, aiMove };
});
