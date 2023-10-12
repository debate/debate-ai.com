/* Converts docx debate file to html with u b i h1 mark tags

git clone <this repo>
cd <this repo>
pnpm i
node .\debate-converter.js "D:\\Debate\\Demo"
*/

const jsdom = require('jsdom');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const { JSDOM } = jsdom;
// const { document } = (new JSDOM('')).window;
// global.document = document;


//convert docx by unzipping it and regex to simple html u,b,p,h1,h2,h3,h4,span
function docx2html(docXML) {

    //create DOM with document elements and formatting
    var output = "";
    var inputDom = new JSDOM(
          docXML.replace(/<[a-zA-Z]*?:/g, "<").replace(/<\/[a-zA-Z]*?:/g, "</")
        ).window.document.body;

    var plist = inputDom.getElementsByTagName("p");
  
    // paragraph node list in the doc containing all paragraphs,
    // each containing in-line <r> text ranges equivalent to <span> and style info as <pPr>
    for (var i = 0; i < plist.length; i++) {
      var inNode = plist[i];
      var outNode = "";
  
      //detect paragraph style name and add it as a class name later
      var pStyle = inNode.getElementsByTagName("pStyle")[0]?.getAttribute("w:val").toLowerCase() || "";
      
      //use h1-h9 for heading styles or p for normal paragraph
      var tag = pStyle.includes('heading') ? pStyle.replace("heading", "h") : "p";

      //convert each text range from xml to html
      for (var j = 0; j < inNode.getElementsByTagName("r").length; j++) {
        var inNodeChild = inNode.getElementsByTagName("r")[j];
        var val = inNodeChild.textContent;

        //pass style as class name to parent paragraph
        var style = inNodeChild
            .getElementsByTagName("rStyle")[0]
            ?.getAttribute("w:val")
            .toLowerCase() || "";
        if (style) 
          val = "<span class='"+style+"'>" + val + "</span>";
    
  
        //add bold, underline, highlight
        if (
          inNodeChild.getElementsByTagName("b").length ||
          style.includes("bold") ||
          style.includes("emphasis")
        )
          val = "<b>" + val + "</b>";

        if (
          inNodeChild.getElementsByTagName("i").length ||
          style.includes("italic") 
        )
          val = "<i>" + val + "</i>";
  
        if (
          inNodeChild.getElementsByTagName("u").length ||
          style.includes("underline") ||
          style.includes("emphasis")
        )
          val = "<u>" + val + "</u>";
  
        if (inNodeChild.getElementsByTagName("highlight").length)
          val = '<mark style="background-color:' + 
            inNodeChild.getElementsByTagName("highlight")[0].getAttribute("w:val") 
            + '">' + val + "</mark>";
  
        outNode += val;
      }
  
      //add to output
      output += "<"+tag+" class='"+pStyle+"'>" + outNode + "</"+tag+">";
    }
  
    return output;
  }
  


// testing 

//get all files in folder and subfolders
const getFilesInFolder = (dir, files = []) => {
  const dirFiles = fs.readdirSync(dir)
  for (const f of dirFiles) {
      const stat = fs.lstatSync(dir + path.sep + f)
      if (stat.isDirectory()) 
        getFilesInFolder(dir + path.sep + f, files)
      else 
          files.push(dir + path.sep + f)
  }
  return files
}

//convert file by unzipping it and regex to simple html then write to output folder

function convertFile(filepath, indexConversion){
  const filename = path.basename(filepath);
  try{
    var zip = new AdmZip(filepath);

  }
  catch (e) {
    return;
  }

  zip.readAsTextAsync( zip.getEntry('word/document.xml'), function(unzipContents){
    var startTime = new Date().getTime();

    var htmlDoc = docx2html(unzipContents);

    var outputPath = filepath
      .replace(INPUT_FOLDER, OUTPUT_FOLDER)
      .replace(".docx", ".html");

    //create output dir if not exists
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, {recursive:true});
    }

    fs.writeFileSync(outputPath, htmlDoc); 

    var timeElapsed = ((new Date().getTime() - startTime)/1000).toFixed(1);
    console.log(++filesFinished + "/" + (totalFileCount || "")  + " " + 
      "  Time: " + timeElapsed + "s " + outputPath.replace(__dirname,'') );

  })

}

if (process.argv.length === 2) {
  console.error('Script requires input folder as argument');
  process.exit(1);
}

const INPUT_FOLDER =  process.argv[2] 
var  OUTPUT_FOLDER = INPUT_FOLDER + " HTML";
var filesFinished = 0;
  
//run conversion
//single file
if (INPUT_FOLDER.endsWith(".docx") ) {
  OUTPUT_FOLDER = path.dirname(INPUT_FOLDER)

  convertFile(INPUT_FOLDER, 1);

} else {  
  var allFiles = getFilesInFolder(INPUT_FOLDER)
  var totalFileCount = allFiles.length;
  
  allFiles.forEach(convertFile);
} 