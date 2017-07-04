#!/usr/bin/env node
var Baduk = require('../src/sgf.js');

var everyStep = false;
process.argv.forEach(function(arg) {
  if (arg === "--steps") { everyStep = true; }
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
  console.log("Black: " + scores.black + ", White: " + scores.white);
});
