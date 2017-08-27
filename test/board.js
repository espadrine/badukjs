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
  board.pass();
  board.play(4, 0);
  board.pass();
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
  board.pass();
  board.play(0, 1);
  board.pass();
  board.play(1, 0);
  board.pass();
  board.play(2, 1);
  board.pass();
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
  board.pass();
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

// Test numMoves and intersection turnPlayed.
{
  board = new Board();

  board.play(0, 0);
  board.play(1, 0);
  board.play(2, 0);
  // oxo

  assert.equal(board.numMoves, 3);
  assert.equal(board.get(0, 0).turnPlayed, 0);
  assert.equal(board.get(1, 0).turnPlayed, 1);
  assert.equal(board.get(2, 0).turnPlayed, 2);
  assert.equal(board.get(3, 0).turnPlayed, -1);
}

// Test capturesFromMove, selfAtariFromMove, libertiesFromMove, sensibleMove.
{
  board = new Board();

  board.play(1, 0);
  board.play(2, 0);
  board.play(4, 0);
  board.pass();
  board.play(0, 1);
  board.pass();
  board.play(3, 1);
  //  xo x
  // x  x

  assert(!board.isValidMove(0, 0));
  var intersection = board.get(0, 0);
  assert(!intersection.sensibleMove);
  assert.equal(intersection.selfAtariFromMove, 0);
  assert.equal(intersection.capturesFromMove, 0);
  assert.equal(intersection.libertiesFromMove, 0);
  assert(board.isValidMove(3, 0));
  var intersection = board.get(3, 0);
  assert(intersection.sensibleMove);
  assert.equal(intersection.selfAtariFromMove, 2);
  assert.equal(intersection.libertiesFromMove, 1);

  board.play(3, 0);
  //  xoox
  // x  x

  assert(board.isValidMove(2, 1));
  var intersection = board.get(2, 1);
  assert.equal(intersection.capturesFromMove, 2);
  // FIXME: Technically, libertiesFromMove should be 6,
  // but that's harder to compute.
  assert.equal(intersection.libertiesFromMove, 5);
}

// Test ko rule
{
  board = new Board();

  board.play(1, 0);
  board.play(2, 0);
  board.play(0, 1);
  board.play(3, 1);
  board.play(1, 2);
  board.play(2, 2);
  board.play(2, 1);
  //  xo
  // x xo
  //  xo

  assert(board.isValidMove(1, 1));
  var intersection = board.get(1, 1);
  assert(intersection.sensibleMove);
  assert(board.play(1, 1));

  // Try to play the Ko.
  //  xo
  // xo.o
  //  xo
  assert(!board.isValidMove(2, 1));
  var intersection = board.get(2, 1);
  assert(!intersection.sensibleMove);
  assert(!board.play(2, 1));

  // Play elsewhere.
  assert(board.play(0, 0));
  board.pass();

  // Play the Ko again.
  assert(board.isValidMove(2, 1));
  var intersection = board.get(2, 1);
  assert(intersection.sensibleMove);
  assert(board.play(2, 1));
}

// Test superko rule
{
  board = new Board();

  board.play(1, 0); board.play(2, 0); board.play(0, 1); board.play(3, 1);
  board.play(1, 2); board.play(2, 2); board.play(2, 1);
  //  xo
  // x xo
  //  xo
  board.play(4, 0); board.play(5, 0); board.play(4, 2); board.play(5, 2);
  board.play(5, 1); board.play(6, 1); board.pass();
  //  xo ox
  // x xo ox
  //  xo ox
  board.play(7, 0); board.play(8, 0); board.play(7, 2); board.play(8, 2);
  board.play(8, 1); board.play(9, 1); board.pass();
  //  xo ox xo
  // x xo ox xo
  //  xo ox xo

  board.play(1, 1); board.play(4, 1); board.play(7, 1);
  //  xo ox xo
  // xo.ox.xo.o
  //  xo ox xo

  board.play(2, 1); board.play(5, 1);
  //  xo ox xo
  // x.xo.oxo o
  //  xo ox xo

  // Try to play the Superko.
  assert(!board.isValidMove(8, 1));
  var intersection = board.get(8, 1);
  assert(!intersection.sensibleMove);
  assert(!board.play(8, 1));

  // Play elsewhere.
  assert(board.play(0, 0));
  board.pass();

  // Play the Ko again.
  assert(board.isValidMove(8, 1));
  var intersection = board.get(8, 1);
  assert(intersection.sensibleMove);
  assert(board.play(8, 1));
}
