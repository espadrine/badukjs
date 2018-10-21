var fs = require('fs');
var path = require('path');
var Baduk = require('../../sgf.js');
var SGF = Baduk.SGF;
var DecisionTree = require('./decision-tree.js');

// Command-line parameters.
process.argv.shift();  // node
if (/build-decision-tree/.test(process.argv[0])) { process.argv.shift(); }
if (process.argv[0] === '-h' || process.argv[0] === '--help') {
  console.log("node build-decision-tree.js [games dir] [batch size] " +
    "[validation size] [tree size] > tree.json");
  process.exit(0);
}
var gamesDir = process.argv[0] || path.join(__dirname, "..", "..", "..", "sgf", "alphago");
var batchSize = +process.argv[1] || 5;
var validationSize = +process.argv[2] || 20;
var treeSize = +process.argv[3] || 300;
console.error(gamesDir, batchSize, validationSize, treeSize);

function parseGame(game) {
  var sgfContent = String(fs.readFileSync(path.join(gamesDir, game)));
  var sgf = new SGF();
  sgf.parse(String(sgfContent), {filename: game, error: console.error});
  return sgf;
}

function aggregateFromGame(sgf, analyseMove) {
  while (sgf.step()) {
    var prevMove = move;
    var move = sgf.nextMove();
    analyseMove(sgf.board, move, prevMove);
  }
}

function computeSgf(sgf, analyseMove) {
  // Perform this for each game symmetry and reflection.
  aggregateFromGame(sgf, analyseMove);
  for (var i = 0; i < 3; i++) {
    sgf.rotate(1);
    aggregateFromGame(sgf, analyseMove);
  }
  sgf.flipHorizontally();
  aggregateFromGame(sgf, analyseMove);
  for (var i = 0; i < 3; i++) {
    sgf.rotate(1);
    aggregateFromGame(sgf, analyseMove);
  }
  sgf.flipHorizontally();
}

var games = fs.readdirSync(gamesDir);
var trainingSize = batchSize * treeSize;
var trainingGames = games.slice(0, trainingSize);
var validationGames = games.slice(trainingSize, trainingSize + validationSize);
var t0 = +Date.now();
var trainingSgf = trainingGames.map(parseGame);
var validationSgf = validationGames.map(parseGame);
var t1 = +Date.now();
console.error('parsing: ' + (t1 - t0).toPrecision(3) + 'ms');

t0 = +Date.now();
var trainingIndex = 0;
var tree = DecisionTree.learn(treeSize, function train(analyseMove) {
  for (var i = 0; i < batchSize; i++) {
    var sgf = trainingSgf[trainingIndex];
    computeSgf(sgf, analyseMove);
    trainingIndex = (trainingIndex + 1) % trainingSize;
  }
  //trainingSgf.forEach(function(sgf) { computeSgf(sgf, analyseMove); });
});
t1 = +Date.now();
console.error('training: ' + (t1 - t0).toPrecision(3) + 'ms');
var output = tree.toJSON();
console.log(JSON.stringify(output));

tree = DecisionTree.load(output);
t0 = +Date.now();
var guesses = 0;
var correctGuesses = 0;
validationSgf.forEach(function(sgf) {
  computeSgf(sgf, function(board, move, prevMove) {
    if (move.x < 0) { return; }
    var guessedMove = tree.guess(board, prevMove);
    if (guessedMove.x === move.x && guessedMove.y === move.y) {
      correctGuesses++;
    }
    guesses++;
  });
});
t1 = +Date.now();
console.error('validation: ' + (t1 - t0).toPrecision(3) + 'ms');

function logPerformance(correctGuesses, guesses, t0, t1) {
  var accuracy = correctGuesses / guesses;
  var timePerGuess = (t1 - t0) / guesses / 1000;
  var ratio = accuracy / timePerGuess;
  console.error('Guessed ' + correctGuesses + '/' + guesses +
    ' (' + (accuracy * 100).toPrecision(3) + '%), ' +
    'time: ' + timePerGuess.toPrecision(3) + 's, ' +
    'ratio: ' + Math.round(ratio));
}
logPerformance(correctGuesses, guesses, t0, t1);
