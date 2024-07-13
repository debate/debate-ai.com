const zip = require("adm-zip");
const { parseHTML } = require( "linkedom");

/**
 * Alternative method -- front end only
 * Converts docx  file to html with u b i h1 mark tags
 * convert file by unzipping it and regex to simple html then write to output folder
 * @param {string} filepath - File Path to a DOCX file
 * @param {object} { preserveStyles = true }
 * @returns html basic formatting
 */
export default async function extractDOCX(filepath) {
  try {
    var zipFile = new zip(filepath);

    var docXML = zipFile.readAsText(zipFile.getEntry("word/document.xml"));
    //TODO add styles parsing and apply to get b u i 

    //create DOM with document ranges and formatting
    var output = "";
    var inputDom = parseHTML(
      docXML.replace(/<[a-zA-Z]*?:/g, "<").replace(/<\/[a-zA-Z]*?:/g, "</")
    )?.document;

    // paragraph node list in the doc containing all paragraphs,
    // each containing in-line <r> text ranges equivalent to <span> and style info as <pPr>

    Array.from(inputDom.getElementsByTagName("p")).forEach((paraNode) => {
      var allTextInNode = "";

      //detect paragraph style name and add it as a class name later
      var pStyle =
        paraNode
          .getElementsByTagName("pStyle")[0]
          ?.getAttribute("w:val")
          .toLowerCase() || "";

      //use h1-h9 for heading styles or p for normal paragraph
      var tag = pStyle.includes("heading")
        ? pStyle.replace("heading", "h")
        : "p";

      //convert each text range from xml to html
      Array.from(paraNode.getElementsByTagName("r")).forEach((range) => {
        var text = range.textContent;

        //pass style as class name to parent paragraph
        var style =
          range
            .getElementsByTagName("rStyle")[0]
            ?.getAttribute("w:val")
            .toLowerCase() || "";

        if (style) text = `<span class='${style}'>${text}</span>`;

        //add bold, underline, highlight

        if (range.getElementsByTagName("u").length) 
          text = `<u>${text}</u>`;

        if (range.getElementsByTagName("highlight").length)
          text = `<mark style="background-color:${range
              .getElementsByTagName("highlight")[0]
              .getAttribute("w:val")}">${text}</mark>`;

        allTextInNode += text;
      });

      //add to output
      output += `<${tag} ${pStyle ? `class='${pStyle}'>` : ">"} 
        ${allTextInNode}</${tag}>`;
    });

    output = output.replace(/<p><\/p>/g, " ");

    return output;
  } catch (e) {
    console.error(e.message);
  }
}
