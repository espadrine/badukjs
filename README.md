**`badukjs`** is a JavaScript library for the game of Go.

It includes the following properties:

- `Baduk.SGF`: parsing of SGF files, allows performing operations on the
  corresponding board and outputting SGF files again.
- `Baduk.Board`: managing a Go board, including the rules of the game, and
  computing the score. (Ongoing work.)
- `Baduk.Gonvnet`: running a Go bot.

```js
var sgf = new Baduk.SGF();
sgf.parse(stringOfSGFContent, {error: function(err) { console.error(err); }});
// List of {sequence, gameTrees}.
// `sequence` is a list of objects mapping SGF properties to their values.
// For instance, for a move: {B: [16, 3]} (17th intersection from the left, 3rd
// from the top).
// `gameTrees` is a list of {sequence, gameTrees}.
sgf.content

sgf.step();  // Performs the first move on sgf.board.
sgf.run();   // Perform all the game from the SGF on sgf.board.
sgf.countMoves();  // Number of moves in the game.
sgf.reset(); // Reset sgf.board to the starting position.
```

# Binaries

- `./bin/print-sgf.js`: reads an SGF file from stdin, outputs a UTF-8
  representation of the result. If passed with `--steps`, outputs a
  representation of the board for every move.
- `./bin/sgf2json.js`: converts SGF to a JSON representation.
- `./bin/go.js`: plays a game. Defaults to it being played by stdin. It can be
  set to read inputs from a file, a process (`--black="gnugo --color white
  --mode ascii`) or from an ai (`--white=probaduk:../tree.json`).
