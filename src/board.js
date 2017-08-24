(function (root, factory) {
  if (typeof define === 'function' && define.amd) { // AMD.
    define(['exports'], factory);
  } else if (typeof exports === 'object' && typeof exports.nodeName !== 'string') { // CommonJS
    factory(exports);
  } else { // Browser globals
    root.Baduk = root.Baduk || {};
    factory(root.Baduk);
  }
}(this, function (exports) {

  // FIXME: implement a quick Set polyfill.

  // A given intersection on a board.
  function Intersection(x, y) {
    this.x = x;
    this.y = y;
    this.color = Board.EMPTY;
    this.group = null;
    this.territory = null;  // Used for score counting.
    this.turnPlayed = -1;
    this.capturesFromMove = 0;  // Number of enemy stones it would capture.
    // Number of own stones it would place in jeopardy.
    this.selfAtariFromMove = 0;
    this.libertiesFromMove = 0; // Group liberty count from move.
    this.sensibleMove = true;  // ie, legal and does not fill its own eyes.
    // FIXME: set the following values correctly.
    this.wasJustCaptured = false;  // Did a capture just happen here?
    // Change in number of own/enemy liberties from making a move here.
    this.ownLibertiesChange = 0;
    this.enemyLibertiesChange = 0;
    this.leadsToLadderCapture = false;
    this.leadsToLadderEscape = false;
  }

  Intersection.prototype = {
    toString: function() {
      return coordFromNum(this.x) + coordFromNum(this.y);
    },
  };

  function Group(board, intersections) {
    this.board = board;
    this.color = Board.EMPTY;
    this.intersections = new Set();
    this.liberties = new Set();  // Set of intersections.
    var self = this;
    intersections.forEach(function(intersection) {
      self.addIntersection(intersection);
    });
  }

  Group.prototype = {
    addIntersection: function(intersection) {
      this.intersections.add(intersection);
      this.color = intersection.color;
      intersection.group = this;
      var neighbors = this.board.surrounding(intersection.x, intersection.y);
      for (var i = 0; i < neighbors.length; i++) {
        var neighbor = neighbors[i];
        if (neighbor.color === Board.EMPTY) {
          this.liberties.add(neighbor);
        }
      }
    },
    toString: function() {
      var intersections = this.intersections.map(function(intersection) {
        return intersection.toString();
      });
      var liberties = this.liberties.map(function(intersection) {
        intersection.toString();
      });
      return "(" + stringFromColor(this.color) + " group on intersections " +
        intersections.join(", ") +
        " with liberties " + liberties.join(", ") + ")";
    },
  };

  function Territory(board, intersections) {
    this.board = board;
    this.color = -1;  // Unknown color.
    this.intersections = new Set();
    var self = this;
    intersections.forEach(function(intersection) {
      self.addIntersection(intersection);
    });
  }

  Territory.prototype = {
    addIntersection: function(intersection) {
      this.intersections.add(intersection);
      intersection.territory = this;
      var neighbors = this.board.surrounding(intersection.x, intersection.y);
      for (var i = 0; i < neighbors.length; i++) {
        var neighbor = neighbors[i];
        if (neighbor.color !== Board.EMPTY) {
          if (this.color === -1) {  // Previously unknown ownership.
            this.color = neighbor.color;
          } else if (this.color > Board.EMPTY &&
                     this.color !== neighbor.color) {
            // Border contains stones of different colors.
            this.color = Board.EMPTY;
          }
        }
      }
    },
    toString: function() {
      var intersections = this.intersections.map(function(intersection) {
        return intersection.toString();
      });
      return "(" + stringFromColor(this.color) + " territory on intersections " +
        intersections.join(", ") + ")";
    },
  };

  // options:
  //   - size: typically 19.
  //   - komi: floating-point number.
  function Board(options) {
    options = options || {};
    this.size = +options.size || 19;
    this.komi = +options.komi || 7.5;
    this.board = new Array(this.size * this.size);
    for (var y = 0; y < this.size; y++) {
      for (var x = 0; x < this.size; x++) {
        this.board[x + y * this.size] = new Intersection(x, y);
      }
    }
    this.groups = new Set();
    this.nextPlayingColor = Board.BLACK;
    this.captures = [0, 0, 0];  // Stones captured by empty, black, white.
    this.numMoves = 0;
    // Map from intersection of singly captured stone to the intersection
    // of the stone that captured it.
    // Used for Ko detection.
    this.consequentSingleCaptures = new Map();
  }

  Board.prototype = {
    // Is this intersection valid?
    has: function(x, y) {
      return y >= 0 && x >= 0 && y < this.size && x < this.size;
    },
    directGet: function(x, y) { return this.board[x + y * this.size]; },
    directSet: function(x, y, color) {
      this.board[x + y * this.size].color = color;
    },
    // x, y: integer positions of an intersection on the board.
    get: function(x, y) {
      if (this.has(x, y)) { return this.directGet(x, y); }
    },
    set: function(x, y, color) {
      if (this.has(x, y)) {
        this.directSet(x, y, color);
        if (color !== Board.EMPTY) {
          var intersection = this.directGet(x, y);
          var surrounding = this.surrounding(x, y);
          var ownSurroundingGroups = [];
          for (var i = 0; i < surrounding.length; i++) {
            var neighbor = surrounding[i];
            if (neighbor.color === color) {
              ownSurroundingGroups.push(neighbor.group);
            }
          }
          this.mergeStoneInGroups(intersection, ownSurroundingGroups);
        }
      }
    },
    // list: array of [row number, column number].
    setList: function(list, color) {
      for (var i = 0; i < list.length; i++) {
        this.set(list[i].x, list[i].y, color);
      }
    },

    // Create a new group that is the union of the given groups.
    mergeGroups: function(groups) {
      var intersections = [];
      for (var i = 0; i < groups.length; i++) {
        var group = groups[i];
        group.intersections.forEach(function(intersection) {
          intersections.push(intersection);
        });
      }
      return new Group(this, intersections);
    },

    // Add a stone to a list of groups (typically, its surrounding groups).
    mergeStoneInGroups: function(intersection, ownSurroundingGroups) {
      var currentGroup = this.mergeGroups(ownSurroundingGroups);
      currentGroup.addIntersection(intersection);
      for (var i = 0; i < ownSurroundingGroups.length; i++) {
        var group = ownSurroundingGroups[i];
        this.groups.delete(group);
      };
      this.groups.add(currentGroup);
    },

    surrounding: function(x, y) {
      var top    = this.get(x    , y - 1);
      var right  = this.get(x + 1, y    );
      var bottom = this.get(x    , y + 1);
      var left   = this.get(x - 1, y    );
      var neighbors = [];
      if (top    !== undefined) { neighbors.push(top); }
      if (right  !== undefined) { neighbors.push(right); }
      if (bottom !== undefined) { neighbors.push(bottom); }
      if (left   !== undefined) { neighbors.push(left); }
      return neighbors;
    },

    // Returns true if the move is authorized by the game rules.
    // Sets the intersection's capturesFromMove, selfAtariFromMove,
    // libertiesFromMove, sensibleMove.
    isValidMove: function(x, y) {
      var self = this;
      if (!this.has(x, y)) { return false; }
      var intersection = self.directGet(x, y);
      var color = self.nextPlayingColor;
      if (intersection.color !== Board.EMPTY) { return false; }
      self.directSet(x, y, color);

      // Reset properties.
      intersection.capturesFromMove = 0;
      intersection.selfAtariFromMove = 0;
      intersection.libertiesFromMove = 0;
      intersection.sensibleMove = true;

      // Get surrounding groups.
      var surrounding = self.surrounding(x, y);
      var surroundingGroups = [];
      var ownSurroundingGroups = [];
      var enemySurroundingGroups = [];
      var capturedEnemyGroups = [];
      var capturesFromMove = 0;
      var selfAtariFromMove = 0;
      var libertiesFromMove = 0;
      for (var i = 0; i < surrounding.length; i++) {
        var neighbor = surrounding[i];
        if (neighbor.color !== Board.EMPTY) {
          var group = neighbor.group;
          surroundingGroups.push(group);
          if (group.color === color) {
            ownSurroundingGroups.push(group);
          } else {
            enemySurroundingGroups.push(group);
            if (group.liberties.size === 1) {
              capturedEnemyGroups.push(group);
              capturesFromMove += group.intersections.size;
            }
          }
        }
      }

      var numberOfEmptyNeighbors = 0;
      for (var i = 0; i < surrounding.length; i++) {
        var neighbor = surrounding[i];
        if (neighbor.color === Board.EMPTY) {
          numberOfEmptyNeighbors++;
        }
      }
      libertiesFromMove = numberOfEmptyNeighbors;
      var newGroupSize = 1;
      for (var i = 0; i < ownSurroundingGroups.length; i++) {
        var group = ownSurroundingGroups[i];
        libertiesFromMove += group.liberties.size - 1;
        newGroupSize += group.intersections.size;
      }

      if (capturedEnemyGroups.length === 0) {
        // We are not capturing enemy stones. Are we committing suicide?
        var isKillingOwnGroup = libertiesFromMove === 0;
        var isSelfAtari = libertiesFromMove === 1;
        if (isKillingOwnGroup) {
          // Undo the insertion of a stone.
          self.directSet(x, y, Board.EMPTY);
          intersection.sensibleMove = false;
          return false;
        } else if (isSelfAtari) {
          intersection.selfAtariFromMove = newGroupSize;
        }
      } else {  // We are capturing enemy stones.
        libertiesFromMove += capturedEnemyGroups.length;
        intersection.capturesFromMove = capturesFromMove;
      }
      intersection.libertiesFromMove = libertiesFromMove;

      // To detect Kos and Superkos, we ask the following question:
      // Did we have a stone at X capturing the stone at Y, and now play a stone
      // at Y capturing the stone at X, in the same sequence of plays that
      // capture exactly one stone?
      if (capturesFromMove === 1) {
        // We have captured a single stone; are we playing an illegal Ko?
        var playedInterIdx = x + y * this.size;
        var capturedInter = capturedEnemyGroups[0].intersections
          .values().next().value;
        var capturedInterIdx = capturedInter.x + capturedInter.y * this.size;
        // Has the stone we just captured previously captured a single stone
        // in playedInterIdx?
        if (self.consequentSingleCaptures.get(playedInterIdx) === capturedInterIdx) {
          // Undo the insertion of a stone.
          self.directSet(x, y, Board.EMPTY);
          intersection.sensibleMove = false;
          return false;
        }
      }

      // Undo the insertion of a stone.
      self.directSet(x, y, Board.EMPTY);
      return true;
    },

    // Place a stone. Returns true if the move was valid.
    play: function(x, y) {
      var self = this;
      if (!this.has(x, y)) { return false; }
      var intersection = self.directGet(x, y);
      var color = self.nextPlayingColor;
      if (intersection.color !== Board.EMPTY) { return false; }
      self.directSet(x, y, color);

      // Get surrounding groups.
      var surrounding = self.surrounding(x, y);
      var surroundingGroups = [];
      var ownSurroundingGroups = [];
      var enemySurroundingGroups = [];
      var capturedEnemyGroups = [];
      var capturesFromMove = 0;
      for (var i = 0; i < surrounding.length; i++) {
        var neighbor = surrounding[i];
        if (neighbor.color !== Board.EMPTY) {
          var group = neighbor.group;
          surroundingGroups.push(group);
          if (group.color === color) {
            ownSurroundingGroups.push(group);
          } else {
            enemySurroundingGroups.push(group);
            if (group.liberties.size === 1) {
              capturedEnemyGroups.push(group);
              capturesFromMove += group.intersections.size;
            }
          }
        }
      }

      if (capturedEnemyGroups.length === 0) {
        // We are not capturing enemy stones. Are we committing suicide?
        var numberOfEmptyNeighbors = 0;
        for (var i = 0; i < surrounding.length; i++) {
          var neighbor = surrounding[i];
          if (neighbor.color === Board.EMPTY) {
            numberOfEmptyNeighbors++;
          }
        }
        var isLastLibertyOfAllOwnGroups = true;
        for (var i = 0; i < ownSurroundingGroups.length; i++) {
          var group = ownSurroundingGroups[i];
          if (group.liberties.size !== 1) {
            isLastLibertyOfAllOwnGroups = false;
            break;
          }
        }
        var isKillingOwnGroup = isLastLibertyOfAllOwnGroups &&
                                (numberOfEmptyNeighbors === 0);
        if (isKillingOwnGroup) {
          // Undo the insertion of a stone.
          self.directSet(x, y, Board.EMPTY);
          return false;
        }
      }

      // To detect Kos and Superkos, we ask the following question:
      // Did we have a stone at X capturing the stone at Y, and now play a stone
      // at Y capturing the stone at X, in the same sequence of plays that
      // capture exactly one stone?
      if (capturesFromMove === 1) {
        // We have captured a single stone; are we playing an illegal Ko?
        var playedInterIdx = x + y * this.size;
        var capturedInter = capturedEnemyGroups[0].intersections
          .values().next().value;
        var capturedInterIdx = capturedInter.x + capturedInter.y * this.size;
        // Has the stone we just captured previously captured a single stone
        // in playedInterIdx?
        if (self.consequentSingleCaptures.get(playedInterIdx) === capturedInterIdx) {
          // Undo the insertion of a stone.
          self.directSet(x, y, Board.EMPTY);
          return false;
        }
        self.consequentSingleCaptures.set(capturedInterIdx, playedInterIdx)
      } else {
        self.consequentSingleCaptures = new Map();
      }

      self.mergeStoneInGroups(intersection, ownSurroundingGroups);

      for (var i = 0; i < enemySurroundingGroups.length; i++) {
        var group = enemySurroundingGroups[i];
        group.liberties.delete(intersection);
      }

      for (var i = 0; i < capturedEnemyGroups.length; i++) {
        var group = capturedEnemyGroups[i];
        self.groups.delete(group);
        self.captures[color] += group.intersections.size;
        group.intersections.forEach(function(intersection) {
          intersection.group = null;
          intersection.color = Board.EMPTY;
          // This intersection's stone was captured.
          // Add the liberties to its neighbors.
          var surrounding = self.surrounding(intersection.x, intersection.y);
          for (var j = 0; j < surrounding.length; j++) {
            var neighbor = surrounding[j];
            if (neighbor.color !== Board.EMPTY) {
              neighbor.group.liberties.add(intersection);
            }
          }
        });
      }

      intersection.turnPlayed = self.numMoves;
      self.numMoves++;
      self.nextTurn();
      return true;
    },

    pass: function() { this.nextTurn(); },

    nextTurn: function() {
      if (this.nextPlayingColor === Board.BLACK) {
        this.nextPlayingColor = Board.WHITE;
      } else {
        this.nextPlayingColor = Board.BLACK;
      }
    },

    scores: function() {
      var blackScore = 0, whiteScore = 0;
      this.computeTerritories();
      for (var y = 0; y < this.size; y++) {
        for (var x = 0; x < this.size; x++) {
          var intersection = this.board[x + y * this.size];
          if      (intersection.color === Board.BLACK) { blackScore++; }
          else if (intersection.color === Board.WHITE) { whiteScore++; }
          else if (intersection.territory.color === Board.BLACK) { blackScore++; }
          else if (intersection.territory.color === Board.WHITE) { whiteScore++; }
        }
      }

      blackScore += this.captures[Board.BLACK];
      whiteScore += this.captures[Board.WHITE];
      whiteScore += this.komi;
      return {black: blackScore, white: whiteScore};
    },

    // Return the color of the winner (0 if it is a draw).
    winner: function() {
      var scores = this.scores();
      var blackScore = scores.black;
      var whiteScore = scores.white;
      if      (blackScore > whiteScore) { return Board.BLACK; }
      else if (whiteScore > blackScore) { return Board.WHITE; }
      else { return Board.EMPTY; }
    },

    computeTerritories: function() {
      for (var y = 0; y < this.size; y++) {
        for (var x = 0; x < this.size; x++) {
          var intersection = this.board[x + y * this.size];
          if (intersection.color === Board.EMPTY) {
            var top = this.get(x, y - 1);
            var left = this.get(x - 1, y);
            if (top !== undefined && top.territory !== null) {
              top.territory.addIntersection(intersection);
              if (left !== undefined && left.territory !== null) {
                // Merge left and top territories.
                var topHasLargerTerritory =
                  (top.territory.intersections.size >
                   left.territory.intersections.size);
                var largerTerritory =
                  topHasLargerTerritory? top.territory: left.territory;
                var smallerTerritory =
                  topHasLargerTerritory? left.territory: top.territory;
                smallerTerritory.intersections.forEach(
                  function(smallIntersection) {
                    largerTerritory.addIntersection(smallIntersection);
                  }
                );
              }
            } else if (left !== undefined && left.territory !== null) {
              left.territory.addIntersection(intersection);
            } else {
              intersection.territory = new Territory(this, [intersection]);
            }
          }
        }
      }
    },

    toString: function() {
      var rows = "  ";
      for (var i = 0; i < this.size; i++) {
        rows += coordFromNum(i);
      }
      rows += "\n ┌";
      for (var i = 0; i < this.size; i++) {
        rows += "─";
      }
      rows += "┐\n";
      for (var y = 0; y < this.size; y++) {
        rows += coordFromNum(y) + "│";
        for (var x = 0; x < this.size; x++) {
          var intersection = this.directGet(x, y);
          if (intersection.color === Board.EMPTY) {
            rows += " ";
          } else if (intersection.color === Board.BLACK) {
            rows += "●";
          } else if (intersection.color === Board.WHITE) {
            rows += "○";
          }
        }
        rows += "│\n";
      }
      rows += " └";
      for (var i = 0; i < this.size; i++) {
        rows += "─";
      }
      rows += "┘\n";
      rows += "Captured: black " + this.captures[Board.BLACK] +
                      ", white " + this.captures[Board.WHITE];
      return rows;
    },
  };

  Board.EMPTY = 0;
  Board.BLACK = 1;
  Board.WHITE = 2;

  function stringFromColor(color) {
    switch (color) {
      case Board.EMPTY: return 'Empty';
      case Board.BLACK: return 'Black';
      case Board.WHITE: return 'White';
    }
  }
  Board.stringFromColor = stringFromColor;

  function coordFromNum(number) {
    if (number < 26) { return String.fromCharCode(97 + number); }
    else { return String.fromCharCode(65 + number - 26); }
  }
  Board.coordFromNum = coordFromNum;
  function coordFromMove(move) {
    return coordFromNum(move.x) + coordFromNum(move.y);
  }
  Board.coordFromMove = coordFromMove;

  exports.Board = Board;

}));
