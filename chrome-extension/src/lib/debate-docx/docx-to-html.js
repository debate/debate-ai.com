import AdmZip from "adm-zip";
import fs from "fs";
import { Parser } from "htmlparser2";

import tokens from "./docx-tokens";

/**
 * Converts docx  file to array or token objects with text and formatting
 *  1 - open document.xml and styles.xml by unzipping .docx file
 *  2 - tokenize document.xml and pull info on named styles from styles.xml
 * @param {string} filepath - File Path to a DOCX file
 * @param {object} { preserveStyles = true }
 * @returns html basic formatting

*/
export async function documentToTokens(docxPath, options) {
  if (!docxPath) return;

  //load file or download url into memory buffer
  var buffer = Buffer.isBuffer(docxPath)
    ? docxPath
    : docxPath?.startsWith("http")
    ? await (await fetch(docxPath)).arrayBuffer()
    : await fs.readFileSync(docxPath);
  try {
    var zip = new AdmZip(buffer);

    var styleXML = zip.readAsText(zip.getEntry("word/styles.xml"));
    var docXML = zip.readAsText(zip.getEntry("word/document.xml"));
  } catch (e) {
    return;
  }

  const styleData = await exports.createStyleParser(styleXML);

  var blocks = await exports.createTokenizer(docXML, styleData);

  if (options === null || options === void 0 ? void 0 : options.simplified) {
    const simplifiedBlocks = blocks.map(tokens.simplifyTokens);
    return simplifiedBlocks;
  }
  return blocks;
}

/** 
  1 - open document.xml
  2 - tokenize xml
  3 - reconstruct cleaned html
*/
export async function  documentToMarkup  (filepath) {
  const docTokens = await exports.documentToTokens(filepath);
  return tokens.tokensToMarkup(docTokens);
};


export async function createStyleParser (styleXML) {
  const parsedStyles = {};
  let styleName = "";
  return await new Promise((resolve, reject) => {
    var parser = new Parser(
      {
        onopentag(name, attributes) {
          if (name === "w:style") {
            styleName = attributes["w:styleId"];
            parsedStyles[styleName] = {
              underline: false,
              strong: false,
              mark: false,
            };
          }

          if (styleName) {
            var styles = parsedStyles[styleName];

            if (name === "w:u")
              styles.underline = attributes["w:val"] !== "none";
            else if (
              name === "w:highlight" ||
              styleName.toLowerCase().includes("highli")
            )
              styles.mark = true;
            else if (name === "w:b")
              styles.strong = attributes["w:val"] !== "0";
          }
        },
        onend: () => resolve(parsedStyles),
        onerror: reject,
      },
      { xmlMode: true }
    );

    parser.write(styleXML);

    parser.end();
  });
};


/**
 * Parses doc xml to tokenize each text range into
 * {text: "", format: { underline, strong, mark }
 * @param {string} docXML string from docx unzip
 * @param {object} styleData parsed object of style class names
 * @returns {array}  blocks[]
 */
export async function createTokenizer (docXML, styleData) {
  const blocks = [];
  let block;
  let token;
  return await new Promise((resolve, reject) => {
    var parser = new Parser(
      {
        onopentag(name, attributes) {
          if (name === "w:p") block = { format: "text", tokens: [] };
          else if (name === "w:pStyle")
            block.format = tokens.getStyleNameByXml(attributes["w:val"]);
          else if (name === "w:outlineLvl")
            block.format = tokens.getOutlineLvlName(+attributes["w:val"] + 1);
          else if (name === "w:r")
            token = {
              text: "",
              format: { underline: false, strong: false, mark: false },
            };
          else if (token) {
            if (name === "w:rStyle")
              token.format = { ...styleData[attributes["w:val"]] };

            if (name === "w:u")
              token.format.underline = attributes["w:val"] !== "none";
            else if (name === "w:highlight") token.format.mark = true;
            else if (name === "w:b")
              token.format.strong = attributes["w:val"] !== "0";
          }
        },
        ontext(data) {
          if (token) token.text += data;
        },
        onclosetag(name) {
          if (name === "w:p" && block.tokens.length) blocks.push(block);
          else if (name === "w:r" && token.text) block.tokens.push(token);
        },
        onend: () => resolve(blocks),
        onerror: reject,
      },
      { xmlMode: true }
    );

    parser.write(docXML);

    parser.end();
  });
};

exports.createTokenizer = createTokenizer;
