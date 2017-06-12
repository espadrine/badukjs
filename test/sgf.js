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

// Test metadata.
{
  var sgf = new SGF();
  var sgfContent = `
    (;GM[1]
    FF[4]
    SZ[19]
    PW[sai2004]
    WR[7d]
    PB[ponking66]
    BR[4d]
    DT[2007-01-01]
    PC[The KGS Go Server at http://www.gokgs.com/]
    KM[0.50]
    RE[B+1.50]
    RU[Japanese]OT[3x30 byo-yomi]CA[UTF-8]ST[2]AP[CGoban:3]TM[2400]HA[3]AB[pd][dp][pp]
    ;W[ce])`;
  sgf.parse(sgfContent, { error: function(err) { throw err; }});
  sgf.run();
}
