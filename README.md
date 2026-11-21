# OpenCode Model Efficiency

Aplicação web estática para comparar os modelos do **OpenCode Go** por eficiência de franquia,
combinando:

- **OpenCode Go** → preços por milhão de tokens e limite mensal de cada modelo nos planos Go e Go Plus.
- **Artificial Analysis** → Intelligence Index, Engineering Index e custo por tarefa.

Três páginas: **Ranking** (top 10 por eficiência, com visões de programação e geral), **Calculadora**
(consumo da franquia por tarefa) e **Metodologia** (fórmulas, fontes e limitações).

## Desenvolvimento 100% em Docker

Nada é instalado na máquina host — só é necessário Docker Desktop.

```bash
docker compose up dev
# http://localhost:5173
```

Outros comandos:

```bash
docker compose run --rm build                      # typecheck + build em ./dist
docker compose run --rm update                     # atualiza os JSONs (precisa da AA_API_KEY)
docker compose run --rm update sh -c "npm install && npm run test:calc"  # testes das fórmulas
```

O `node_modules` fica em um volume Docker, nunca no host.

## Chave da Artificial Analysis (gratuita)

1. Crie uma chave em <https://artificialanalysis.ai/api-key-management-redirect>.
2. Copie `.env.example` para `.env` e preencha `AA_API_KEY`.
3. Rode `docker compose run --rm update`.

Sem a chave, a calculadora funciona com o catálogo do OpenCode, mas o ranking fica vazio:

```bash
docker compose run --rm update npm run update:data -- --skip-aa
```

## Como o ranking é calculado

Para cada modelo:

```
consumo_normalizado = custo_por_tarefa / limite_mensal_do_modelo
score_bruto         = índice / consumo_normalizado
score_exibido       = 100 × score_bruto / melhor_score_bruto
```

- Visão **Programação** (principal): Engineering Capability Index da AA (proxy de coding).
- Visão **Geral**: Intelligence Index.
- O custo por tarefa da AA é ajustado aos preços do OpenCode quando diferem (promoções).
- Modelos sem dados suficientes ou gratuitos ficam fora do ranking, com o motivo listado.
- O ranking é recalculado para Go e Go Plus, pois os limites mensais mudam entre os planos.

Detalhes completos na página de metodologia do próprio site.

## Dados e atualização automática

O arquivo `scripts/update-data.ts`:

1. Baixa `https://opencode.ai/inference/go/v1/models` (público).
2. Baixa a página da Data API da AA (`/api/v2/language/models/free`, paginada).
3. Faz a correspondência via `mappings.json` + fallback por nome.
4. Recalcula os rankings e grava `public/data/{models,aa,ranking,meta}.json`.

O workflow `.github/workflows/update-and-deploy.yml` roda diariamente às 06:00 UTC e a cada push
na `main`: atualiza os dados, roda os testes, builda e publica no GitHub Pages. Se a coleta falhar,
nada é sobrescrito.

### Deploy no GitHub Pages

1. Crie o repositório e faça push da `main`.
2. Em **Settings → Secrets and variables → Actions**, adicione `AA_API_KEY` (recomendado; sem
   ela o site publica só com a calculadora e o ranking fica vazio).
3. Em **Settings → Pages**, selecione **GitHub Actions** como source.
4. Rode o workflow manualmente na primeira vez (aba **Actions → Update data and deploy → Run**).

O site usa `HashRouter` e `base: './'`, então funciona em qualquer subcaminho do Pages.

## Estrutura

```
├─ Dockerfile / docker-compose.yml     # ambiente de dev (host limpo)
├─ mappings.json                       # opencode-id → slugs da AA
├─ scripts/update-data.ts              # coleta + cálculo + JSONs
├─ scripts/test-calc.ts                # testes das fórmulas
├─ src/lib/calc.ts                     # fórmulas puras, compartilhadas
├─ src/pages/{Ranking,Calculator,Methodology}.tsx
└─ public/data/*.json                  # dados consumidos pelo site
```

## Limitações

- Preços base: multiplicadores horários e overrides por contexto não entram no cálculo.
- Engineering Index é um proxy de engenharia; a AA descontinuou o Coding Index.
- A correspondência entre catálogos é manual e pode atrasar a entrada de modelos novos. A AA
  publica variantes de esforço (Max/High) como entradas separadas; o `mappings.json` aponta para a
  variante principal de cada modelo. Se um modelo aparecer como "sem Intelligence Index", confira
  se o slug mapeado é a versão/variante avaliada mais recente.
- Projeto pessoal e informativo, sem afiliação com OpenCode ou Artificial Analysis.
