var assert = require('assert');
var Baduk = require('../src/api.js');
var GTP = Baduk.GTP;
var Board = Baduk.Board;

// Test playing
{
  var board = new Board();
  var gtp = new GTP({board});

  gtp.exec('play white a19');
  gtp.exec('play B B19');
  gtp.exec('play w a18');
  gtp.exec('play bLACK B18');

  assert.equal(gtp.stream.errors.length, 0);
  assert.equal(board.get(0, 0).color, Board.WHITE);
  assert.equal(board.get(1, 0).color, Board.BLACK);
  assert.equal(board.get(0, 1).color, Board.WHITE);
  assert.equal(board.get(1, 1).color, Board.BLACK);
  console.log(board.toString());
}
