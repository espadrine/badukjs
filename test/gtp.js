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
    assert.strictEqual(responses[i].toString(), '=\n\n',
      'Play response ' + (i + 1) + ' should be empty');
  }
  assert.strictEqual(responses[3].toString(), '=4\n\n',
    'Play response 4 should be empty; with id');

  // Test errors.

  var response = gtp.exec('play bLACK i883');
  assert.strictEqual(response.toString(), '? illegal move\n\n',
    'Play response with i abscissa should be an error');

  var response = gtp.exec('play w a0');
  assert.strictEqual(response.toString(), '? illegal move\n\n',
    'Play response with 0 ordinate should be an error');

  var response = gtp.exec('play gray a5');
  assert.strictEqual(response.toString(), '? illegal move\n\n',
    'Play response with invalid color should be an error');

  var response = gtp.exec('8 play gray a5');
  assert.strictEqual(response.toString(), '?8 illegal move\n\n',
    'Play response with id should be an error with id');

  var response = gtp.exec('9 play b pass');
  assert.strictEqual(response.toString(), '=9\n\n',
    'Play pass response with id');
}

// Test administrative commands
{
  var board = new Board();
  var gtp = new GTP({board});

  var response = gtp.exec('protocol_version');
  assert.strictEqual(response.toString(), '= 2\n\n',
    'Protocol version should be 2');

  var response = gtp.exec('name');
  assert.strictEqual(response.toString(), '= badukjs\n\n',
    'Name should be badukjs');

  var response = gtp.exec('version');
  assert.strictEqual(response.toString(), '= ' + GTP.version + '\n\n',
    'Version should match');

  var response = gtp.exec('known_command known_command');
  assert.strictEqual(response.toString(), '= true\n\n',
    'known_command should be a known command');

  var response = gtp.exec('known_command unknown_command');
  assert.strictEqual(response.toString(), '= false\n\n',
    'unknown_command should be an unknown command');

  var response = gtp.exec('known_command');
  assert.strictEqual(response.toString(), '= false\n\n',
    'The empty command should be an unknown command');

  var response = gtp.exec('list_commands');
  assert(/^= protocol_version\n[a-z_\n]+\nplay/.test(response.toString()),
    'The list_commands command lists play');
}

// Test invalid command
{
  var board = new Board();
  var gtp = new GTP({board});

  var response = gtp.exec('invalid_command');
  assert.strictEqual(response.toString(), '? unknown command\n\n',
    'Unknown command');

  var response = gtp.exec('2 invalid_command');
  assert.strictEqual(response.toString(), '?2 unknown command\n\n',
    'Unknown command with id');
}
