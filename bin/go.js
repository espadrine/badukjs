#!/usr/bin/env node
var Baduk = require('../src/board.js');
var Board = Baduk.Board;

function rowNumFromName(char) {
  if (/[a-z]/.test(char)) {
    return char.charCodeAt(0) - 97;
  } else if (/[A-Z]/.test(char)) {
    return char.charCodeAt(0) - 65 + 26;
  }
}

function displayBoard(board) {
  console.error(board.toString());
  console.error(Board.stringFromColor(board.nextPlayingColor) +
    "'s turn. Enter move (column, then row; eg. 'as' for bottom left):");
}

var board = new Board();
displayBoard(board);

process.stdin.on('data', function(chunk) {
  var data = String(chunk);
  if (/[a-zA-Z]{2}/.test(data)) {
    var x = rowNumFromName(data[0]);
    var y = rowNumFromName(data[1]);
    board.play(x, y);
  } else if (/\W/.test(data)) {
    board.pass();
  }
  displayBoard(board);
});
