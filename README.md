# ofxRemoteUI-Web

A client interface for [ofxRemoteUI](https://github.com/armadillu/ofxRemoteUI) that runs in the browser. Modify and tweak values in your OpenFrameworks app remotely. A prebuilt binary version of this web interface comes bundled with the latest ofxRemoteUI.

![alt text](screenshots/screen-med.png)


## Quick Start

If you just want to use ofxRemoteUI from your browser, you don't need to clone this repo. Start up an app that uses the ofxRemoteUI addon and point your browser to the host indicated when you press tab on your app. 


## For Development

1. Clone this repo and run `git submodule update --init` to install the required [dat.GUI fork](https://github.com/jackosx/dat.GUI).
2. Run `python -m SimpleHTTPServer` in the repo and you can use the interface at http://localhost:8000


## Building for ofxRemoteUI Addon Server

The ofxRemoteUIServer serves a gzipped version of the web inteface. Unfortunately, OpenFrameworks doesn't have a great solution for distributing assets along with addons. A rather wonky workaround was used to avoid manually copying site files into your app's data folder. The gzip is actually represented as a large `char[]` of hex literals defined in RUIWebBinary.cpp

Generating a new RUIWebBinary.cpp is easy, just run `make` in the project directory. The new file can be dropped into the ofxRemoteUI addon directory.
