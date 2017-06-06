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

  // A given intersection on a board.
  function Intersection(x, y) {
    this.x = x;
    this.y = y;
    this.color = Board.EMPTY;
    this.wasJustCaptured = false;  // Did a capture just happen here?
    this.turnsSinceLastMove = 0;
    this.groupId = 0;
    this.liberties = 0;  // Number of liberties of the current group.
    // Change in number of own/enemy liberties from making a move here.
    this.ownLibertiesChange = 0;
    this.enemyLibertiesChange = 0;
    this.capturesFromMove = 0;  // Number of enemy stones it would capture.
    this.selfAtariFromMove = 0;  // Number of own stones it would capture.
    this.sensibleMove = true;  // ie, legal and does not fill its own eyes.
    this.leadsToLadderCapture = false;
    this.leadsToLadderEscape = false;
  }

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
  }

  Board.prototype = {
    // x, y: integer positions of an intersection on the board.
    get(x, y) { return this.board[x + y * this.size]; },
    set(x, y, color) { this.board[x + y * this.size].color = color; },
  };

  Board.EMPTY = 0;
  Board.BLACK = 1;
  Board.WHITE = 2;

  exports.Board = Board;

}));
