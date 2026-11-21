FROM node:22-alpine

WORKDIR /app

# As dependências vivem apenas na imagem / volume do container.
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
