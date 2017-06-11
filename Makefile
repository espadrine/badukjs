bundle.js: src/board.js src/sgf.js
	cat src/board.js src/sgf.js > bundle.js

clean:
	rm bundle.js

test:
	node test/board.js
	node test/sgf.js

.PHONY: clean test
