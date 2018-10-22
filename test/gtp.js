var assert = require('assert');
var Baduk = require('../src/api.js');
var GTP = Baduk.GTP;
var Board = Baduk.Board;

// Test playing
{
  var board = new Board();
  var gtp = new GTP({board});

  gtp.exec('play white a19');

  assert.equal(gtp.stream.errors.length, 0);
  assert.equal(board.get(0, 0).color, Board.WHITE);
}
