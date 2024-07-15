import { describe, it, expect } from "vitest";
import { documentToTokens, documentToMarkup } from "../src/lib/docx/docx-to-html";
import { extractCards } from "../src/lib/docx/parse-cards";
import { tokensToMarkup } from "../src/lib/docx/docx-tokens";
import { parseDebateDocx } from  "../src/lib/docx/parse-debate-docx";
import { getFilesInFolder, handleZipOfDocx } from "../src/lib/docx/parse-zip-folder";
import fs from "fs";
import path from "path";

const INPUT_FOLDER = "./test/input";
const OUTPUT_FOLDER = "./test/output";

describe("extract-docx", () => {

  it("parse zip of docx into cards", async () => {
    return 1

    var zipPath = path.join(INPUT_FOLDER, "UM7.zip")
    var outputFolder = path.join(OUTPUT_FOLDER, "2022OpenEv JSON")
    var outout = await handleZipOfDocx(zipPath, outputFolder);
     
    expect(outputFolder).toBeDefined();

  })

  it("parse docx folder into cards", async () => {
    return 1

    var folder = "D:\\GitHub\\debate-ARCHIVE\\Debate23" //"/home/admin/Downloads/ndtceda23";

    var files = getFilesInFolder(folder);

    for (var i in files) {
      var filename = files[i];
      
      var evCollection = await parseDebateDocx(filename)


      var output = JSON.stringify(evCollection, null, 2)

      var outputPath = filename
        .replace(folder, folder.replace(/\/$/, "") + " JSON")
        .replace(".docx", ".json");

      var outputDir = outputPath.match(/(.*)[\/\\]/)[1] || "";

      fs.mkdirSync(outputDir, { recursive: true });
      if (output)
      fs.writeFileSync(outputPath, output);
    // return 1;
    }

    expect(output).toBeDefined();
  });

});

// // outputPath = outputPath.replace(INPUT_FOLDER.replace(/\\+$/g, ''), INPUT_FOLDER.replace(/\\+$/g, '') + " HTML")

// // fs.writeFileSync(outputPath, htmlDoc);
