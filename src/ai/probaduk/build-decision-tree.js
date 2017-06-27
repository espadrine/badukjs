var fs = require('fs');
var path = require('path');
var Baduk = require('../../sgf.js');
var SGF = Baduk.SGF;
var DecisionTree = require('./decision-tree.js');

// Command-line parameters.
process.argv.shift();  // node
if (/build-decision-tree/.test(process.argv[0])) { process.argv.shift(); }
if (process.argv[0] === '-h' || process.argv[0] === '--help') {
  console.log("node build-decision-tree.js [games dir] [training size] " +
    "[validation size] [tree size] > tree.json");
  process.exit(0);
}
var gamesDir = process.argv[0] || path.join(__dirname, "..", "..", "..", "sgf", "alphago");
var trainingSize = +process.argv[1] || 4;
var validationSize = +process.argv[2] || 20;
var treeSize = +process.argv[3] || 300;
console.error(gamesDir, trainingSize, validationSize, treeSize);

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
  sgf.flipHorizontally();
  sgf.flipVertically();
  aggregateFromGame(sgf, analyseMove);
  sgf.flipVertically();
  sgf.rotate(1);
}

var games = fs.readdirSync(gamesDir);
var trainingGames = games.slice(0, trainingSize);
var validationGames = games.slice(trainingSize, trainingSize + validationSize);
var t0 = +Date.now();
var trainingSgf = trainingGames.map(parseGame);
var validationSgf = validationGames.map(parseGame);
var t1 = +Date.now();
console.error('parsing: ' + (t1 - t0).toPrecision(3) + 'ms');

t0 = +Date.now();
var tree = DecisionTree.learn(treeSize, function train(analyseMove) {
  trainingSgf.forEach(function(sgf) { computeSgf(sgf, analyseMove); });
});
t1 = +Date.now();
console.error('training: ' + (t1 - t0).toPrecision(3) + 'ms');
console.log(JSON.stringify(tree));

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
console.error('Guessed ' + correctGuesses + '/' + guesses +
  ' (' + (correctGuesses / guesses).toPrecision(3) + ')');
