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
    // FIXME: set the following values correctly.
    this.wasJustCaptured = false;  // Did a capture just happen here?
    this.turnsSinceLastMove = 0;
    // Change in number of own/enemy liberties from making a move here.
    this.ownLibertiesChange = 0;
    this.enemyLibertiesChange = 0;
    this.capturesFromMove = 0;  // Number of enemy stones it would capture.
    // Number of own stones it would place in jeopardy.
    this.selfAtariFromMove = 0;
    this.sensibleMove = true;  // ie, legal and does not fill its own eyes.
    this.leadsToLadderCapture = false;
    this.leadsToLadderEscape = false;
  }

  Intersection.prototype = {
    toString: function() {
      return boardCoordFromNum(this.x) + boardCoordFromNum(this.y);
    },
  };

  function Group(board, intersections) {
    this.board = board;
    this.color = Board.EMPTY;
    this.intersections = new Set();
    this.liberties = new Set();  // Set of intersections.
    intersections.forEach(this.addIntersection.bind(this));
  }

  Group.prototype = {
    addIntersection: function(intersection) {
      var self = this;
      self.intersections.add(intersection);
      self.color = intersection.color;
      intersection.group = self;
      self.board.surrounding(intersection.x, intersection.y)
      .forEach(function(neighbor) {
        if (neighbor.color === Board.EMPTY) {
          self.liberties.add(neighbor);
        }
      });
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

  // options:
  //   - size: typically 19.
  //   - komi: floating-point number.
  function Board(options) {
    options = options | {};
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
  }

  Board.prototype = {
    // x, y: integer positions of an intersection on the board.
    get: function(x, y) {
      if (y < 0 || x < 0 || y >= this.size || x >= this.size) { return; }
      return this.board[x + y * this.size];
    },
    set: function(x, y, color) { this.board[x + y * this.size].color = color; },

    mergeGroups: function(groups) {
      var intersections = [];
      groups.forEach(function(group) {
        group.intersections.forEach(function(intersection) {
          intersections.push(intersection);
        });
      });
      return new Group(this, intersections);
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

    // Place a stone.
    play: function(x, y) {
      var self = this;
      var intersection = self.get(x, y);
      var color = self.nextPlayingColor;
      if (intersection === undefined || intersection.color !== Board.EMPTY) {
        return false;
      }
      self.set(x, y, color);

      // Get surrounding groups.
      var surrounding = self.surrounding(x, y);
      var surroundingGroups = surrounding.map(function(neighbor) {
        if (neighbor.color === Board.EMPTY) { return; }
        return neighbor.group;
      }).filter(function(group) { return group !== undefined; });
      var ownSurroundingGroups = surroundingGroups.filter(function(group) {
        return group.color === color;
      });
      var enemySurroundingGroups = surroundingGroups.filter(function(group) {
        return group.color !== color;
      });
      var capturedEnemyGroups = enemySurroundingGroups.filter(function(group) {
        return group.liberties.size === 1;
      });

      if (capturedEnemyGroups.length === 0) {
        // We are not capturing enemy stones. Are we committing suicide?
        var emptyNeighbors = surrounding.filter(function(neighbor) {
          return neighbor.color === Board.EMPTY;
        });
        var isKillingOwnGroup = ownSurroundingGroups.every(function(group) {
          return group.liberties.size === 1;
        }) && emptyNeighbors.length === 0;
        if (isKillingOwnGroup) {
          // Undo the insertion of a stone.
          self.set(x, y, Board.EMPTY);
          return false;
        }
      }

      // Group merges.
      var currentGroup = self.mergeGroups(ownSurroundingGroups);
      currentGroup.addIntersection(intersection);
      ownSurroundingGroups.forEach(function(group) {
        self.groups.delete(group);
      });
      self.groups.add(currentGroup);

      enemySurroundingGroups.forEach(function(group) {
        group.liberties.delete(intersection);
      });

      capturedEnemyGroups.forEach(function(group) {
        self.groups.delete(group);
        group.intersections.forEach(function(intersection) {
          intersection.group = null;
          intersection.color = Board.EMPTY;
          // This intersection's stone was captured. Add the liberties to its
          // neighbors.
          self.surrounding(intersection.x, intersection.y)
          .forEach(function(neighbor) {
            if (neighbor.color !== Board.EMPTY) {
              neighbor.group.liberties.add(intersection);
            }
          });
        });
      });

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

    toString: function() {
      var rows = "  ";
      for (var i = 0; i < this.size; i++) {
        rows += boardCoordFromNum(i);
      }
      rows += "\n ┌";
      for (var i = 0; i < this.size; i++) {
        rows += "─";
      }
      rows += "┐\n";
      for (var y = 0; y < this.size; y++) {
        rows += boardCoordFromNum(y) + "│";
        for (var x = 0; x < this.size; x++) {
          var intersection = this.get(x, y);
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
      rows += "┘";
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

  function boardCoordFromNum(number) {
    if (number < 26) { return String.fromCharCode(97 + number); }
    else { return String.fromCharCode(65 + number - 26); }
  }
  Board.boardCoordFromNum = boardCoordFromNum;

  exports.Board = Board;

}));
