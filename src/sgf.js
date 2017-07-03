(function (root, factory) {
  if (typeof define === 'function' && define.amd) { // AMD.
    define(['exports', 'Board'], factory);
  } else if (typeof exports === 'object' && typeof exports.nodeName !== 'string') { // CommonJS
    factory(exports, require('./board.js').Board);
  } else { // Browser globals
    root.Baduk = root.Baduk || {};
    factory(root.Baduk, root.Baduk.Board);
  }
}(this, function (exports, Board) {

  // Manage an SGF file, only consider its primary history.
  function SGF() {
    this.content = [];
    this.board = new Board();
    this.currentNodeIdx = 0;
  }
  SGF.prototype = {
    // source: string of SGF content.
    // options:
    //   - filename: name of the SGF file.
    //   - error: function(string) called for each error.
    parse: function(source, options) {
      options = options || {};
      var parser = new SGFParser(source, options);
      if (options.error !== undefined) {
        parser.errors.forEach(options.error);
      }
      this.content = parser.content;
      this.reset();
    },

    // Set the board back to the starting position.
    reset: function() {
      this.currentNodeIdx = 0;
      if (this.content.length > 0 &&
          this.content[0] !== undefined &&
          this.content[0].sequence.length > 0) {
        var firstNode = this.content[0].sequence[0];
        var size = firstNode["SZ"];
        var komi = firstNode["KM"];
        var handicap = firstNode["HA"] || 0;
        var setBlack = firstNode["AB"];
        var setWhite = firstNode["AW"];
        if (firstNode["B"] === undefined && firstNode["W"] === undefined) {
          this.step();
        }
      } else {
        var size = 19;
        var komi = 7.5;
        var handicap = 0;
      }
      this.board = new Board({size: size, komi: komi});
      if (handicap > 0) {
        this.board.nextPlayingColor = Board.WHITE;
      }
      if (setBlack !== undefined) {
        this.board.setList(setBlack, Board.BLACK);
      }
      if (setWhite !== undefined) {
        this.board.setList(setWhite, Board.WHITE);
      }
    },

    isPassMove: function(move) { return (move.x < 0); },

    isMove: function(node) {
      return (node["B"] !== undefined) ||
             (node["W"] !== undefined);
    },

    // Return the position {x, y} of the move that is about to be played,
    // or undefined if there are none.
    nextMove: function() {
      var sequence = this.content[0].sequence;
      var node = sequence[this.currentNodeIdx];
      if (node !== undefined) {
        if (node["B"] !== undefined) { return node["B"]; }
        if (node["W"] !== undefined) { return node["W"]; }
      }
    },

    executeMove: function(node) {
      if (node["B"] !== undefined) {
        if (this.isPassMove(node["B"])) {
          this.board.pass();
        } else {
          this.board.play(node["B"].x, node["B"].y);
        }
      } else if (node["W"] !== undefined) {
        if (this.isPassMove(node["W"])) {
          this.board.pass();
        } else {
          this.board.play(node["W"].x, node["W"].y);
        }
      }
    },

    // Perform a single move operation from the SGF file.
    // Computes all nodes until the next move, putting currentNodeIdx to the
    // next move.
    // Return true if there are still more moves coming.
    step: function() {
      var sequence = this.content[0].sequence;
      var sequenceLength = sequence.length;
      var i = this.currentNodeIdx;
      if (i >= sequenceLength) { return false; }
      do {
        this.executeMove(sequence[i]);
        i++;
      } while (i < sequenceLength && !this.isMove(sequence[i]));
      this.currentNodeIdx = i;
      return i < sequenceLength;
    },

    // Count the number of stone placements / pass moves.
    countMoves: function() {
      var counter = 0;
      var sequence = this.content[0].sequence;
      var sequenceLength = sequence.length;
      for (var i = 0; i < sequenceLength; i++) {
        var node = sequence[i];
        if (this.isMove(node)) { counter++; }
      }
      return counter;
    },

    // Run the SGF file on the board.
    run: function() { while (this.step()) {} },

    // coord is a {x, y} intersection coordinate.
    // quarters is the number of quarter turns to rotate the board.
    // Returns a new {x, y} coordinate.
    // This code assumes a square board.
    rotateCoord: function(coord, quarters) {
      if (coord.x < 0) { return coord; }  // Pass moves are ignored.
      // 2, 1 → size - 1, 2 → size - 2, size - 1 → 1, size - 2
      var x = coord.x, y = coord.y, size = this.board.size;
      for (var i = 0; i < quarters; i++) {
        var oldX = x;
        x = size - y - 1;
        y = oldX;
      }
      return { x: x, y: y };
    },

    // Map the board to a different board (eg. rotate it).
    // transformation(intersection) maps an intersection into another.
    transform: function(transformation) {
      var contentLength = this.content.length;
      for (var i = 0; i < contentLength; i++) {
        var sequence = this.content[i].sequence;
        var sequenceLength = sequence.length;
        for (var j = 0; j < sequenceLength; j++) {
          var node = sequence[j];
          for (var key in node) {
            var nodeValue = node[key];
            if (nodeValue.x !== undefined) {  // nodeValue is a point.
              node[key] = transformation(nodeValue);
            } else if (nodeValue instanceof Array &&
                       (nodeValue.length > 0) &&
                       (nodeValue[0].x !== undefined)) {
              // nodeValue is a list of points.
              var nodeValueLength = nodeValue.length;
              for (var k = 0; k < nodeValueLength; k++) {
                nodeValue[k] = transformation(nodeValue[k]);
              }
            }
          }
        }
      }
      this.reset();
    },

    // Rotate the board in the SGF content.
    // quarters is the number of quarter turns to rotate the board.
    // This code assumes a square board.
    // It causes the board to reset.
    rotate: function(quarters) {
      if (quarters === 0) { return; }
      var self = this;
      self.transform(function(coord) {
        return self.rotateCoord(coord, quarters);
      });
    },

    flipCoordHorizontally: function(coord) {
      return { x: coord.x, y: this.board.size - coord.y - 1 };
    },

    flipCoordVertically: function(coord) {
      return { x: this.board.size - coord.x - 1, y: coord.y };
    },

    flipHorizontally: function() {
      var self = this;
      self.transform(function(coord) {
        return self.flipCoordHorizontally(coord);
      });
    },

    flipVertically: function() {
      var self = this;
      self.transform(function(coord) {
        return self.flipCoordVertically(coord);
      });
    },
  };

  // options:
  //   - filename: name of the SGF file.
  function SGFParser(sgf, options) {
    options = options || {};
    this.source = sgf;
    this.filename = options.filename || "source.sgf";
    this.errors = [];
    this.tokStart = 0;
    this.tokEnd = 0;
    this.line = 1;
    this.col = 1;
    this.boardSize = 19;
    this.content = this.parse(sgf);
  }

  SGFParser.prototype = {
    read: function(n) {
      n = (n === undefined)? 1: +n;
      var slice = this.source.slice(this.tokEnd, this.tokEnd + n);
      this.tokEnd += n;
      return slice;
    },
    peek: function() { return this.source[this.tokEnd]; },
    skip: function() { this.read(); this.consumeToken(); },
    skipMatching: function(regexp) {
      while (regexp.test(this.peek())) { this.read(); }
      this.consumeToken();
    },
    skipWhitespace: function() { this.skipMatching(/\s/); },
    token: function() {
      return this.source.slice(this.tokStart, this.tokEnd);
    },
    consumeToken: function() {
      var token = this.token();
      for (var i = 0; i < token.length; i++) {
        if (token[i] === "\n") {
          this.line++;
          this.col = 1;
        } else { this.col++; }
      }
      this.tokStart = this.tokEnd;
      return token;
    },
    error: function(msg) {
      this.errors.push(this.filename + ":" + this.line + ":" + this.col + ": "
        + msg);
    },
    // [gameTree, …]
    parse: function() {
      var gameTrees = [];
      do {
        var gameTree = this.parseGameTree();
        if (gameTree !== undefined) { gameTrees.push(gameTree); }
        this.skipWhitespace();
      } while (this.peek() === "(");
      return gameTrees;
    },
    // {sequence, gameTrees}
    parseGameTree: function() {
      this.skipWhitespace();
      if (this.peek() === "(") {
        this.skip();
        var sequence = this.parseSequence();
        this.skipWhitespace();
        var gameTrees = [];
        while (this.peek() === "(") {
          var gameTree = this.parseGameTree();
          if (gameTree !== undefined) { gameTrees.push(gameTree); }
        }
        if (this.peek() === ")") {
          this.skip();
          return { sequence: sequence, gameTrees: gameTrees };
        } else {
          this.error("Expected a `)` in the game tree, got `" + this.peek() + "`");
        }
      } else {
        this.error("Expected a `(` in the game tree, got `" + this.peek() + "`");
      }
    },
    // [node, …]
    parseSequence: function() {
      this.skipWhitespace();
      var nodes = [];
      do {
        var node = this.parseNode();
        if (node !== undefined) { nodes.push(node); }
        this.skipWhitespace();
      } while (this.peek() === ";");
      return nodes;
    },
    // {identifier: value}
    parseNode: function() {
      if (this.peek() === ";") {
        this.skip();
      } else {
        this.error("Expected a `;` starting the node, got `" + this.peek() + "`");
      }
      this.skipWhitespace();
      var properties = Object.create(null);
      while (/^[A-Z]$/.test(this.peek())) {
        var property = this.parseProperty();
        if (property !== undefined) {
          properties[property.identifier] = property.value;
        }
        this.skipWhitespace();
      }
      return properties;
    },
    typeFromPropIdent: function(identifier) {
      switch (identifier) {
        case 'B':
        case 'W': return IDENT_MOVE;
        case 'MN':
        case 'HA':
        case 'FF':
        case 'GM':
        case 'ST':
        case 'SZ':
        case 'OB':
        case 'OW':
        case 'PM': return IDENT_NUMBER;
        case 'V':
        case 'KM':
        case 'TM':
        case 'BL':
        case 'WL': return IDENT_REAL;
        case 'PL': return IDENT_COLOR;
        case 'DM':
        case 'GB':
        case 'GW':
        case 'UC':
        case 'BM':
        case 'TE':
        case 'HO': return IDENT_DOUBLE;
        case 'KO':
        case 'IT':
        case 'DO': return IDENT_NONE;
        case 'C':
        case 'GC': return IDENT_TEXT;
        case 'CA':
        case 'N':
        case 'AN':
        case 'BR':
        case 'BT':
        case 'CP':
        case 'DT':
        case 'RD':
        case 'EV':
        case 'GN':
        case 'ON':
        case 'OT':
        case 'PB':
        case 'PC':
        case 'PW':
        case 'RE':
        case 'RO':
        case 'RU':
        case 'SO':
        case 'US':
        case 'WR':
        case 'WT': return IDENT_SIMPLETEXT;
        case 'AB':
        case 'AE':
        case 'AW':
        case 'TB':
        case 'TW':
        case 'DD':
        case 'MA':
        case 'SL':
        case 'SQ':
        case 'TR':
        case 'CR':
        case 'VW': return IDENT_ELIST_POINT;
        case 'LN':
        case 'AR': return IDENT_LIST_POINT_POINT;
        case 'LB': return IDENT_LIST_POINT_SIMPLETEXT;
        case 'AP': return IDENT_SIMPLETEXT_SIMPLETEXT;
        case 'FG': return IDENT_NUMBER_SIMPLETEXT;
      }
    },
    propIdentTypeIsList: function(type) {
      return (type === IDENT_ELIST_POINT) ||
        (type === IDENT_LIST_POINT_POINT) ||
        (type === IDENT_LIST_POINT_SIMPLETEXT);
    },
    // {identifier, value}
    parseProperty: function() {
      this.skipWhitespace();
      var identifier = this.parsePropIdent();
      var type = this.typeFromPropIdent(identifier);
      var isList = this.propIdentTypeIsList(type);
      var value;
      if (isList) { value = []; }
      do {
        var propValue = this.parsePropValue(type);
        if (propValue !== undefined) {
          if (isList) { value.push(propValue); }
          else { value = propValue; }
        }
        this.skipWhitespace();
      } while (this.peek() === "[");
      if (identifier === "SZ") { this.boardSize = value; }
      else if ((identifier === "B" || identifier === "W") &&
               (value.x >= this.boardSize)) {
        // Compatibility with FF[3].
        value = { x: -1, y: -1 };
      }
      return { identifier: identifier, value: value };
    },
    parsePropIdent: function() {
      while (/^[A-Z]$/.test(this.peek())) { this.read(); }
      return this.consumeToken();
    },
    parsePropValue: function(type) {
      if (this.peek() === "[") {
        this.skip();
        var value = this.parseCValueType(type);
        if (this.peek() === "]") {
          this.skip();
        } else {
          this.error("Expected a `]` ending the property, got `" + this.peek() + "`");
        }
        return value;
      } else {
        this.error("Expected a `[` starting the property value, got `" +
          this.peek() + "`");
      }
    },
    parseCValueType: function(type) {
      if (type === IDENT_MOVE) {
        if (this.peek() === "]") { return { x: -1, y: -1 }; }
        return this.parsePoint();
      } else if (type === IDENT_NUMBER) {
        return this.parseNumber();
      } else if (type === IDENT_REAL) {
        return this.parseReal();
      } else if (type === IDENT_COLOR) {
        return this.parseColor();
      } else if (type === IDENT_DOUBLE) {
        return this.parseDouble();
      } else if (type === IDENT_TEXT) {
        return this.parseText();
      } else if (type === IDENT_SIMPLETEXT) {
        return this.parseText({simple: true});
      } else if (type === IDENT_NONE) {
        return null;
      } else if (type === IDENT_ELIST_POINT) {
        return this.parsePoint();
      } else if (type === IDENT_LIST_POINT_POINT) {
        var from = this.parsePoint();
        if (this.peek() === ":") {
          this.skip();
        } else {
          this.error("Missing `:` in list of composed point:point");
        }
        var to = this.parsePoint();
        return [from, to];
      } else if (type === IDENT_LIST_POINT_SIMPLETEXT) {
        var point = this.parsePoint();
        if (this.peek() === ":") {
          this.skip();
        } else {
          this.error("Missing `:` in list of composed point:simpletext");
        }
        var label = this.parseText({simple: true});
        return { point: point, label: label };
      } else if (type === IDENT_SIMPLETEXT_SIMPLETEXT) {
        var app = this.parseText({simple: true, composed: true});
        if (this.peek() === ":") {
          this.skip();
        } else {
          this.error("Missing `:` in composed simpletext:simpletext");
        }
        var version = this.parseText({simple: true});
        return { app: app, version: version };
      } else if (type === IDENT_NUMBER_SIMPLETEXT) {
        var flags = this.parseNumber();
        if (flags === undefined) { return null; }
        if (this.peek() === ":") {
          this.skip();
        } else {
          this.error("Missing `:` in composed simpletext:simpletext");
        }
        var name = this.parseText({simple: true});
        return { flags: flags, name: name };
      } else {
        this.error("Invalid property value type " + type);
      }
    },
    parsePoint: function() {
      var x = this.parseCoordinate();
      var y = this.parseCoordinate();
      return { x: x, y: y };
    },
    parseCoordinate: function() {
      if (/[a-z]/.test(this.peek())) {
        var char = this.read();
        this.consumeToken();
        return char.charCodeAt(0) - 97;
      } else if (/[A-Z]/.test(this.peek())) {
        var char = this.read();
        this.consumeToken();
        return char.charCodeAt(0) - 65 + 26;
      } else {
        this.error("Invalid coordinate '" + this.read() + "'");
      }
    },
    parseColor: function() {
      if (/[BW]/.test(this.peek())) {
        var color = this.read();
        this.consumeToken();
        return color;
      } else {
        this.error("Unknown color '" + this.read() + "'");
      }
    },
    parseDouble: function() {
      if (/[12]/.test(this.peek())) {
        var double = +this.read();
        this.consumeToken();
        return double;
      } else {
        this.error("Unknown double '" + this.read() + "'");
      }
    },
    parseNumber: function() {
      var sign = 1;
      if (/^[\+\-]$/.test(this.peek())) {
        if (this.read() === "-") { sign = -1; }
      }
      var number = 0;
      while (/^\d$/.test(this.peek())) {
        number *= 10;
        number += +this.read();
      }
      this.consumeToken();
      return sign * number;
    },
    parseReal: function() {
      var number = this.parseNumber();
      var sign = (number >= 0)? 1: -1;
      if (this.peek() === ".") {
        this.read();
        var fractional = 1;
        while (/^\d$/.test(this.peek())) {
          fractional /= 10;
          number += sign * fractional * +this.read();
        }
      }
      this.consumeToken();
      return number;
    },
    parseText: function(options) {
      options = options || {};
      var simple = !!options.simple;
      var composed = !!options.composed;
      var text = "";
      var escaping = false;
      for (;;) {
        var char = this.peek();
        if (escaping) {
          if (char === "\n") {
            this.read();
            if (this.peek() === "\r") { this.read(); }
          } else if (char === "\r") {
            this.read();
            if (this.peek() === "\n") { this.read(); }
          } else { text += this.read(); }
          escaping = false;
        } else if (char === "]" || char === undefined || (composed && char === ":")) {
          this.consumeToken();
          return text;
        } else if (char === "\\") {
          this.read();
          escaping = true;
        } else if (/\s/.test(char) && (simple || !/[\r\n]/.test(char))) {
          this.read();
          text += " ";
        } else {
          text += this.read();
        }
      }
    },
  };

  var IDENT_MOVE = 1;
  var IDENT_NUMBER = 2;
  var IDENT_REAL = 3;
  var IDENT_COLOR = 4;
  var IDENT_DOUBLE = 5;
  var IDENT_NONE = 6;
  var IDENT_TEXT = 7;
  var IDENT_SIMPLETEXT = 8;
  var IDENT_ELIST_POINT = 9;
  var IDENT_LIST_POINT_POINT = 10;
  var IDENT_LIST_POINT_SIMPLETEXT = 11;
  var IDENT_SIMPLETEXT_SIMPLETEXT = 12;
  var IDENT_NUMBER_SIMPLETEXT = 13;

  exports.Board = Board;
  exports.SGF = SGF;

}));
