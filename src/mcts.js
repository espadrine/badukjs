var Baduk = require('./board.js');
var Board = Baduk.Board;

function MoveEdge(parent, move) {
  this.parent = parent;
  this.move = move;
  this.guessScore = 0;
  this.winCount = 0;
  this.totalCount = 0;
  this.score = 0;
  this.tree = null;
}

MoveEdge.prototype = {
  saveScore: function() { this.score = this.computeScore(); },
  computeScore: function() {
    if (this.totalCount === 0) { return 0; }
    return this.winCount / this.totalCount;
  },
  addGame: function(isWin) {
    var oldScore = this.parent.bestMoveScore;
    this.totalCount++;
    if (isWin) { this.winCount++; }
    this.saveScore();
    if (this.score > oldScore) {
      this.parent.bestMove = this.move;
      this.parent.bestMoveScore = this.score;
    } else {
      // The score has decreased; a different move may be better.
      this.parent.saveBestMove();
    }
    //console.error('Updated best move to', Board.coordFromMove(this.parent.bestMove), this.parent.bestMove.score, '(' + this.parent.bestMoveScore + ')');
  },

  expand: function() {
    var nextGameMoves = this.parent.gameMoves.slice().concat(this.move);
    this.tree = new TreeNode(this.parent.moveGuesser, nextGameMoves);
  },
};

function TreeSearch(moveGuesser, gameMoves) {
  this.moveGuesser = moveGuesser;
  this.root = new TreeNode(moveGuesser, gameMoves);
}

TreeSearch.prototype = {
  guess: function(board, prevMove) {
    if (prevMove) { this.movePlayed(prevMove); }
    var bestMove = this.root.bestMove;
    //console.error('Picking move', Board.coordFromMove(bestMove), 'with score', this.root.bestMoveScore);
    this.movePlayed(bestMove);
    return bestMove;
  },

  movePlayed: function(move) {
    var moveEdge = this.root.moves.get(hashFromMove(move));
    if (moveEdge === undefined) {
      moveEdge = new MoveEdge(this.root, {x: move.x, y: move.y});
    }
    if (moveEdge.tree === null) { moveEdge.expand(); }
    this.root = moveEdge.tree;
  },

  simulate: function() {
    var board = this.root.makeBoard();
    var nodeColor = board.nextPlayingColor;

    // Walk through the tree to find the best current path.
    var ancestry = [];  // List of MoveEdge.
    var bestLeaf = this.root;
    for (;;) {
      var iterCount = 0;
      do {
        var bestMove = bestLeaf.pickMove();
        var bestMoveEdge = bestLeaf.moves.get(hashFromMove(bestMove));
        //console.error(Board.coordFromMove(bestMove), bestMoveEdge.score);
        ancestry.push(bestMoveEdge);
        var valid = board.play(bestMove.x, bestMove.y);
        iterCount++;
      } while (!valid && iterCount < POSSIBLE_MOVE_SAMPLING);
      if (bestMoveEdge.tree === null) { break; }
      bestLeaf = bestMoveEdge.tree;
    }

    // Perform a playout from that leaf.
    var prevMove = bestMove;
    var prevPassed = false;
    while (board.numMoves < 300) {
      var possibleMoves = this.moveGuesser.guess(board, prevMove).moves;
      do {
        var move = possibleMoves[(Math.random() * possibleMoves.length)|0];
      } while (!board.isValidMove(move.x, move.y));
      prevMove = move;
      if (move.x < 0) {
        if (prevPassed) {
          break;  // Double pass.
        } else {
          prevPassed = true;
          continue;
        }
      }
      var valid = board.play(move.x, move.y);
      if (!valid) { break; }
      //console.log('Ongoing playout: ' + move.x + ',' + move.y + '\n' + board.toString());
      prevPassed = false;
    }

    // Backpropagation of scores through the ancestry.
    var isWin = board.winner() === nodeColor;
    //console.log('Move ' + Board.coordFromMove(bestMove) + ' was ' + (isWin? '': 'not ') + 'a win');
    for (var i = ancestry.length - 1; i >= 0; i--) {
      var ancestor = ancestry[i];
      ancestor.addGame(isWin);
      if (ancestor.winCount >= EXPANSION_WIN_COUNT) {
        ancestor.expand();
      }
    }
  },

  simulateNTimes: function(n) {
    n = n|0;
    for (var i = 0; i < n; i++) {
      this.simulate();
    }
  },
};

function TreeNode(moveGuesser, gameMoves) {
  this.moveGuesser = moveGuesser;
  // List of moves performed since beginning of game.
  this.gameMoves = gameMoves || [];
  this.moves = new Map();
  this.possibleMoves = [];
  this.bestMove = {x: -1, y: -1, score: 0};
  this.bestMoveScore = 0;
  this.possibleMovesIdx = 0;
  this.expand();
}

TreeNode.prototype = {
  pickMove: function() {
    // FIXME: use score.
    //var bestMoveEdge = this.moves.get(hashFromMove(this.bestMove));
    var move = this.possibleMoves[this.possibleMovesIdx];
    this.possibleMovesIdx = (this.possibleMovesIdx + 1) % this.possibleMoves.length;
    return move;
  },

  // Build a board that has played all moves up to this point.
  makeBoard: function() {
    var board = new Board();
    for (var i = 0; i < this.gameMoves.length; i++) {
      var move = this.gameMoves[i];
      board.play(move.x, move.y);
    }
    return board;
  },

  expand: function() {
    var board = this.makeBoard();
    var prevMove = this.gameMoves[this.gameMoves.length - 1];
    var move = this.moveGuesser.guess(board, prevMove);
    var possibleMoves = move.moves;
    possibleMoves = possibleMoves.sort(function(a, b) { return b.score - a.score; });
    this.possibleMoves = possibleMoves.slice(0, POSSIBLE_MOVE_SAMPLING);
    this.bestMove = possibleMoves[0];
    // Pass move
    this.moves.set(-20, new MoveEdge(this, {x: -1, y: -1}));
    for (var i = 0; i < possibleMoves.length; i++) {
      this.moves.set(hashFromMove(possibleMoves[i]),
        new MoveEdge(this, possibleMoves[i]));
    }
  },

  saveBestMove: function() {
    var bestMove = {x: -1, y: -1};
    var bestMoveScore = 0;
    this.moves.forEach(function(edge, moveHash) {
      if (bestMoveScore < edge.score) {
        bestMoveScore = edge.score;
        bestMove = moveFromHash(moveHash);
      }
    });
    if (bestMoveScore > this.bestMoveScore) {
      this.bestMove = bestMove;
      this.bestMoveScore = bestMoveScore;
    }
  },
};

function hashFromMove(move) {
  return move.x + move.y * 19;
}

function moveFromHash(hash) {
  var y = (hash / 19)|0;
  var x = hash % 19;
  return { x: x, y: y };
}

var EXPANSION_WIN_COUNT = 2;
var POSSIBLE_MOVE_SAMPLING = 16;

module.exports = TreeSearch;
