import fasttext
from fastapi import FastAPI

app = FastAPI()

model = fasttext.load_model("debate2vec.bin")


@app.get("/similar")
async def similar(word: str, count: int = 30):
    
    similar = model.get_nearest_neighbors(word, k=count)
    similar = list(map(lambda x: x[1], similar))

    return {"word": word, "similar": str(similar)}


@app.get("/tag")
async def tag(tag: str):
    
    arr = model.get_sentence_vector(tag)

    return {"tag": tag, "vector": str(arr)}



@app.get("/allwords")
async def similar():
    
    allwords = model.words

    return allwords
