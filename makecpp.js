const standalone = require('standalone-html').api;
const fs = require('fs');
const zlib = require('zlib');

var regex = '[ ]'; //leave for standalone

var inputHtmlPath  = 'index.html';
var outputHtmlPath = 'small.html';
var outputCppPath = 'RUIWebBinary.cpp';

standalone(inputHtmlPath, outputHtmlPath, regex , function(err){
  if (err) {
      console.error("Error making small.html")
  }
  else {
      console.log("Standalone HTML Finished.\n")
  } makeCpp();
});


// Read in the standalone HTML file
// GZip the file
// Get HexDump string and format as a C++ char[] initialization
function makeCpp() {

    console.log("Reading:", outputHtmlPath);

    fs.readFile(outputHtmlPath, (err, data) => {

        if (err)
            console.error("Error reading small HTML", err);

        else {
            let html = zlib.gzipSync(data).toString('hex');
            let chars = ""
            for (var i = 0; i < html.length; i++) {
                chars += `0x${html[i]}`;
                i++;
                chars += `${html[i]}`;
                if (i != (html.length - 1)) chars += ',';
            }

            let cpp =
`//Auto generated content.
const unsigned POCO_CONTENT_SIZE = ${html.length/2};
const unsigned char GEN_POCO_CONTENT[] = { ${chars} };`

            fs.writeFile(outputCppPath, cpp, (err) => {
                if (err)
                    console.error("Error writing cpp:", err);
                else
                    console.log("\nFinished writing:", outputCppPath);
            });
        }
    })
}
