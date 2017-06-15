SHELL := /bin/bash

bundle.js: src/board.js src/sgf.js
	cat src/board.js src/sgf.js > bundle.js

clean:
	rm bundle.js

test:
	node test/board.js
	node test/sgf.js

sgf/kgs4d/:
	if [ ! -e sgf/kgs4d-tar ]; then \
		mkdir -p sgf/kgs4d-tar; \
		curl "https://www.u-go.net/gamerecords-4d/" | \
			grep -o "https://dl\.u-go\.net/gamerecords-4d/KGS4d-.*\.tar\.gz" | \
			(while read tarball; do \
				echo Downloading $$tarball; \
				curl "$$tarball" >sgf/kgs4d-tar/"$${tarball:41}"; \
			done); \
	fi
	mkdir -p sgf/kgs4d
	cd sgf/kgs4d; ls ../kgs4d-tar | (while read tarball; do \
		tar xf ../kgs4d-tar/"$$tarball" --strip-components=1; \
		done)
	rm -r sgf/kgs4d-tar


.PHONY: clean test
