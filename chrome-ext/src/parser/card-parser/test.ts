
import { documentToTokens } from './document';
import { extractCards } from './parse';

async function main(){

    var doc = process.argv[2];

    var tokens = await documentToTokens(doc);
    console.log(tokens)

    return 1;


    var cards = extractCards(tokens)
    

}


main();