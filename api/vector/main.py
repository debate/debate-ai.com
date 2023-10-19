import fasttext
from fastapi import FastAPI

app = FastAPI()

model = fasttext.load_model("/var/opt/debate2vec.bin")


@app.get("/similar")
async def similar(word: str, count: int = 50):
    similar = model.get_nearest_neighbors(word, k=count)
    similar = list(map(lambda x: x[1], similar))

    return {"query": word, "similar": similar}


@app.get("/vector")
async def tag(tag: str):
    vector = model.get_sentence_vector(tag).tolist()
    return vector



@app.get("/allwords")
async def similar():
    
    allwords = model.words

    return allwords
