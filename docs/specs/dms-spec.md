# Especificação - Document Management System

## 1. Objetivo

Entregar uma aplicação web simples para que usuários enviem, consultem e baixem
seus documentos, mantendo os arquivos no filesystem local e os metadados em
memória.

## 2. Escopo

### Dentro do escopo

- Envio de um documento por requisição.
- Listagem dos metadados dos documentos do usuário.
- Download do arquivo pelo identificador do documento.
- Separação dos documentos por usuário, usando a identidade fornecida à API.
- Interface React para envio, listagem e download.
- Armazenamento de arquivos em `backend/storage` e de metadados em memória.
- Configuração do backend por variáveis de ambiente.

### Fora do escopo

- Persistência de metadados em banco de dados ou recuperação automática deles
  após reiniciar o processo.
- Armazenamento em nuvem, serviços externos ou provedores de upload.
- Versionamento, edição, exclusão, compartilhamento ou busca avançada de
  documentos.
- Cadastro, login, autenticação e autorização formais.
- Paginação e upload de múltiplos arquivos em uma única requisição.

## 3. Requisitos funcionais

| ID    | Requisito |
| ----- | --------- |
| RF-01 | O usuário pode enviar um arquivo usando formulário multipart com o campo `file`. |
| RF-02 | O sistema valida a presença de um arquivo, rejeita arquivos acima do limite configurado e retorna erro HTTP apropriado para entradas inválidas. |
| RF-03 | O sistema gera um identificador único e um nome de armazenamento interno; o nome enviado pelo usuário não é usado como caminho no filesystem. |
| RF-04 | Após salvar o arquivo localmente, o sistema registra os metadados em memória e retorna o documento criado. |
| RF-05 | O usuário pode listar somente os documentos associados à sua identidade; a resposta é ordenada do mais recente para o mais antigo. |
| RF-06 | O usuário pode baixar um documento pelo identificador, desde que o documento exista e pertença à identidade da requisição. |
| RF-07 | Se o registro em memória não puder ser concluído após a gravação do arquivo, o arquivo recém-gravado deve ser removido e o erro deve ser reportado. |
| RF-08 | A interface permite selecionar e enviar um arquivo, exibir o resultado ou erro, listar documentos e iniciar o download de um documento. |
| RF-09 | A aplicação mantém o endpoint `GET /health` do seed para verificação do estado do backend. |

### Identidade do usuário nesta fase

Como autenticação não faz parte do escopo, a API recebe o identificador por meio
do cabeçalho `X-User-Id`. O valor deve ser não vazio após remoção de espaços e
deve ser tratado como identidade de demonstração, não como mecanismo seguro de
autenticação. As operações de lista e download sempre aplicam o filtro pelo
identificador recebido; o cliente não escolhe o dono por meio do corpo do
upload.

## 4. Requisitos não funcionais

| ID     | Requisito |
| ------ | --------- |
| RNF-01 | Gravar arquivos exclusivamente no filesystem local, em `backend/storage`, usando `multer` com `diskStorage`. |
| RNF-02 | Manter os metadados em memória nesta fase; reiniciar o backend perde os metadados, e os arquivos locais não devem ser considerados recuperáveis sem seus registros. |
| RNF-03 | Obter porta, diretório de armazenamento e limite de upload de variáveis de ambiente; fornecer padrões para desenvolvimento local. |
| RNF-04 | Não expor caminho absoluto nem nome interno de armazenamento nas respostas públicas da API. |
| RNF-05 | Usar identificadores únicos e caminhos de armazenamento construídos pelo servidor, sem confiar em nomes ou caminhos fornecidos pelo cliente. |
| RNF-06 | Tratar erros de validação, persistência de arquivo e consulta de documentos no limite HTTP com respostas consistentes. |
| RNF-07 | Manter a separação `routes -> controllers -> services -> repositories` e evitar dependência das camadas internas em Express ou React. |
| RNF-08 | O frontend deve chamar a API com o prefixo `/api`; em desenvolvimento, o proxy Vite existente remove esse prefixo e direciona as chamadas ao backend local. |
| RNF-09 | Usar CommonJS no backend, ESM no frontend, React Hooks e o runner nativo `node:test` para testes do backend. |

