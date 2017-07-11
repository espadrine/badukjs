var Baduk = require('../../board.js');
var Board = Baduk.Board;

function Stats() {
  this.moveMatches = 0;  // This intersection was played.
  this.matches = 0;  // This layout was seen in the game.
  this.nextMask = null;
}
Stats.prototype = {
  toString: function() {
    return this.moveMatches + ' moves / ' + this.matches + ' matches (' +
      Math.floor(100 * (this.moveMatches / this.matches)) + '%)';
  },
}

function Mask(parentMask, parentMatchBits) {
  this.mask = [];
  // Map from number (bit pattern of the layout surrounding a stone)
  // to Stats.
  this.map = new Map();
  this.matches = 0;  // Number of matches seen.
  this.NextMask = null;
  this.parentMask = parentMask || null;
  this.parentMatchBits = (parentMatchBits !== undefined)? parentMatchBits: null;
}

Mask.prototype = {
  // json: array of [bitMask, moveMatches, matches].
  load: function(json) {
    for (var i = 0; i < json.length; i++) {
      var pattern = json[i];
      var stat = new Stats();
      stat.moveMatches = pattern[1];
      stat.matches     = pattern[2];
      this.map.set(pattern[0], stat);
    }
    return this;
  },

  score: function(matchBits) {
    var score = 0;
    var stats = this.map.get(matchBits);
    if (stats !== undefined) {
      score = this.wilsonScore(stats.moveMatches, stats.matches);
    }
    return score;
  },
  // Compute the probability that this move is recommended.
  // We use the lower bound of the Wilson score for a binomial proportion
  // confidence interval at 95% confidence.
  wilsonScore: function(moves, n) {
    if (n === 0) { return 0; }
    var z = 1.96, phat = moves / n;
    return (phat + z*z/(2*n) - z * Math.sqrt((phat*(1-phat)+z*z/(4*n))/n))/(1+z*z/n);
  },
  // Rate an intersection on a board.
  rate: function(board, x, y) {
    var matchBits = this.matchBits(board, x, y);
    var score = 0;
    var stats = this.map.get(matchBits);
    if (stats !== undefined) {
      score = this.wilsonScore(stats.moveMatches, stats.matches);
      if (stats.nextMask !== null) {
        var subscore = stats.nextMask.rate(board, x, y);
        score = (score + subscore) / 2;
      }
    }
    return score;
  },
  // Return the most likely move and its score, {move: {x,y}, score: num}
  guess: function(board) {
    var maxScore = 0;
    var maxMove = {x: -1, y: -1};
    var moves = [];
    for (var y = 0; y < board.size; y++) {
      for (var x = 0; x < board.size; x++) {
        var intersection = board.directGet(x, y);
        if (intersection.color !== Board.EMPTY) { continue; }
        var score = this.rate(board, x, y);
        if (score > maxScore) {
          maxScore = score;
          maxMove = {x: x, y: y};
        }
        moves.push({x: x, y: y, score: score});
      }
    }
    return {x: maxMove.x, y: maxMove.y, score: maxScore, moves: moves};
  },

  getOrAddStats: function(bitsMatch) {
    var stats = this.map.get(bitsMatch);
    if (stats === undefined) {
      stats = new Stats();
      var NextMask = this.NextMask;
      if (NextMask !== null) { stats.nextMask = new NextMask(this, bitsMatch); }
      this.map.set(bitsMatch, stats);
    }
    return stats;
  },

  // Input: an intersection from Board (see src/board.js).
  // Output: a number.
  bitsFromIntersection: function(intersection, color) {
    if (intersection === undefined) {
      return 0;
    } else if (intersection.color === Board.EMPTY) {
      return 1;
    } else if (intersection.color === color) {
      var liberties = intersection.group.liberties.size;
      if (liberties === 1) { return 2; }
      else if (liberties === 2) { return 3; }
      else { return 4; }
    } else {
      var liberties = intersection.group.liberties.size;
      if (liberties === 1) { return 5; }
      else if (liberties === 2) { return 6; }
      else { return 7; }
    }
  },
  matchBits: function(board, x, y) {
    //var matchBits = 0;
    var matchBits = '';
    var color = +board.nextPlayingColor;
    var mask = this.mask;
    var maskLength = mask.length|0;
    for (var i = 0; i < maskLength; i++) {
      var neighbor = board.get(x + mask[i][0], y + mask[i][1]);
      matchBits += String.fromCharCode(this.bitsFromIntersection(neighbor, color)|0);
    }
    return matchBits;
  },

  readFromBoardCoord: function(board, nextMove, x, y) {
    var matchBits = this.matchBits(board, x, y);
    var matchStats = this.getOrAddStats(matchBits);
    matchStats.matches++;
    this.matches++;
    if (nextMove.x === x && nextMove.y === y) {
      matchStats.moveMatches++;
    }
    if (matchStats.nextMask !== null) {
      matchStats.nextMask.readFromBoardCoord(board, nextMove, x, y);
    }
  },

  // Input: a Board (see src/board.js) and a move {x, y}.
  readFromBoard: function(board, nextMove) {
    var boardSize = board.size;
    var color = board.nextPlayingColor;
    var mask = this.mask;
    var maskLength = mask.length;
    for (var y = 0; y < boardSize; y++) {
      for (var x = 0; x < boardSize; x++) {
        var intersection = board.directGet(x, y);
        if (intersection.color === Board.EMPTY) {
          this.readFromBoardCoord(board, nextMove, x, y);
        }
      }
    }
  },

  // For a given match, log its stats.
  logMatch: function(matchBits) {
    var stats = this.map.get(matchBits);

    // We will draw the match; we need the size of the board rectangle.
    var minX = 0, minY = 0, maxX = 0, maxY = 0;
    for (var i = 0; i < this.mask.length; i++) {
      var maskPoint = this.mask[i];
      var maskPointX = maskPoint[0];
      var maskPointY = maskPoint[1];
      if (maskPointX < minX) { minX = maskPointX; }
      if (maskPointY < minY) { minY = maskPointY; }
      if (maxX < maskPointX) { maxX = maskPointX; }
      if (maxY < maskPointY) { maxY = maskPointY; }
    }
    var width = 1 + (maxX - minX), height = 1 + (maxY - minY);
    var boardRect = [];
    for (var y = 0; y < height; y++) {
      boardRect[y] = [];
      for (var x = 0; x < width; x++) {
        boardRect[y][x] = '  ';
      }
      boardRect[y].push('\n');
    }
    this.addMatchesToLog(boardRect, matchBits, minX, minY);
    boardRect[-minY][-minX] = ' ·';

    console.log(boardRect.map(function(e) {return e.join('');}).join('')
      + stats.toString());
  },
  stringFromMatchBit: function(matchBitsForMaskPoint) {
    if (matchBitsForMaskPoint === 0) {  // outside
      return ' ∅';
    } else if (matchBitsForMaskPoint === 1) {  // empty
      return '  ';
    } else if (matchBitsForMaskPoint === 2) {  // same color
      return '1●';
    } else if (matchBitsForMaskPoint === 3) {  // same color
      return '2●';
    } else if (matchBitsForMaskPoint === 4) {  // same color
      return '3●';
    } else if (matchBitsForMaskPoint === 5) {  // different color
      return '1○';
    } else if (matchBitsForMaskPoint === 6) {  // different color
      return '2○';
    } else if (matchBitsForMaskPoint === 7) {  // different color
      return '3○';
    }
  },
  addMatchesToLog: function(boardRect, matchBits, minX, minY) {
    var maskMatchPoint = new Array(this.mask.length);
    for (var i = 0; i < this.mask.length; i++) {
      var matchBitsForMaskPoint = matchBits[i].charCodeAt(0);
      maskMatchPoint[i] = this.stringFromMatchBit(matchBitsForMaskPoint);
    }
    for (var i = 0; i < maskMatchPoint.length; i++) {
      var x = this.mask[i][0] - minX;
      var y = this.mask[i][1] - minY;
      boardRect[y][x] = maskMatchPoint[i];
    }
    if (this.parentMask !== null) {
      this.parentMask.addMatchesToLog(boardRect,
        this.parentMatchBits, minX, minY);
    }
  },
  toJSON: function() {
    var patterns = [];
    var counter = 0;
    var self = this;
    this.map.forEach(function(stats, bitMask) {
      if (self.wilsonScore(stats.moveMatches, stats.matches) > 0.1) {
        patterns.push([bitMask, stats.moveMatches, stats.matches]);
        counter++;
      }
    });
    return patterns;
  },
};

