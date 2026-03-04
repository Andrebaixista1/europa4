# Europa 4

Painel web para operacao de consultas de credito e gestao interna.

Este projeto centraliza, em uma unica tela, varios sistemas de consulta usados no dia a dia:
- IN100
- Consulta Clientes
- V8
- Prata
- Presenca
- Hand+

Tambem inclui Dashboard, historico, usuarios/equipes e modulos administrativos.

---

## 1) Explicacao rapida (linguagem leiga)

Pense no sistema como um "painel de controle":
- voce escolhe o tipo de consulta
- informa os dados do cliente (ou envia um CSV em lote)
- o sistema processa
- mostra resultado, status e exportacao

Cada consulta fala com APIs externas e grava historico para acompanhamento.

---

## 2) Mapa das abas ativas do menu lateral

Esta secao explica as abas que aparecem no menu da esquerda (como na sua imagem).

### Visao Geral
- O que e: entrada principal do sistema.
- Para que serve: abrir o dashboard com resumo de saldos e ultimas consultas.
- Rota: `/dashboard`

### Consultas (grupo)
- O que e: menu com todos os tipos de consulta.
- Para que serve: acessar telas de consulta individual, lote e historico.
- Rotas do grupo:
- `Consulta Individual (IN100)` -> `/consultas/in100`
- `Consulta Clientes` -> `/consultas/clientes`
- `Cliente Argus` -> `/consulta/cliente-argus`
- `Historico de Consultas` -> `/consultas/historico`
- `Consulta Presenca` -> `/consultas/presenca`
- `Consulta Hand+` -> `/consultas/handmais`
- `Consulta Prata` -> `/consultas/prata`
- `Consultas V8` -> `/consultas/v8`

### Gestao (grupo)
- O que e: menu administrativo de operacao/controle.
- Para que serve: acompanhar consumo, planejamento e relatorios.
- Itens (quando habilitado para o perfil):
- `Gestao de Recargas` -> `/recargas`
- `Controle Planejamento` -> `/admin/controle-planejamento`
- `Relatorios` -> `/admin/relatorios`

### Configuracoes (grupo)
- O que e: menu de administracao de acesso e estrutura.
- Para que serve: gerenciar pessoas e organizacao interna.
- Itens (quando habilitado para o perfil):
- `Usuarios` -> `/usuarios`
- `Equipes` -> `/equipes`
- `Backups` -> `/admin/backups` (normalmente apenas Master)

Observacao de perfil:
- Nem todas as abas aparecem para todos os perfis.
- As permissoes sao controladas por `role`/hierarquia.

Arquivos de referencia do menu:
- [SidebarNav.jsx](src/components/SidebarNav.jsx)
- [App.jsx](src/App.jsx)
- [access.js](src/utils/access.js)
- [roles.js](src/utils/roles.js)

---

## 3) O que cada sistema de consulta faz

### IN100 (Consulta Individual)
- Objetivo: buscar dados do cliente por CPF e/ou numero de beneficio.
- Uso comum: triagem inicial de cliente e conferencia de dados para atendimento.
- Resultado: dados de retorno da consulta, com informacoes de beneficio e status.

Arquivo principal:
- [ConsultaIN100.jsx](src/pages/ConsultaIN100.jsx)

### Historico de Consultas
- Objetivo: ver o historico das consultas feitas (principalmente IN100), com filtros e status.
- Uso comum: auditoria, acompanhamento de fila e revisao de respostas.

Arquivo principal:
- [HistoricoConsultas.jsx](src/pages/HistoricoConsultas.jsx)

### V8 (Individual e Em lote)
- Objetivo: consulta de dados de credito pela integracao V8.
- Pode rodar:
- Individual: 1 cliente por vez.
- Em lote: varios clientes via CSV.
- Tem controle de limite (total/usado/restante), status de processamento e exportacao CSV.
- Mostra tempo estimado em lote e permite acompanhar pendentes.

Arquivo principal:
- [ConsultasV8.jsx](src/pages/ConsultasV8.jsx)

### Prata (Individual e Em lote)
- Objetivo: consulta de dados e acompanhamento operacional no fluxo Prata.
- Pode rodar:
- Individual: 1 cliente por vez.
- Em lote: varios clientes via CSV.
- Exibe status por item, filtros, historico e exportacao.

Arquivo principal:
- [ConsultaPrata.jsx](src/pages/ConsultaPrata.jsx)

