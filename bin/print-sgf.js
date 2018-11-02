#!/usr/bin/env node
var Baduk = require('../src/sgf.js');

var everyStep = false;
process.argv.forEach(function(arg) {
  if (arg === "--steps") { everyStep = true; }
  else if (arg === "--help" || arg === "-h") {
    console.log("Display a saved Go game in the terminal.");
    console.log("Usage: print-sgf.js <game.sgf");
    console.log("  --help, -h: print this help message.");
    console.log("  --steps: display the screen at each turn.");
    process.exit(0);
  }
});

process.stdin.setEncoding('utf8');
var sgfContent = '';
process.stdin.on('readable', function() {
  sgfContent += String(process.stdin.read());
});
process.stdin.on('end', function() {
  var sgf = new Baduk.SGF();
  sgf.parse(sgfContent, {error: function(err) { console.error(err); }});
  if (everyStep) {
    console.log(sgf.board.toString());
    while (sgf.step()) {
      console.log(sgf.board.toString());
    }
  } else {
    sgf.run();
  }
  console.log(sgf.board.toString());
  var scores = sgf.board.scores();
  console.log("Score: ● " + scores.black + " ○ " + scores.white);
});
