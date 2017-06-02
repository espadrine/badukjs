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
```
