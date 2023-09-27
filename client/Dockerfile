FROM oven/bun:1.0.3 AS runtime
WORKDIR /app
COPY package.json ./
RUN bun i
COPY . .

EXPOSE 5173
CMD  bunx --bun vite --host 0.0.0.0
