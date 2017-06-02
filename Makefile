bundle.js: src/board.js src/sgf.js
	cat src/board.js src/sgf.js > bundle.js

clean:
	rm bundle.js

.PHONY: clean
