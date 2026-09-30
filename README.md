# encurtador-url-api

API REST de encurtador de URL, em Node puro (sem framework, sem dependência nenhuma).

## a decisão

O jeito "normal" de gerar código curto é sortear uma string aleatória e ficar checando
se já existe (e sortear de novo se colidir). Eu não fiz isso. Uso um contador
sequencial (começa em 1000) e converto pra base62 (`toBase62`). Isso elimina
colisão por construção — não preciso checar nada, o próximo código é sempre novo.

A troca é clara: os códigos ficam previsíveis (`qi`, `qj`, `qk`, ...), então dá pra
adivinhar quantas URLs já foram criadas e até tentar acessar código vizinho. Pra um
serviço real isso seria um problema de privacidade/enumeração. Pra esse projeto,
que é sobre entender o trade-off e não sobre esconder contagem de usuários, achei
que valia mais a simplicidade e a garantia de zero colisão do que aleatoriedade.

Comecei o contador em 1000 em vez de 0 só pra não gerar código de 1 caractere logo
de cara (ia parecer bug, não feature).

## rotas

- `POST /api/shorten` — body `{"url": "https://..."}`, retorna `{code, url, shortPath}`. Só aceita `http`/`https`.
- `GET /:code` — redireciona (302) pra URL original e soma 1 no contador de hits.
- `GET /api/stats/:code` — retorna `{code, url, hits, createdAt}`.

Armazenamento é só em memória (`Map`) — reinicia o processo, perde tudo. É de
propósito: o foco daqui é a API e o design do código curto, não persistência.

## rodando

```bash
node src/server.js
```

Sobe em `http://localhost:3000` (ou na porta de `PORT`).

## testes

```bash
node --test tests/server.test.js
```

6 testes usando só `node:test` + `fetch` nativo (Node 24) — nenhuma dependência de
teste também. Cobre: encode base62, validação de URL, criar+redirecionar,
contagem de hits, URL inválida (400) e código inexistente (404).
