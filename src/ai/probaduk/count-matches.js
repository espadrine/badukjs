var fs = require('fs');
var path = require('path');
var Baduk = require('../../sgf.js');
var SGF = Baduk.SGF;
var mask = require('./mask.js');

var sgf = new SGF();
var mask3 = new mask.Mask3();

function aggregateFromGame(sgf) {
  while (sgf.step()) {
    var move = sgf.nextMove();
    mask3.readFromBoard(sgf.board, move);
  }
}

function computeSgf(sgfContent, filename) {
  sgf.parse(String(sgfContent), {filename: filename, error: console.error});
  aggregateFromGame(sgf);
  // Perform this for each game symmetry and reflection.
  for (var i = 0; i < 3; i++) {
    sgf.rotate(1);
    aggregateFromGame(sgf);
  }
  sgf.rotate(1);
  sgf.flipHorizontally();
  aggregateFromGame(sgf);
  sgf.flipHorizontally();
  sgf.flipVertically();
  aggregateFromGame(sgf);
}

// Compute the number of correct guesses and overall guesses [correct, total].
function guessGame(sgfContent, filename) {
  sgf.parse(String(sgfContent), {filename: filename, error: console.error});
  var correct = 0;
  var total = 0;
  while (sgf.step()) {
    var move = sgf.nextMove();
    if (move.x < 0) { continue; }
    var guess = mask3.guess(sgf.board);//guessMove(sgf.board);
    if (guess.move.x === move.x && guess.move.y === move.y) {
      correct++;
    }
    total++;
  }
  return [correct, total];
}

var sgfDir = path.join(__dirname, '../../../sgf/kgs4d');
var files = fs.readdirSync(sgfDir);
var trainingSize = 300;
var validationSize = 20;
var trainingSet = files.slice(0, trainingSize);
var validationSet = files.slice(trainingSize, trainingSize + validationSize);
console.log('training');

console.time('training');
trainingSet.forEach(function(filename) {
  var sgfContent = fs.readFileSync(path.join(sgfDir, filename));
  computeSgf(sgfContent, filename);
});
console.timeEnd('training');

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
var accuracy = correct / total;
var timePerGuess = ((vt1 - vt0) / total / 1000);  // in s.
console.log('Accuracy: ' + correct + '/' + total +
  ' (' + (accuracy * 100).toPrecision(3) + '%), ' +
  'time: ' + timePerGuess.toPrecision(3) + 's, ' +
  'ratio: ' + Math.round(accuracy / timePerGuess));
