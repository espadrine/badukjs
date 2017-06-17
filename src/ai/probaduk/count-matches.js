var fs = require('fs');
var Baduk = require('../../sgf.js');
var SGF = Baduk.SGF;
var mask = require('./mask.js');

var sgf = new SGF();
var mask4 = new mask.Diamond4();

function computeSgf(sgfContent) {
  sgf.parse(String(sgfContent));
  while (sgf.step()) {
    var move = sgf.nextMove();
    mask4.readFromBoard(sgf.board, move);
  }
  // FIXME: add rotations and inversions.

  var maxScore = 0;
  var maxBitsMatch;
  mask4.map.forEach(function(matchStats, bitsMatch) {
    var prob = score(matchStats);
    if (prob > maxScore) {
      maxScore = prob;
      maxBitsMatch = bitsMatch;
    }
  });
  mask4.logMatch(maxBitsMatch);
}

// Compute the probability that this move is recommended.
// We use the lower bound of the Wilson score for a binomial proportion
// confidence interval at 95% confidence.
function score(matchStats) {
  var moves = matchStats.moveMatches;
  var n = matchStats.matches;
  if (n === 0) { return 0; }
  var z = 1.96, phat = moves / n;
  return (phat + z*z/(2*n) - z * Math.sqrt((phat*(1-phat)+z*z/(4*n))/n))/(1+z*z/n)
}


process.stdin.setEncoding('utf8');
var sgfContent = '';
process.stdin.on('readable', function() {
  sgfContent += String(process.stdin.read());
});
process.stdin.on('end', function() {
  computeSgf(sgfContent);
});
