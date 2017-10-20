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

sgf/alphago/:
	mkdir -p sgf/alphago/download; \
	cd sgf/alphago/download; \
	curl -s http://www.alphago-games.com \
		| grep -Eo '/static/games[^"]+.zip' \
		| (while read zip; do \
			curl -sO 'http://www.alphago-games.com'"$$zip"; \
			zip_name=$$(basename "$$zip"); \
			unzip -q "$$zip_name"; \
			rm "$$zip_name"; \
			ls | (while read sgf; do \
				sgf_name="$${zip_name::-4}"-"$$sgf"; \
				echo "$$sgf_name"; \
				mv "$$sgf" ../"$$sgf_name"; \
			done); \
		done); \
	cd ..; \
	rmdir download

.PHONY: clean test
