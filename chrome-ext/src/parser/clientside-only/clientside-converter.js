
//convert docx by unzipping it and regex to simple html u,b,p,h1,h2,h3,h4,span
async function docx2html(file) {

  // unzip docx which is a zip containing a document.xml
  try {
    var docXML = await (
      await unzipit.unzip(file)
    ).entries["word/document.xml"].text();
  } catch (e) {
    return console.error("Not a docx file");
  }

  //create DOM with document elements and formatting
  var output = "";
  var inputDom = new DOMParser()
      .parseFromString(
        docXML.replace(/<[a-zA-Z]*?:/g, "<").replace(/<\/[a-zA-Z]*?:/g, "</"),
        "text/xml"
      )
      .firstChild.querySelectorAll("body")[0];

  // paragraph node list in the doc containing all paragraphs,
  // each containing in-line <r> text ranges equivalent to <span> and style info as <pPr>
  for (var i = 0; i < inputDom.childNodes.length; i++) {
    var inNode = inputDom.childNodes[i];
    var outNode = document.createElement("p");

    //detect paragraph style name and add it as a class
    var style =
      inNode
        .querySelectorAll("pStyle")[0]
        ?.getAttribute("w:val")
        .toLowerCase() || "";

    //heading style is converted to h1, h2, h3, h4
    if (style.includes("heading"))
      outNode = document.createElement(style.replace("heading", "h"));

    //pass style as class name
    if (style) outNode.classList.add(style);

    //text range from xml to html
    for (var j = 0; j < inNode.querySelectorAll("r").length; j++) {
      var inNodeChild = inNode.querySelectorAll("r")[j];
      var val = inNodeChild.textContent;

      //pass style as class name
      var style =
        inNodeChild
          .querySelectorAll("rStyle")[0]
          ?.getAttribute("w:val")
          .toLowerCase() || "";
      if (style) {
        outNode.classList.add(style);
      }

      //add bold, underline, highlight
      if (
        inNodeChild.querySelectorAll("b").length ||
        style.includes("bold") ||
        style.includes("emphasis")
      )
        val = "<b>" + val + "</b>";

      if (
        inNodeChild.querySelectorAll("u").length ||
        style.includes("underline") ||
        style.includes("emphasis")
      )
        val = "<u>" + val + "</u>";

      if (inNodeChild.querySelectorAll("highlight").length)
        val =
          '<span style="background-color:' +
          inNodeChild.querySelectorAll("highlight")[0].getAttribute("w:val") +
          '">' +
          val +
          "</span>";

      outNode.innerHTML += val;
    }

    //add to output
    output += "<p>" + outNode.outerHTML + "</p>";
  }

  return output;
}