function Mask1(parentMask, parentMatchBits) {
  Mask.call(this, parentMask, parentMatchBits);
  this.mask = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1],
  ];
}
Mask1.prototype = Object.create(Mask.prototype);
Mask1.prototype.constructor = Mask1;

function Mask2(parentMask, parentMatchBits) {
  Mask.call(this, parentMask, parentMatchBits);
  this.mask = [
                        [0, -2],
              [-1, -1], [0, -1], [1, -1],
    [-2,  0], [-1,  0],          [1,  0], [2, 0],
              [-1,  1], [0,  1], [1,  1],
                        [0,  2],
  ];
}
Mask2.prototype = Object.create(Mask.prototype);
Mask2.prototype.constructor = Mask2;

function Mask3(parentMask, parentMatchBits) {
  Mask.call(this, parentMask, parentMatchBits);
  this.mask = [
                                 [0, -4],
                                 [0, -2],
                       [-1, -1], [0, -1], [1, -1],
    [-4, 0], [-2,  0], [-1,  0],          [1,  0], [2, 0], [4, 0],
                       [-1,  1], [0,  1], [1,  1],
                                 [0,  2],
                                 [0,  4],
  ];
}
Mask3.prototype = Object.create(Mask.prototype);
Mask3.prototype.constructor = Mask3;

function Mask0Liberties(parentMask, parentMatchBits) {
  Mask.call(this, parentMask, parentMatchBits);
  this.mask = [
              [0, -1],
    [-1,  0],          [1,  0],
              [0,  1],
  ];
}
Mask0Liberties.prototype = Object.create(Mask.prototype);
Mask0Liberties.prototype.constructor = Mask0Liberties;
Mask0Liberties.prototype.matchBits = function(board, x, y) {
  var matchBits = 0;
  var color = board.nextPlayingColor;
  var mask = this.mask;
  var maskLength = mask.length;
  for (var i = 0; i < maskLength; i++) {
    var neighbor = board.get(x + mask[i][0], y + mask[i][1]);
    if (neighbor !== undefined && neighbor.color !== Board.EMPTY) {
      if (neighbor.color === color) {
        matchBits += neighbor.group.liberties;
      } else {
        matchBits -= neighbor.group.liberties;
      }
    }
  }
  if (matchBits > 2) { matchBits = 2; }
  if (matchBits < -2) { matchBits = -2; }
  return matchBits;
};

exports.Mask1 = Mask1;
exports.Mask2 = Mask2;
exports.Mask3 = Mask3;
exports.Mask0Liberties = Mask0Liberties;
