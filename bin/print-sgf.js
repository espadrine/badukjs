#!/usr/bin/env node
var Baduk = require('../src/sgf.js');
process.stdin.setEncoding('utf8');
var sgfContent = '';
process.stdin.on('readable', function() {
  sgfContent += String(process.stdin.read());
});
process.stdin.on('end', function() {
  var sgf = new Baduk.SGF();
  sgf.parse(sgfContent, {error: function(err) { console.error(err); }});
  sgf.run();
  console.log(sgf.board.toString());
});
