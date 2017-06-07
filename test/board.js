var assert = require('assert');
var Baduk = require('../src/board.js');
var Board = Baduk.Board;

// Test simultaneous capture of multiple groups,
// one of which has multiple stones.
{
  var board = new Board();

  board.play(0, 0);
  board.play(0, 1);
  board.play(1, 0);
  board.play(1, 1);
  board.play(3, 0);
  board.play(3, 1);
  board.play(10, 0);
  board.play(4, 0);
  board.play(10, 1);
  // oo ox
  // xx x
  board.play(2, 0);

  assert.equal(board.get(0, 0).color, Board.EMPTY);
  assert.equal(board.get(1, 0).color, Board.EMPTY);
  assert.equal(board.get(3, 0).color, Board.EMPTY);
}

// Test suicide when surrounded by the enemy.
{
  board = new Board();

  // This stone makes it so we are actually surrounded by three groups.
  board.play(0, 0);
  board.play(10, 0);
  board.play(0, 1);
  board.play(10, 1);
  board.play(1, 0);
  board.play(10, 2);
  board.play(2, 1);
  board.play(10, 3);
  board.play(1, 2);
  // xx
  // x x
  //  x
  board.play(1, 1);

  assert.equal(board.get(1, 1).color, Board.EMPTY);
  assert.equal(board.nextPlayingColor, Board.WHITE);
}

// Test suicide when surrounded in a corner.
{
  board = new Board();

  board.play(1, 0);
  board.play(10, 0);
  board.play(0, 1);
  //  x
  // x
  board.play(0, 0);

  assert.equal(board.get(0, 0).color, Board.EMPTY);
  assert.equal(board.nextPlayingColor, Board.WHITE);
}

// Test suicide when in a group, surrounded by the enemy.
{
  board = new Board();

  board.play(0, 2);
  board.play(0, 1);
  board.play(1, 1);
  board.play(1, 0);
  board.play(2, 0);
  //  ox
  // ox
  // x
  board.play(0, 0);

  assert.equal(board.get(0, 0).color, Board.EMPTY);
  assert.equal(board.nextPlayingColor, Board.WHITE);
}
