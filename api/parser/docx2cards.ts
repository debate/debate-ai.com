
import { documentToTokens } from './card-parser/document';
import { extractCards } from './card-parser/parse';
import fs from 'fs';

async function main(){

    var doc = process.argv[process.argv.length - 1];

    var tokens = await documentToTokens(doc);
    // console.log(tokens)

    var cards = extractCards(tokens)

    // console.log(cards)


    cards = cards.map((card, index) => {

        card.summary="";
        card.fulltext="";

        return {
            ...card,
        }
    });

    var outputJSON = JSON.stringify(cards)

    
    var outputPath=doc.replace(".docx", ".json")

    fs.writeFileSync(outputPath, outputJSON); 
    
    

}


main();