var assert = require('assert');
var Baduk = require('../src/api.js');
var SGF = Baduk.SGF;
var Board = Baduk.Board;

// Test moves and pass.
{
  var sgf = new SGF();
  var sgfContent = "(;B[bc];W[];B[ad];W[ac];B[ab];W[sr];B[tt])";
  sgf.parse(sgfContent, { error: function(err) { throw err; }});
  sgf.run();
  assert.equal(sgf.board.get(0, 0).color, Board.EMPTY);
  assert.equal(sgf.board.get(1, 2).color, Board.BLACK);
  assert.equal(sgf.board.get(0, 1).color, Board.BLACK);
  assert.equal(sgf.board.get(0, 3).color, Board.BLACK);
  assert.equal(sgf.board.get(0, 2).color, Board.EMPTY);
  assert.equal(sgf.board.get(18, 17).color, Board.WHITE);
  assert.equal(sgf.board.get(18, 18).color, Board.EMPTY);
  assert.equal(sgf.board.get(19, 19), undefined);
  assert.equal(sgf.board.nextPlayingColor, Board.WHITE);
}
