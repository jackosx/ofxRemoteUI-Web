cpp: index.html makecpp.js
	node makecpp.js

all: modules cpp

modules: package.json
	npm install
