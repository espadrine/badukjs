var Baduk = require('../../board.js');
var Board = Baduk.Board;

function Stats() {
  this.moveMatches = 0;  // This intersection was played.
  this.matches = 0;  // This layout was seen in the game.
}
Stats.prototype = {
  toString: function() {
    return 'Move matches: ' + this.moveMatches + '\n' +
      'Matches: ' + this.matches;
  },
}

// options:
// - stats: data that was output from board analysis for this mask.
function Mask(options) {
  options = options || {}
  this.mask = [];
  // Map from number (bit pattern of the layout surrounding a stone)
  // to Stats.
  this.map = new Map();
  this.moveMatches = 0;  // Number of move matches seen.
  if (options.stats !== undefined) { this.load(options.stats); }
}

Mask.prototype = {
  load: function(stats) {
    // TODO
  },
  incrementMatch: function(bitsMatch) {
    var stats = this.map.get(bitsMatch);
    if (stats === undefined) {
      stats = new Stats();
      this.map.set(bitsMatch, stats);
    }
    stats.matches++;
  },
  incrementMoveMatch: function(bitsMatch) {
    var stats = this.map.get(bitsMatch);
    if (stats === undefined) {
      stats = new Stats();
      this.map.set(bitsMatch, stats);
    }
    stats.moveMatches++;
    this.moveMatches++;
  },
  // Input: an intersection from Board (see src/board.js).
  // Output: a number.
  bitsFromIntersection: function(intersection, color) {
    if (intersection === undefined) {
      return 0;
    } else if (intersection.color === Board.EMPTY) {
      return 1;
    } else if (intersection.color === color) {
      return 2;
    } else { return 3; }
  },
  matchBits: function(board, x, y) {
    var matchBits = 0;
    var color = board.nextPlayingColor;
    var mask = this.mask;
    var maskLength = mask.length;
    for (var i = 0; i < maskLength; i++) {
      var neighbor = board.get(x + mask[i][0], y + mask[i][1]);
      matchBits <<= 2;
      matchBits += this.bitsFromIntersection(neighbor, color);
    }
    return matchBits;
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
          var matchBits = this.matchBits(board, x, y);
          this.incrementMatch(matchBits);
          if (nextMove.x === x && nextMove.y === y) {
            this.incrementMoveMatch(matchBits);
          }
        }
      }
    }
  },

  // For a given match, log its stats.
  logMatch: function(matchBits) {
    var stats = this.map.get(matchBits);

    // We will draw the match; we need the size of the board rectangle.
    var minX = 0, minY = 0, maxX = 0, maxY = 0;
    var maskMatchPoint = new Array(this.mask.length);
    for (var i = 0; i < this.mask.length; i++) {
      var maskPoint = this.mask[i];
      var maskPointX = maskPoint[0];
      var maskPointY = maskPoint[1];
      if (maskPointX < minX) { minX = maskPointX; }
      if (maskPointY < minY) { minY = maskPointY; }
      if (maxX < maskPointX) { maxX = maskPointX; }
      if (maxY < maskPointY) { maxY = maskPointY; }

      var matchBitsForMaskPoint = ((3 << (2 * i)) & matchBits) >> (2 * i);
      if (matchBitsForMaskPoint === 0) {  // outside
        maskMatchPoint[i] = '∅';
      } else if (matchBitsForMaskPoint === 1) {  // outside
        maskMatchPoint[i] = ' ';
      } else if (matchBitsForMaskPoint === 2) {  // same color
        maskMatchPoint[i] = '●';
      } else if (matchBitsForMaskPoint === 3) {  // different color
        maskMatchPoint[i] = '○';
      }
    }
    var width = 1 + (maxX - minX), height = 1 + (maxY - minY);
    var boardRect = [];
    for (var y = 0; y < height; y++) {
      boardRect[y] = [];
      for (var x = 0; x < width; x++) {
        boardRect[y][x] = ' ';
      }
      boardRect[y].push('\n');
    }
    for (var i = 0; i < maskMatchPoint.length; i++) {
      var x = this.mask[i][0] - minX;
      var y = this.mask[i][1] - minY;
      boardRect[y][x] = maskMatchPoint[i];
    }
    boardRect[-minY][-minX] = '·';

    console.log(boardRect.map(function(e) {return e.join('');}).join('')
      + stats.toString());
  },
};

function Diamond4(stats) {
  Mask.call(this, stats);
  // Array of [x, y] relative positions.
  this.mask = [
              [0, -1],
    [-1,  0],          [1,  0],
              [0,  1],
  ];
}
Diamond4.prototype = Object.create(Mask.prototype);
Diamond4.prototype.constructor = Diamond4;

exports.Diamond4 = Diamond4;
