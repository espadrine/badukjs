var assert = require('assert');
var Baduk = require('../src/api.js');
var SGF = Baduk.SGF;
var Board = Baduk.Board;

// Test moves and pass.
{
  var sgf = new SGF();
  var sgfContent = "(;B[bc];W[];B[ad];W[ac];B[ab];W[sr];B[tt])";
  sgf.parse(sgfContent, { error: function(err) { throw err; }});
  assert.equal(sgf.board.nextPlayingColor, Board.BLACK);
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
    SZ[18]
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
  assert.equal(sgf.content[0].sequence[0]["GM"], 1);
  assert.equal(sgf.content[0].sequence[0]["FF"], 4);
  assert.equal(sgf.content[0].sequence[0]["SZ"], 18);
  assert.equal(sgf.content[0].sequence[0]["PW"], "sai2004");
  assert.equal(sgf.content[0].sequence[0]["WR"], "7d");
  assert.equal(sgf.content[0].sequence[0]["PB"], "ponking66");
  assert.equal(sgf.content[0].sequence[0]["BR"], "4d");
  assert.equal(sgf.content[0].sequence[0]["DT"], "2007-01-01");
  assert.equal(sgf.content[0].sequence[0]["PC"],
    "The KGS Go Server at http://www.gokgs.com/");
  assert.equal(sgf.content[0].sequence[0]["KM"], 0.5);
  assert.equal(sgf.content[0].sequence[0]["RE"], "B+1.50");
  assert.equal(sgf.content[0].sequence[0]["RU"], "Japanese");
  assert.equal(sgf.content[0].sequence[0]["OT"], "3x30 byo-yomi");
  assert.equal(sgf.content[0].sequence[0]["CA"], "UTF-8");
  assert.equal(sgf.content[0].sequence[0]["ST"], 2);
  assert.deepEqual(sgf.content[0].sequence[0]["AP"], {
    app: "CGoban",
    version: "3"
  });
  assert.equal(sgf.content[0].sequence[0]["TM"], 2400);
  assert.equal(sgf.content[0].sequence[0]["HA"], 3);
  assert.deepEqual(sgf.content[0].sequence[0]["AB"], [
    {x: 15, y: 3}, {x: 3, y: 15}, {x: 15, y: 15}
  ]);

  sgf.run();
  assert.equal(sgf.board.size, 18);
  assert.equal(sgf.board.komi, 0.5);
  assert.equal(sgf.board.get(15, 3).color, Board.BLACK);
  assert.equal(sgf.board.get(3, 15).color, Board.BLACK);
  assert.equal(sgf.board.get(15, 15).color, Board.BLACK);
  assert.equal(sgf.board.get(2, 4).color, Board.WHITE);
  assert.equal(sgf.board.nextPlayingColor, Board.BLACK);
}

// Test next move and count move..
{
  var sgf = new SGF();
  var sgfContent = "(;HA[1]AB[pd];W[bc];C[comment];B[];W[ad];B[ac];W[tt])";
  sgf.parse(sgfContent, { error: function(err) { throw err; }});
  assert.equal(5, sgf.countMoves());
  assert.equal(sgf.board.nextPlayingColor, Board.WHITE);
  assert.deepEqual({x: 1, y: 2}, sgf.nextMove());
  assert.equal(true, sgf.step());
  assert.equal(sgf.board.nextPlayingColor, Board.BLACK);
  assert.deepEqual({x: -1, y: -1}, sgf.nextMove());
  assert.equal(true, sgf.step());
  assert.equal(sgf.board.nextPlayingColor, Board.WHITE);
  assert.deepEqual({x: 0, y: 3}, sgf.nextMove());
  assert.equal(true, sgf.step());
  assert.equal(sgf.board.nextPlayingColor, Board.BLACK);
  assert.deepEqual({x: 0, y: 2}, sgf.nextMove());
  assert.equal(true, sgf.step());
  assert.equal(sgf.board.nextPlayingColor, Board.WHITE);
  assert.deepEqual({x: -1, y: -1}, sgf.nextMove());
  assert.equal(false, sgf.step());
}

// Test board rotation.
{
  var sgf = new SGF();
  var sgfContent = "(;HA[1]AB[cb];W[db];B[sq];W[jl];B[bq];W[tt])";
  sgf.parse(sgfContent, { error: function(err) { throw err; }});
  sgf.rotate(1);
  sgf.run();
  assert.equal(sgf.board.get(17, 2).color, Board.BLACK);
  assert.equal(sgf.board.get(17, 3).color, Board.WHITE);
  assert.equal(sgf.board.get(2, 18).color, Board.BLACK);
  assert.equal(sgf.board.get(7,  9).color, Board.WHITE);
  assert.equal(sgf.board.get(2,  1).color, Board.BLACK);

  sgf.rotate(3);
  sgf.run();
  assert.equal(sgf.board.get( 2,  1).color, Board.BLACK);
  assert.equal(sgf.board.get( 3,  1).color, Board.WHITE);
  assert.equal(sgf.board.get(18, 16).color, Board.BLACK);
  assert.equal(sgf.board.get( 9, 11).color, Board.WHITE);
  assert.equal(sgf.board.get( 1, 16).color, Board.BLACK);

  sgf.flipHorizontally();
  sgf.run();
  assert.equal(sgf.board.get( 2, 17).color, Board.BLACK);
  assert.equal(sgf.board.get( 3, 17).color, Board.WHITE);
  assert.equal(sgf.board.get(18,  2).color, Board.BLACK);
  assert.equal(sgf.board.get( 9,  7).color, Board.WHITE);
  assert.equal(sgf.board.get( 1,  2).color, Board.BLACK);

  sgf.flipHorizontally();
  sgf.flipVertically();
  sgf.run();
  assert.equal(sgf.board.get(16,  1).color, Board.BLACK);
  assert.equal(sgf.board.get(15,  1).color, Board.WHITE);
  assert.equal(sgf.board.get( 0, 16).color, Board.BLACK);
  assert.equal(sgf.board.get( 9, 11).color, Board.WHITE);
  assert.equal(sgf.board.get(17, 16).color, Board.BLACK);
}
