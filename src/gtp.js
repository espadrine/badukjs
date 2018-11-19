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

  // Manage a GTP connection.
  // See http://www.lysator.liu.se/~gunnar/gtp/gtp2-spec-draft2/gtp2-spec.html
  function GTP(options = {board: new Board()}) {
    this.board = options.board;
  }

  GTP.prototype = {

    // ❶ Interface.

    exec(instruction) {
      var inst = this.parse(instruction);
      // 3.6 Error message for unknown command.
      if (this.interpreter[inst.command] === undefined) {
        return new Response(Response.error, 'unknown command', inst.id);
      }
      return this.interpreter[inst.command](this, inst);
    },

    parse(instruction) {
      if (this.stream === undefined) {
        this.stream = new Stream(instruction);
      } else {
        var yetToConsume = this.stream.string.length - this.stream.index
          + 1;  // +1 to consume the forthcoming newline.
        this.stream.string += '\n' + instruction;
        this.stream.consume(yetToConsume);
        this.stream.errors = [];  // Clear errors.
      }
      return this.command(this.stream);
    },

    // ❷ Interpreter.

    // All functions take gtp, command = {id, command, args, errors}.
    // They return a Response.
    interpreter: {

      // 6.3.1 Administrative Commands

      protocol_version: function(gtp, command) {
        return new Response(Response.result, '2', command.id);
      },

      name: function(gtp, command) {
        return new Response(Response.result, 'badukjs', command.id);
      },

      version: function(gtp, command) {
        return new Response(Response.result, GTP.version, command.id);
      },

      // 6.3.3 Core Play Commands

      play: function(gtp, command) {
        if (gtp.stream.errors.length > 0) {
          return new Response(Response.error, 'illegal move', command.id);
        }
        var vertex = command.args.move.vertex;
        var color = command.args.move.color;
        gtp.board.nextPlayingColor = color;
        // pass
        if (vertex.length <= 0) {
          gtp.board.pass();
        } else {
          gtp.board.play(vertex[0], vertex[1]);
        }
        return new Response(Response.result, '', command.id);
      },

    },

    // ❸ Parser.

    // (optional id) command_name (optional arguments) newline
    // Returns {id, command, args, errors}.
    // - args is an object of parameters to the command whose type depends
    // on the command.
    command(stream) {
      stream.whitespace();

      var errors = stream.errors.slice();
      var id = this.int(stream);
      if (id === null) {
        stream.errors = errors;  // Remove errors if optional.
      }

      stream.whitespace();
      var command = stream.parse(/^[a-zA-Z_]+/);
      if (command === null) {
        stream.error('Invalid command name ' + command);
        return null;
      } else { stream.whitespace(); }
      var args = {}, errors = [];

      // Depending on the command, we want to parse the arguments in a
      // special way.
      if (command === 'protocol_version') {
      } else if (command === 'name') {
      } else if (command === 'play') {
        var move = this.move(stream);
        if (move !== null) { args.move = move; }
      } else {
        // TODO
      }

      return {
        id,
        command,
        args,
      };
    },

    // Returns an integer, or null if it cannot parse the int.
    int(stream) {
      var int = stream.parse(/^[0-9]+/);
      if (int === null) {
        stream.error('Invalid int ' + int);
        return null;
      }
      return +int;
    },

    // eg. `white d16`.
    move(stream) {
      var color = this.color(stream);
      if (color === null) {
        stream.error('Invalid color ' + color + ' in move');
        return null;
      }
      stream.whitespace();
      var vertex = this.vertex(stream);
      if (vertex === null) {
        stream.error('Invalid vertex ' + vertex + ' in move');
        return null;
      }
      return {color, vertex};
    },

    // eg. `white`
    // Returns the Board color or null if unparseable.
    color(stream) {
      var color = stream.parse(/^(?:white|black|w|b)/i);
      if (color === null) {
        stream.error('Invalid color ' + color);
        return null;
      }
      return (color[0] === 'w' || color[0] === 'W')? Board.WHITE:
          Board.BLACK;
    },

    // Letter/number combination (eg. f5), or "pass".
    // Converted to a list of two integers for abscissa and ordinate, or empty
    // (for pass).
    // eg. `d16`, or `pass`.
    vertex(stream) {
      var pass = stream.parse(/^pass\b/i);
      if (pass !== null) { return []; }

      // Parse the first coordinate, corresponding to abscissa.
      var p0 = stream.parse(/^[a-zA-Z]/);
      if (p0 === null || p0 === 'I' || p0 === 'i') {
        stream.error('Invalid coordinate abscissa ' + p0);
        return [];
      }
      var c0;
      if (/^[a-i]$/.test(p0)) {
        c0 = p0.charCodeAt(0) - 97;
      } else if (/^[j-z]$/.test(p0)) {
        c0 = p0.charCodeAt(0) - 98;
      } else if (/^[A-I]$/.test(p0)) {
        c0 = p0.charCodeAt(0) - 65;
      } else if (/^[J-Z]$/.test(p0)) {
        c0 = p0.charCodeAt(0) - 66;
      }

      // Now, parse the ordinate.
      var p1 = stream.parse(/^[1-9][0-9]?/);
      if (p1 === null) {
        stream.error('Invalid coordinate ordinate ' + p1);
        return [];
      }
      var c1 = 19 - p1;
      return [c0, c1];
    },
  };

  GTP.version = '0.1';

  function Response(type, msg, id = null) {
    this.type = type;
    this.message = msg;
    this.id = id;
  }

  Response.prototype = {
    toString: function() {
      var id = (this.id != null? String(this.id): '');
      var type;
      if (this.type === Response.result) { type = '=';
      } else if (this.type === Response.error) { type = '?';
      } else {
        return '?' + id + ' ' +
          'invalid response while processing message: '
          + this.message;
      }
      var message;
      if (this.message.length === 0) {
        message = this.message;
      } else {
        message = ' ' + this.message;
      }
      return type + id + message;
    },
  };

  Response.result = 0;
  Response.error  = 1;

  function Stream(string) {
    this.string = string;
    this.index = 0;
    this.line = 0;
    this.column = 0;
    this.errors = [];
  }

  Stream.prototype = {
    // Read a character without consuming it.
    peek() { return this.string[this.index]; },
    // Advance by one character on the stream.
    consume(n) {
      n = n || 1;
      for (var i = 0; i < n; i++) {
        if (this.string[this.index] === '\n') {
          this.line++;
          this.column = 0;
        } else {
          this.column++;
        }
        this.index++;
      }
    },
    // Read a character from the stream and consume it.
    char() {
      var c = this.string[this.index];
      this.consume();
      return c;
    },
    // Read the stream from the current point and consume it up to the end of
    // the match.
    parse(regex) {
      var match = regex.exec(this.string.slice(this.index));
      if (match === null) { return null; }
      var len = match.index + match[0].length;
      this.consume(len);
      return match[0];
    },
    // Consume whitespace.
    whitespace() { return this.parse(/^\s+/); },
    // Register an error message at the current point in the stream.
    error(msg) { this.errors.push(new Error(msg, this)); },
  };

  function Error(msg, stream) {
    this.msg = msg;
    this.line = stream.line;
    this.column = stream.column;
  }

  Error.prototype = {
    toString() {
      return `${this.line}:${this.column}: ${this.msg}`;
    },
  };


  exports.Board = Board;
  exports.GTP = GTP;

}));