### Configuração proposta

| Variável | Padrão | Uso |
| -------- | ------ | --- |
| `PORT` | `3000` | Porta HTTP do backend. |
| `STORAGE_DIR` | `backend/storage` | Diretório local de gravação dos arquivos. |
| `MAX_FILE_SIZE` | `10485760` | Limite de upload em bytes (10 MiB). |

O diretório deve ser resolvido de forma previsível em relação ao processo ou ao
diretório raiz do backend, documentando-se a convenção adotada na implementação.
O limite deve ser aplicado pelo Multer e informado ao usuário quando excedido.

## 5. Modelo de dados (metadados do documento)

### Representação pública

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `id` | string | Sim | Identificador único, gerado pelo servidor. |
| `originalName` | string | Sim | Nome original fornecido pelo cliente, apenas para exibição e download. |
| `size` | number | Sim | Tamanho do arquivo em bytes. |
| `uploadedAt` | string | Sim | Data e hora do upload em formato ISO 8601 UTC. |
| `owner` | string | Sim | Identificador do usuário recebido em `X-User-Id`. |

### Dados internos de persistência

O repositório mantém, além da representação pública, uma chave ou nome interno
de armazenamento gerado pelo servidor (por exemplo, baseado no `id`). Esse
valor é necessário para localizar o arquivo no disco, mas não deve ser retornado
ao cliente. Os metadados são indexados por `id` em memória. O caminho absoluto
deve ser derivado do diretório configurado e da chave interna, sem concatenação
de caminhos arbitrários fornecidos pela requisição.

## 6. Contratos de API

### Convenções

- Rotas implementadas pelo backend: sem prefixo `/api`.
- Chamadas do frontend: prefixo `/api`, atendido pelo proxy Vite em
  desenvolvimento.
- Cabeçalho de identidade: `X-User-Id` obrigatório em endpoints de documentos.
- Tipo de erro: JSON no formato `{ "error": { "code": "...", "message": "..." } }`.
- Respostas de sucesso usam JSON, exceto no download, que retorna bytes.

### `POST /upload`

- **Entrada:** `multipart/form-data`, exatamente um arquivo no campo `file`;
  cabeçalho `X-User-Id`.
- **Sucesso:** `201 Created`, corpo JSON com os metadados públicos do documento.
- **Erros:**
  - `400 Bad Request` para cabeçalho de usuário ausente/inválido ou arquivo
    ausente.
  - `413 Payload Too Large` quando o arquivo exceder `MAX_FILE_SIZE`.
  - `500 Internal Server Error` para falha inesperada de gravação ou registro,
    sem revelar detalhes internos.
- **Efeito:** grava o arquivo com `diskStorage`, cria metadados do servidor e
  associa o documento ao usuário.

### `GET /documents`

- **Entrada:** cabeçalho `X-User-Id`.
- **Sucesso:** `200 OK`, corpo JSON no formato
  `{ "documents": [<metadados públicos>] }`. A lista contém somente os
  documentos do usuário e é ordenada por `uploadedAt` decrescente.
- **Erros:** `400 Bad Request` se o cabeçalho de usuário estiver ausente ou
  inválido; `500 Internal Server Error` para falha inesperada.
- **Observação:** usuário sem documentos recebe lista vazia, não erro `404`.

### `GET /documents/:id/download`

- **Entrada:** identificador na URL e cabeçalho `X-User-Id`.
- **Sucesso:** `200 OK`, conteúdo binário do arquivo, `Content-Type` coerente com
  o arquivo quando disponível e `Content-Disposition: attachment` com o nome
  original de forma segura.
