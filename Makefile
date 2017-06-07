bundle.js: src/board.js src/sgf.js
	cat src/board.js src/sgf.js > bundle.js

clean:
	rm bundle.js

test:
	node test/board.js

.PHONY: clean test
