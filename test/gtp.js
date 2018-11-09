var assert = require('assert');
var Baduk = require('../src/api.js');
var GTP = Baduk.GTP;
var Board = Baduk.Board;

// Test playing
{
  var board = new Board();
  var gtp = new GTP({board});

  var responses = [];
  responses.push(gtp.exec('play white a19'));
  responses.push(gtp.exec('play B B19'));
  responses.push(gtp.exec('play w a18'));
  responses.push(gtp.exec('4 play bLACK B18'));

  assert.strictEqual(gtp.stream.errors.length, 0);
  assert.strictEqual(board.get(0, 0).color, Board.WHITE);
  assert.strictEqual(board.get(1, 0).color, Board.BLACK);
  assert.strictEqual(board.get(0, 1).color, Board.WHITE);
  assert.strictEqual(board.get(1, 1).color, Board.BLACK);

  // Check responses.
  for (var i = 0; i < 3; i++) {
    assert.strictEqual(responses[i].toString(), '=',
      'Play response ' + (i + 1) + ' should be empty');
  }
  assert.strictEqual(responses[3].toString(), '=4',
    'Play response 4 should be empty; with id');
}