### Presenca (Individual e Em lote)
- Objetivo: consulta de elegibilidade e margem via integracao Presenca.
- Pode rodar:
- Individual: consulta pontual.
- Em lote: processamento de arquivo CSV.
- Mostra status por lote e permite exportar resultados.

Arquivo principal:
- [ConsultaPresenca.jsx](src/pages/ConsultaPresenca.jsx)

### Hand+ (Individual e Em lote)
- Objetivo: consulta de margem/resultado Hand+ para cliente CLT.
- Pode rodar:
- Individual: consulta unica.
- Em lote: upload CSV com varias linhas.
- Mostra limites, resultados por cliente, modal de detalhes e exportacao CSV.
- No lote, acompanha quantidade, status (P/OK/ER) e tempo estimado.

Arquivo principal:
- [ConsultasHandMais.jsx](src/pages/ConsultasHandMais.jsx)

### Consulta Clientes
- Objetivo: consolidar consultas e resultados por cliente.
- Uso comum: conferencia rapida de status/retorno por contrato e cliente.

Arquivo principal:
- [ConsultaClientes.jsx](src/pages/ConsultaClientes.jsx)

---

## 4) Dashboard (resumo operacional)

O Dashboard concentra:
- novidades da plataforma
- cards de saldo (IN100, V8, Presenca, Hand+)
- Top 10 consultas mais recentes por origem (clicando no card)

Arquivo principal:
- [Dashboard.jsx](src/pages/Dashboard.jsx)

---

## 5) Perfis e acesso

Perfis principais:
- Master
- Administrador
- Supervisor
- Operador

As rotas protegidas sao controladas no app.

Arquivos de referencia:
- [App.jsx](src/App.jsx)
- [SidebarNav.jsx](src/components/SidebarNav.jsx)
- [roles.js](src/utils/roles.js)
- [access.js](src/utils/access.js)

---

## 6) Arquitetura (visao simples)

Frontend:
- React + Vite
- Bootstrap + componentes proprios

Integracoes:
- endpoints n8n para consulta e limites
- endpoints Laravel para rotas auxiliares (ex.: operacoes especificas de consulta)
- SQL Server para persistencia de resultados e limites

Proxy/API serverless (pasta `api/`):
- repassa chamadas para backend e aplica CORS/timeout

Arquivos de referencia:
- [api/consulta-v8/[...path].js](api/consulta-v8/[...path].js)
- [api/consulta-presenca/[...path].js](api/consulta-presenca/[...path].js)

---

## 7) Fluxo de uso no dia a dia

Fluxo individual:
1. Escolher a consulta (IN100, Clientes, V8, Prata, Presenca ou Hand+).
2. Preencher dados do cliente.
3. Enviar.
4. Ver status/resultado.

Fluxo em lote:
1. Selecionar modo "Em lote".
2. Subir CSV no formato da tela.
3. Enviar.
4. Acompanhar processamento.
5. Exportar resultado em CSV.

---

## 8) Como rodar localmente

Pre requisitos:
- Node.js 18+ (recomendado)
- npm

Instalacao:
```bash
npm install
```

Ambiente:
```bash
# Linux/macOS
cp .env.example .env

# Windows (PowerShell)
copy .env.example .env
```

Desenvolvimento:
```bash
npm run dev
```

Build de producao:
```bash
npm run build
```

Preview local do build:
```bash
npm run preview
```

Lint:
```bash
npm run lint
```

---

## 9) Estrutura principal de pastas

- `src/pages/`: telas do sistema (consultas, dashboard, admin)
- `src/components/`: componentes reutilizaveis (menu, topbar, modais)
- `src/context/`: estado global (auth, sidebar, loading)
- `src/utils/`: regras utilitarias (roles, acesso, formatacao)
- `api/`: funcoes serverless/proxy
- `public/`: arquivos estaticos (logos, icones)

---

## 10) Observacoes importantes

- As consultas dependem de servicos externos (n8n, APIs de parceiros e banco).
- Queda ou lentidao desses servicos impacta o resultado no front.
- Em lote, o processamento pode terminar em tempos diferentes por login/limite/status.
- Limites diarios e regras de janela (ex.: 24h) sao aplicados no backend das consultas.

---

## 11) Variaveis de ambiente (referencia pratica)

Importante:
- use valores reais apenas no ambiente local/servidor.
- nao publique credenciais em repositorio.

Principais variaveis usadas no projeto:

