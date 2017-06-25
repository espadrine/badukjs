var fs = require('fs');
var path = require('path');
var Baduk = require('../../sgf.js');
var SGF = Baduk.SGF;
var DecisionTree = require('./decision-tree.js');

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

var gamesDir = path.join(__dirname, "..", "..", "..", "sgf", "alphago");
var games = fs.readdirSync(gamesDir);
var trainingSize = 4;
var validationSize = 20;
var trainingGames = games.slice(0, trainingSize);
var validationGames = games.slice(trainingSize, trainingSize + validationSize);
console.time('parsing');
var trainingSgf = trainingGames.map(parseGame);
var validationSgf = validationGames.map(parseGame);
console.timeEnd('parsing');

console.time('training');
var tree = DecisionTree.learn(300, function train(analyseMove) {
  trainingSgf.forEach(function(sgf) { computeSgf(sgf, analyseMove); });
});
console.timeEnd('training');
console.log(JSON.stringify(tree));

console.time('validation');
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
console.timeEnd('validation');
console.error('Guessed ' + correctGuesses + '/' + guesses +
  ' (' + (correctGuesses / guesses).toPrecision(3) + ')');
