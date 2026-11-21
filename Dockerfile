# Debian/glibc para bater com o runner ubuntu-latest do GitHub Actions.
# (Alpine/musl gerava um package-lock sem o binário nativo do Rollup para glibc.)
FROM node:22-bookworm-slim

WORKDIR /app

# As dependências vivem apenas na imagem / volume do container.
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
