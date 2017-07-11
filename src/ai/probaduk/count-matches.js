var fs = require('fs');
var path = require('path');
var Baduk = require('../../sgf.js');
var SGF = Baduk.SGF;
var Mask = require('./mask.js');

var sgf = new SGF();
var mask = new Mask.Mask2();

function aggregateFromGame(sgf) {
  while (sgf.step()) {
    var move = sgf.nextMove();
    mask.readFromBoard(sgf.board, move);
  }
}

function computeSgf(sgfContent, filename) {
  sgf.parse(String(sgfContent), {filename: filename, error: console.error});
  // Perform this for each game symmetry and reflection.
  aggregateFromGame(sgf);
  for (var i = 0; i < 3; i++) {
    sgf.rotate(1);
    aggregateFromGame(sgf);
  }
  sgf.flipHorizontally();
  aggregateFromGame(sgf);
  for (var i = 0; i < 3; i++) {
    sgf.rotate(1);
    aggregateFromGame(sgf);
  }
}

// Compute the number of correct guesses and overall guesses [correct, total].
function guessGame(sgfContent, filename) {
  sgf.parse(String(sgfContent), {filename: filename, error: console.error});
  var correct = 0;
  var total = 0;
  while (sgf.step()) {
    var move = sgf.nextMove();
    if (move.x < 0) { continue; }
    var guess = mask.guess(sgf.board);
    if (guess.x === move.x && guess.y === move.y) {
      correct++;
    }
    total++;
  }
  return [correct, total];
}

var sgfDir = path.join(__dirname, '../../../sgf/kgs4d');
var files = fs.readdirSync(sgfDir);
var trainingSize = 500;
var validationSize = 100;
var trainingSet = files.slice(0, trainingSize);
var validationSet = files.slice(trainingSize, trainingSize + validationSize);
console.error('start training');

t0 = +Date.now();
trainingSet.forEach(function(filename) {
  var sgfContent = fs.readFileSync(path.join(sgfDir, filename));
  computeSgf(sgfContent, filename);
});
t1 = +Date.now();
console.error('training: ' + (t1 - t0).toPrecision(3) + 'ms');

// Output the mask matches.
var output = mask.toJSON();
console.log(JSON.stringify(output));

mask = (new Mask.Mask2()).load(output);
var correct = 0;
var total = 0;
var vt0 = +Date.now();
validationSet.forEach(function(filename) {
  var sgfContent = fs.readFileSync(path.join(sgfDir, filename));
  var accuracy = guessGame(sgfContent, filename);
  correct += accuracy[0];
  total += accuracy[1];
});
var vt1 = +Date.now();
console.error('validation: ' + (vt1 - vt0).toPrecision(3) + 'ms');
var accuracy = correct / total;
var timePerGuess = ((vt1 - vt0) / total / 1000);  // in s.
console.error('Accuracy: ' + correct + '/' + total +
  ' (' + (accuracy * 100).toPrecision(3) + '%), ' +
  'time: ' + timePerGuess.toPrecision(3) + 's, ' +
  'ratio: ' + Math.round(accuracy / timePerGuess));
console.error('Total:', mask.map.size, 'matches');

function logMatches() {
  var bitMasks = [...mask.map.keys()];
  bitMasks.sort((bm1, bm2) => {
    var st1 = mask.map.get(bm1);
    var st2 = mask.map.get(bm2);
    var ws1 = mask.wilsonScore(st1.moveMatches, st1.matches);
    var ws2 = mask.wilsonScore(st2.moveMatches, st2.matches);
    return ws2 - ws1;
  });
  bitMasks.forEach(function(bitMask) {
    mask.logMatch(bitMask);
  });
}
