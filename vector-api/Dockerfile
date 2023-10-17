FROM tiangolo/uvicorn-gunicorn:python3.11
WORKDIR /app

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY . /app

RUN if [ ! -e debate2vec.bin  ]; then wget https://huggingface.co/Hellisotherpeople/debate2vec/resolve/main/debate2vec.bin  ; fi
 

ENTRYPOINT uvicorn main:app --reload --host 0.0.0.0 --port 8000