- **Erros:**
  - `400 Bad Request` para cabeçalho ausente/inválido ou identificador inválido.
  - `404 Not Found` se o documento não existir, não pertencer ao usuário ou o
    arquivo não estiver disponível no disco. A resposta não deve revelar se um
    documento de outro usuário existe.
  - `500 Internal Server Error` para outras falhas inesperadas de leitura.

### `GET /health`

- **Sucesso:** `200 OK`, corpo `{ "status": "ok" }`, conforme o seed atual.

## 7. Decisões arquiteturais

### Backend

- `routes/`: registra métodos, caminhos e middlewares HTTP e encaminha para
  controllers.
- `controllers/`: lê parâmetros, cabeçalhos e arquivo recebido, valida a
  entrada no limite HTTP e mapeia o resultado para status e respostas.
- `services/`: concentra as regras de negócio, como associar documentos a
  usuários e decidir o comportamento de upload, listagem e download.
- `repositories/`: encapsula o acesso aos arquivos em disco e ao registro de
  metadados em memória.
- Multer com `diskStorage` grava exclusivamente no diretório local configurado.
  Nome interno e destino são definidos no servidor; o nome original é
  metadado, não caminho de armazenamento.
- Middleware de erro deve converter erros conhecidos do Multer e da aplicação
  para o contrato JSON sem ocultar falhas inesperadas.
- O endpoint `/health` existente é mantido, fora do fluxo de documentos.

### Frontend

- Componentes funcionais com Hooks: upload, listagem de documentos e ação de
  download, organizados em `components/`, `pages/` e `services/` conforme a
  necessidade da implementação.
- Um serviço de API centraliza chamadas `fetch` ao prefixo `/api`, incluindo
  `X-User-Id`, tratamento de respostas de erro e download binário.
- A interface informa estados de carregamento, sucesso, lista vazia e erro; não
  apresenta caminhos internos do servidor.
- Para esta fase sem autenticação, o identificador de usuário é um valor de
  demonstração configurado pelo cliente e não constitui controle de acesso
  seguro.

### Persistência e limites conhecidos

- Arquivos: filesystem local da aplicação em `backend/storage` por padrão.
- Metadados: estrutura em memória, sem banco de dados.
- O filesystem local e o registro em memória não formam uma transação. A
  implementação deve desfazer a gravação do arquivo se o registro falhar; uma
  queda abrupta pode deixar arquivos órfãos, limitação aceita nesta fase.
- Não servir o diretório de armazenamento como conteúdo estático; downloads
  passam pela verificação de metadados e proprietário.

## 8. Plano de execução

Este plano descreve trabalho futuro. A tarefa de planejamento cria somente este
documento; não cria nem executa arquivos de backend ou frontend.

1. **Preparar contratos e configuração:** estabelecer identidade de demonstração,
   formato de erro, variáveis de ambiente, limite de upload e convenções de
   caminhos locais.
2. **Implementar persistência local:** configurar repositório de metadados em
   memória e armazenamento de arquivos com Multer `diskStorage`, incluindo
   identificador interno, limites e limpeza em falha.
3. **Implementar regras de negócio:** criar serviços de upload, listagem e
   recuperação de download, aplicando associação e isolamento por usuário.
4. **Implementar API Express:** organizar routes/controllers e middleware de
   erro; expor `POST /upload`, `GET /documents`,
   `GET /documents/:id/download` e preservar `GET /health`.
5. **Verificar backend:** adicionar testes nativos para contratos, validação,
   limite de tamanho, isolamento por usuário, arquivo ausente e comportamento
   em falhas de persistência; garantir limpeza dos artefatos dos testes.
6. **Implementar integração frontend:** criar serviço de API e componentes de
   upload, listagem e download; cobrir estados de carregamento, vazio, sucesso
   e erro usando o proxy `/api`.
7. **Validar ponta a ponta:** executar testes e build disponíveis, confirmar
   upload local seguido de listagem e download, e validar que o plano e a
   implementação não dependem de armazenamento externo.
