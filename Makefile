all: modules cpp

cpp: index.html makecpp.js
	node makecpp.js

modules: package.json
	npm install
