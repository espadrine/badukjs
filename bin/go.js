#!/usr/bin/env node
var fs = require('fs');
var childProcess = require('child_process');
var Baduk = require('../src/sgf.js');
var Board = Baduk.Board;

function getMoveFromStream(stream, player, cb) {
  var buffer = '';
  stream.once('data', function(chunk) {
    process.stderr.write(String(chunk));
    buffer += String(chunk);
    var move = parseInput(buffer, player);
    if (move !== undefined) {
      buffer = '';
      cb(move);
    }
    else { getMoveFromStream(stream, player, cb); }
  });
};

function buildPlayer(source) {
  if (source[0] === '/') {  // From a file.
    var readStream = fs.createReadStream(source);
    return {
      type: 'file',
      play: function(board, prevMove, cb) {
        getMoveFromStream(readStream, this, cb);
      },
    };
  } else if (/^probaduk:/.test(source)) {
    var match = /^probaduk:(.*)$/.exec(source);
    var jsonBrain = require(match[1]);
    var Probaduk = require('../src/ai/probaduk/decision-tree.js');
    var weakMoveGuesser = Probaduk.load(jsonBrain);
    var MCTS = require('../src/mcts.js');
    var moveGuesser = new MCTS(weakMoveGuesser);
    return {
      type: 'ai',
      play: function(board, prevMove, cb) {
        if (board.moves > 500) { cb({x:-1}); return; }
        moveGuesser.movePlayed(prevMove);
        moveGuesser.simulateNTimes(256);
        cb(moveGuesser.guess(board));
      },
    };
  } else {  // From a process.
    var atoms = source.split(/\s+/);
    var process = childProcess.spawn(atoms[0], atoms.slice(1), {shell: true});
    return {
      type: atoms[0],
      play: function(board, prevMove, cb) {
        if (prevMove) {
          var moveStr = displayGnuGoMove(prevMove) + "\n";
          process.stdin.write(moveStr);
        }
        getMoveFromStream(process.stdout, this, cb);
      },
    };
  }
}

var whitePlayer, blackPlayer;
process.argv.forEach(function(arg) {
  if (/^--white=.*$/.test(arg)) {
    var match = /^--white=(.*)$/.exec(arg);
    whitePlayer = buildPlayer(match[1]);
  } else if (/^--black=.*$/.test(arg)) {
    var match = /^--black=(.*)$/.exec(arg);
    blackPlayer = buildPlayer(match[1]);
  }
});

function parseInput(input, player) {
  input = input.trim();
  if (player.type === 'gnugo') {
    if (/(black|white)\(\d+\): [a-zA-Z]\d+/.test(input)) {
      var match = /(black|white)\(\d+\): ([a-zA-Z])(\d+)/.exec(input);
      var color = match[1];
      var colorPlayer = color === 'black'? blackPlayer: whitePlayer;
      if (player !== colorPlayer) { return; }
      var x = rowNumFromGnuGoName(match[2]);
      var y = board.size - (+match[3]);
      return {x: x, y: y};
    } else if (/(black|white)\(\d+\): PASS/.test(input)) {
      return {x: -1, y: -1};
    }
  } else {
    if (/^[a-zA-Z]{2}$/.test(input)) {
      var x = rowNumFromName(input[0]);
      var y = rowNumFromName(input[1]);
      return {x: x, y: y};
    } else if (/^[a-zA-Z]\d+$/.test(input)) {
      var match = /([a-zA-Z])(\d+)/.exec(input);
      var x = rowNumFromGnuGoName(match[1]);
      var y = board.size - (+match[2]);
      return {x: x, y: y};
    } else if (/(^\s*$)|PASS/.test(input)) {
      return {x: -1, y: -1};
    }
  }
}

function rowNumFromName(char) {
  if (/[a-z]/.test(char)) {
    return char.charCodeAt(0) - 'a'.charCodeAt(0);
  } else if (/[A-Z]/.test(char)) {
    return char.charCodeAt(0) - 'A'.charCodeAt(0) + 26;
  }
}

function rowNumFromGnuGoName(char) {
  if (/[a-h]/.test(char)) {
    return char.charCodeAt(0) - 'a'.charCodeAt(0);
  } else if (/[A-H]/.test(char)) {
    return char.charCodeAt(0) - 'A'.charCodeAt(0);
  } else if (/[j-z]/.test(char)) {
    return char.charCodeAt(0) - 'b'.charCodeAt(0);
  } else if (/[J-Z]/.test(char)) {
    return char.charCodeAt(0) - 'B'.charCodeAt(0);
  }
}

function displayMove(move) {
  var s = '';
  s += String.fromCharCode('a'.charCodeAt(0) + move.x);
  s += String.fromCharCode('a'.charCodeAt(0) + move.y);
  return s;
}

function displayGnuGoMove(move) {
  var s = '';
  if (move.x < 8) { s += String.fromCharCode('A'.charCodeAt(0) + move.x); }
  else { s += String.fromCharCode('B'.charCodeAt(0) + move.x); }
  s += String(19 - move.y);
  return s;
}

var prevMove;
function playMove(move) {
  if (!move) { return; }
  if (move.x < 0) {
    board.pass();
    var validMove = true;
  } else {
    var validMove = board.play(move.x, move.y);
  }
  if (!validMove) { console.error('Invalid move'); }
  prevMove = move;
  console.error(displayMove(move));
  console.error(displayGnuGoMove(move));
  displayBoard(board);
  return validMove;
}

function displayBoard(board) {
  console.error(board.toString());
  console.error(Board.stringFromColor(board.nextPlayingColor) +
    "'s turn. Enter move (column, then row; eg. 'as' for bottom left):");
}

if (!blackPlayer) { blackPlayer = buildPlayer('/dev/stdin'); }
if (!whitePlayer) { whitePlayer = buildPlayer('/dev/stdin'); }
var players = [blackPlayer, whitePlayer];

function blackPlayerPlays() {
  blackPlayer.play(board, prevMove, function(move) {
    var validMove = playMove(move);
    if (!validMove) { return; }
    if (prevMove && prevMove.x < 0 && move.x < 0) { return; }
    whitePlayerPlays();
  });
}

function whitePlayerPlays() {
  whitePlayer.play(board, prevMove, function(move) {
    var validMove = playMove(move);
    if (!validMove) { return; }
    if (prevMove && prevMove.x < 0 && move.x < 0) { return; }
    blackPlayerPlays();
  });
}

var board = new Board();
displayBoard(board);
blackPlayerPlays();
