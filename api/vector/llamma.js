import {fileURLToPath} from "url";
import path from "path";
import {
    LlamaModel, LlamaContext, LlamaChatSession, LlamaChatPromptWrapper
} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

//  ipull https://huggingface.co/TheBloke/Llama-2-7b-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf
const MODEL_NAME = 'llama-2-7b-chat.Q4_K_M.gguf'

const model = new LlamaModel({
    modelPath: path.join(__dirname, MODEL_NAME),
    promptWrapper: new LlamaChatPromptWrapper()
});
const context = new LlamaContext({model});
const session = new LlamaChatSession({context});


const q1 = "Hi there, how are you?";
console.log("User: " + q1);

const a1 = await session.prompt(q1);
console.log("AI: " + a1);


const q2 = "Where do llamas come from?";
console.log("User: " + q2);

const a2 = await session.prompt(q2);
console.log("AI: " + a2);