| Variavel | Uso | Exemplo |
|---|---|---|
| `VITE_PRESENCA_LARAVEL_BASE_PATH` | Base da API Laravel para a tela Presenca (acoes de lote/DELETE) | `http://85.31.61.242:3002/api/consulta-presenca` |
| `VITE_PRESENCA_DELETE_TIMEOUT_MS` | Timeout (ms) para operacoes de exclusao no front Presenca | `60000` |
| `VITE_BMG_SOAP_URL` | Endpoint SOAP BMG no front (ou `/api/bmg` via proxy) | `/api/bmg` |
| `VITE_BMG_SOAP_ACTION` | SOAPAction usada na chamada do BMG | `inserirSolicitacao` |
| `login_bmg` / `senha_bmg` | Credenciais usadas na consulta IN100/BMG no front | `usuario` / `senha` |
| `N8N_BASE_URL` | Base para proxy `/api/n8n` no Vite | `http://localhost:5678` |
| `N8N_WEBHOOK_URL` | Destino de webhooks no proxy `/api/n8n` | `http://localhost:5679` |
| `PRESENCA_API_BASE_URL` | Base do proxy `/api/presenca` no Vite | `http://85.31.61.242:3011` |
| `V8_IMPORT_API_BASE_URL` | Base de `/api/clientes-v8`, `/api/consulta-v8`, `/api/consulta-presenca`, `/api/health-consult` no Vite | `http://85.31.61.242:3002` |
| `host_king` / `user_king` / `pass_king` / `database_king` | Credenciais SQL usadas pelo serverless de Presenca | `85.31.61.242` / `andrefelipe` / `***` / `presenca` |
| `CONSULTA_PRESENCA_BASE_URL` | Upstream do proxy serverless de Presenca | `http://85.31.61.242:3002/api/consulta-presenca` |
| `CONSULTA_PRESENCA_PROXY_TIMEOUT_MS` | Timeout do proxy Presenca (ms) | `45000` |
| `CONSULTA_PRESENCA_SQL_TIMEOUT_MS` | Timeout SQL Presenca (ms) | `30000` |
| `CONSULTA_V8_PROXY_TIMEOUT_MS` | Timeout do proxy V8 (ms) | `240000` |
| `HEALTH_CONSULT_UPSTREAM_URL` | Upstream do health-check de backups | `http://85.31.61.242:3002/api/health-consult` |
| `HEALTH_CONSULT_FORCE_UPSTREAM_URL` | Upstream para forcar backup | `http://85.31.61.242:3002/api/health-consult/force-backup` |
| `V8_IMPORT_CSV_UPSTREAM_URL` | Override do upstream de importacao CSV V8 | URL completa |
| `V8_IMPORT_STATUS_UPSTREAM_URL` | Override do upstream de status de importacao V8 | URL completa |
| `TERMO_HTTP_PORT` | Porta do script `accept-termo-http.js` | `3211` |

---

## 12) Endpoints serverless/proxy (`api/`)

- `api/n8n/[...path].js`: proxy para n8n.
- `api/bmg.js`: proxy SOAP do BMG com CORS.
- `api/consulta-v8/[...path].js`: proxy para backend de consulta V8.
- `api/consulta-presenca/[...path].js`: proxy para backend Presenca e rota de DELETE com SQL direto.
- `api/clientes-v8/import-csv.js`: endpoint de importacao em lote V8.
- `api/clientes-v8/import-status.js`: endpoint de status da importacao V8.
- `api/health-consult.js`: health check do backend de backups.
- `api/health-consult/force-backup.js`: aciona backup forcado.

---

## 13) Troubleshooting rapido

- Erro de CORS no front:
  confira se a chamada esta indo para `/api/...` (proxy) no ambiente local.
- Timeout em lote:
  ajuste `CONSULTA_V8_PROXY_TIMEOUT_MS` ou `CONSULTA_PRESENCA_PROXY_TIMEOUT_MS`.
- Erro SQL na exclusao de lote Presenca:
  valide `host_king`, `user_king`, `pass_king`, `database_king` e porta SQL.
- IN100/BMG sem resposta:
  valide `VITE_BMG_SOAP_URL`, `VITE_BMG_SOAP_ACTION`, `login_bmg` e `senha_bmg`.

---

## 14) Resumo final (bem direto)

Se voce precisa explicar o Europa 4 para alguem:
- e um painel unico para consultar clientes em diferentes provedores
- tem modo individual e lote
- mostra saldo, status, historico e exportacao
- separa acesso por perfil e organiza tudo em um dashboard operacional
