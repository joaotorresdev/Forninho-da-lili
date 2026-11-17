# Forninho da Lili — site + área administrativa

Site de demonstração da confeitaria, dividido em páginas, com uma área administrativa separada em `/admin`.

## Estrutura

```
forninho-da-lili/
├── index.html            Início: hero, vitrine, "como encomendar"
├── cardapio.html         Cardápio com filtros (lê os produtos do "banco")
├── sobre.html            Sobre Nós
├── contato.html          Contato
├── 404.html              Página não encontrada
├── assets/
│   ├── css/estilo.css    Estilo do site (o mesmo do index.html original)
│   ├── fontes/           Fontes (antes ficavam embutidas no HTML)
│   ├── img/              Logo, fotos da vitrine e img/produtos/
│   └── js/
│       ├── dados.js      "Banco" provisório (localStorage), espelha as tabelas do SQLite
│       ├── loja.js       Carrinho, pedido em etapas e envio pelo WhatsApp (todas as páginas)
│       └── cardapio.js   Monta o cardápio só com produtos ativos
├── admin/                ← NÃO tem link no site. Abre digitando .../admin
│   ├── index.html        Tela de login (usuário e senha)
│   ├── painel.html       Visão geral: faturamento, ticket médio, a receber, próximas entregas
│   ├── pedidos.html      Lista de pedidos (situação, pagamento, origem, próximo passo)
│   ├── pedido-form.html  Criar/editar pedido: itens, entrega, taxa, pagamento
│   ├── agenda.html       Pedidos por data de entrega (30 dias), limite por dia e folgas
│   ├── producao.html     O que preparar no dia: quantidades somadas e observações
│   ├── banner.html       Página inicial: imagem, título, texto e informações do banner
│   ├── configuracoes.html WhatsApp, PIX (chave e QR code), taxa, retirada, antecedência, limite, folgas
│   ├── produtos.html     Lista de produtos (busca, filtros, ativar/desativar, excluir)
│   ├── produto-form.html Criar/editar produto, com envio de foto
│   ├── clientes.html     Lista de clientes, com total pago e último pedido
│   ├── cliente-form.html Criar/editar cliente
│   └── assets/           admin.css e admin.js (proteção por login)
├── banco/                Scripts do SQLite (01_criar_tabelas.sql, 02_dados_exemplo.sql)
└── Dockerfile            Para publicar no Render (PHP 8.2 + Apache + SQLite)
```

## Como testar

Use um servidor local para que o site e o admin enxerguem os mesmos dados:

- VS Code: extensão **Live Server**, abrir `index.html`; ou
- terminal: `php -S localhost:8000` na pasta do projeto (o mesmo comando servirá a versão PHP).

Acesso ao painel: `http://localhost:8000/admin`. **Usuário:** `lili` · **Senha:** `forninho2026`

Teste rápido: cadastre um produto no painel → abra o Cardápio → ele aparece. Desative → some do site.

**Atualizou os arquivos e alguma tela ficou desconfigurada?** O navegador pode estar usando o CSS ou o JS antigo guardado em cache. Todas as páginas carregam esses arquivos com `?v=` no final (ex.: `estilo.css?v=20261117a`): ao mudar um CSS ou JS, troque esse número em todas as páginas (Localizar e substituir no editor). Para resolver na hora, recarregue com **Ctrl + Shift + R** (ou Ctrl + F5).

Teste do pedido: no Cardápio, adicione doces → **Pedido** → preencha entrega e data → **Enviar pedido pelo WhatsApp**. O WhatsApp abre com a mensagem pronta e o pedido aparece no painel como "Novo", com a etiqueta **Site**.

## O que mudou nesta versão (levantamento de UX/UI)

**Segurança dos dados do pedido (17/11/2026)**

- O pedido agora pede **nome completo, CPF e WhatsApp com DDD** (todos obrigatórios) e o endereço com número.
- O site **barra dados inventados** antes de deixar revisar o pedido, com a mensagem de erro embaixo do campo (aparece ao sair do campo e ao clicar em "Revisar pedido"):
  - **Nome:** precisa de nome e sobrenome, só letras; recusa letra repetida ("nnnnnn"), palavras sem vogal ("jkhgf"), sequências de teclado ("asdf", "qwerty"), sílabas repetidas ("lalala"), nome e sobrenome iguais e palavras como "teste" e "fulano". O nome é salvo com iniciais maiúsculas.
  - **CPF:** máscara 000.000.000-00 e conferência dos **dois dígitos verificadores** (a mesma conta da Receita). Recusa números repetidos (111.111.111-11) e o famoso 123.456.789-09.
  - **WhatsApp:** 11 números, **DDD que existe**, celular começando com 9; recusa número repetido ou com só 2 algarismos ("11999999999", "(11) 98989-8989"), sequências ("(11) 91234-5678", "(11) 98765-4321") e o próprio número da loja.
  - **Endereço:** pelo menos rua e número (ou "s/n"), sem letras repetidas.
- O CPF vai na mensagem do WhatsApp e na revisão, e o cliente passa a ser reconhecido **pelo CPF** (quem volta a comprar não vira um cadastro novo).
- **Painel:** campo CPF no cadastro de cliente (com as mesmas verificações e aviso se o CPF já é de outra pessoa), CPF na lista de clientes e busca por CPF. No painel o nome pode ser só o primeiro nome e o telefone pode ser fixo, porque quem cadastra é a Lili.
- **Limite honesto:** essas regras barram dados *obviamente* falsos, mas não provam que o CPF é da pessoa (isso exigiria consulta paga à Receita/Serpro). A confirmação final continua sendo o comprovante do PIX no WhatsApp: a Lili pode comparar o nome do pagador com o nome do pedido. Na versão PHP as mesmas regras devem ser repetidas no servidor (`pedido_site_salvar.php`), porque o JavaScript pode ser desligado.
- **LGPD:** o aviso no pedido explica que nome, CPF e WhatsApp são conferidos para evitar pedidos falsos e usados só para o pedido.

**Para a cliente (site)**

- **Carrinho:** "Adicionar ao pedido" no cardápio e na vitrine, com quantidade (− / +), contador no topo e barra "Ver pedido" no celular. O carrinho continua salvo se a página for fechada.
- **Pedido em 4 etapas:** itens (subtotal por produto) → entrega e dados (nome completo, CPF, WhatsApp, endereço, data, horário, PIX ou dinheiro, observações) → revisão → **pagamento**.
- **Tela de pagamento (PIX):** o pedido é registrado e aparecem, nesta ordem, o valor, o **QR code**, a **chave PIX com botão de copiar** (funciona no celular: usa a área de transferência e, se o navegador bloquear, seleciona a chave para copiar), o passo a passo **"Como comprar?"** com o nome de quem recebe e o valor, o aviso *"O pedido só será aprovado após o envio do comprovante via WhatsApp"* e, por último, o botão **Enviar comprovante pelo WhatsApp**. Pagamento em dinheiro e kit sob consulta têm um passo a passo próprio.
- **Datas bloqueadas:** o site não aceita datas antes da antecedência mínima, em dia de folga ou com a agenda cheia.
- **Mensagem do WhatsApp:** produtos, valor de cada um, subtotal, entrega, total, chave PIX e "Segue o comprovante do PIX" (a cliente anexa o comprovante na conversa).
- **PIX copia e cola com o valor:** aparece na tela de pagamento quando a chave, o nome e a cidade estão configurados.
- **Banner editável:** imagem, título, texto e as 3 informações abaixo do banner vêm do painel (Página inicial).
- **Informações:** quadro com antecedência, taxa, retirada, horário e cancelamento em "Como encomendar", seção **Dúvidas frequentes** e aviso de privacidade (LGPD) no pedido.
- **Contato:** o formulário agora abre o WhatsApp com a mensagem escrita.
- **Ficha do produto:** ingredientes, conservação e tamanho, e "pedido mínimo" quando houver.

**Para a Lili (admin)**

- **Pedidos do site entram sozinhos** como "Novo", com o cliente cadastrado (ou reaproveitado pelo CPF). O menu mostra quantos pedidos novos existem.
- **Pagamento separado da situação:** cada pedido tem forma de pagamento e "pago / a receber", com um clique para alternar.
- **Próximo passo:** botão "Marcar em preparo / pronto / entregue" ao lado da situação.
- **Data de entrega**, horário, endereço e taxa no pedido. Pedidos atrasados aparecem destacados.
- **Agenda** (30 dias, com limite por dia e folgas) e **Produção do dia** (quantidades somadas, observações, imprimir).
- **Visão geral:** faturamento (só pagos), ticket médio, a receber, cancelados, próximas entregas, vendas por item e entregas por dia da semana.
- **Clientes:** total pago, último pedido e etiqueta "Recorrente".
- **Configurações:** WhatsApp, Instagram, horário, chave PIX, **imagem do QR code PIX**, taxa, endereço de retirada, antecedência, limite por dia, folgas e política de cancelamento. Informação não preenchida não aparece no site (nada de "a confirmar" para a cliente).
- **Página inicial:** troca a imagem do banner (sem cortes, com prévia ao vivo), o título, o texto e as 3 informações da faixa abaixo. Há um botão para voltar ao texto original.

**Dados confirmados pela cliente:** chave PIX = celular da Lili (+55 11 98963-4843), taxa de entrega de R$ 10,00, **só entrega** (sem retirada, pode ser ligada em Configurações), preços do cardápio e nenhum horário de atendimento no site. Produtos sem foto mostram o selo da marca. Já vêm preenchidos e podem ser alterados no painel.
- **Produto:** quantidade mínima, ingredientes, conservação, tamanho e caixinhas de alérgicos que montam o aviso.

Nenhuma informação nova sobre a loja foi inventada: o que a cliente ainda não confirmou fica vazio em Configurações e simplesmente não aparece no site até ser preenchido.

## Roteiro do professor

1. **Tirar do site todas as evidências do administrador**: botão "Área do Admin" do topo e do rodapé, seção de demonstração do painel e menções a "painel" nos textos e na descrição da página foram removidos. As páginas do admin têm `noindex` (não aparecem no Google).
2. **Pasta `admin` com os recursos administrativos**: pedidos, produtos e clientes, com CRUD completo (criar, ler, editar, excluir).
3. **Tela de login**: `.../admin` abre a tela com "usuário" e "senha". Sem login, qualquer página do admin volta para essa tela. Botão "Sair" encerra a sessão (que também expira em 8 horas).
4. **Autocrítica**: abaixo.

## 4. Autocrítica: pensando no futuro

### Quando a Lili precisar acrescentar mais produtos, como vai fazer?

**Antes:** cada produto era um bloco de HTML copiado à mão dentro do `index.html`. Ela dependeria de alguém que sabe programar, e um erro de cópia podia quebrar a página.

**Agora:** Painel → Produtos → **+ Novo produto**. Ela preenche nome, categoria, preço, descrição, aviso de alérgicos e envia a foto pelo celular (o sistema corta em quadrado e reduz). Ao salvar, o produto aparece no cardápio na hora. Sem foto, o site mostra "Foto em breve". Sem preço, mostra "Sob consulta".

**O que ainda falta:** criar categorias novas pelo painel (hoje são fixas: Docinhos, Cookies, Kits) e escolher a ordem dos produtos. Na vitrine animada da página inicial, nome, preço, descrição e botão já vêm do cadastro (`data-produto`), mas a escolha dos 4 doces e as fotos continuam no HTML, porque a animação foi feita para exatamente 4 itens.

### Se ela não trabalha mais com algum produto, como será a tratativa?

**Desativar em vez de excluir.** O botão **Desativar** tira o produto do cardápio, mas mantém o cadastro, então os pedidos antigos continuam mostrando o que foi vendido e o relatório "Vendas por item" continua correto. Se o produto voltar (um doce sazonal, por exemplo), é só clicar em **Ativar**.

**Exclusão protegida.** "Excluir" só funciona para produtos que nunca foram vendidos (cadastro feito por engano). Se o produto já aparece em algum pedido, o sistema não deixa excluir e oferece desativar. A mesma regra vale para clientes com pedidos. No SQLite isso é garantido pela chave estrangeira `pedido_item.produto_id`, não só pela tela.

**Preço histórico.** Cada item do pedido guarda o preço do momento da venda (`preco_unitario`). Se ela aumentar o preço amanhã, o faturamento do mês passado não muda.

### Outros pontos fracos que reconhecemos

- **Segurança do login:** nesta versão estática o login é só uma demonstração. A senha está no código JavaScript e os dados ficam no navegador. Isso **não protege nada de verdade**. Na versão PHP: senha com `password_hash`/`password_verify`, sessão com `$_SESSION` verificada em todas as páginas do admin (`protecao.php`), limite de tentativas de login e HTTPS (o Render já fornece).
- **Dados só no navegador:** o `localStorage` vale para um navegador em um computador. Se a Lili cadastrar no celular, o computador não vê. O SQLite no servidor resolve.
- **Fotos grandes:** no navegador cabem poucas fotos (cerca de 5 MB no total). No PHP, as fotos vão para `assets/img/produtos/` como arquivos.
- **Pedido do site sem confirmação de envio:** o pedido é gravado quando a cliente vai para a tela de pagamento, mas o site não sabe se ela pagou nem se mandou o comprovante. Por isso ele entra como "Novo" e "a receber", e a Lili confirma pelo WhatsApp. Nesta versão estática o pedido fica no navegador de quem comprou; só na versão PHP ele chega de verdade ao painel da Lili.
- **Pagamento conferido à mão:** o PIX copia e cola já leva o valor, mas a Lili ainda confere no banco e marca "pago". Uma integração com o banco exigiria um serviço de pagamento, fora do escopo.
- **QR code na mensagem do WhatsApp:** o link `wa.me` só leva texto, não imagem. Por isso o QR code aparece na tela de pagamento do site, com botão para baixar. Na versão PHP, a imagem enviada vira um arquivo (`uploads/qrcode-pix.png`) e a mensagem passa a levar o link dela automaticamente. Nesta demonstração a imagem fica guardada no navegador e não tem endereço público para ir na mensagem.
- **Mensagem pelo WhatsApp:** o site não envia mensagem sozinho para a cliente. O link `wa.me` abre o WhatsApp de quem está no site; avisos automáticos exigiriam a API paga do WhatsApp Business.
- **Formulário de contato:** abre o WhatsApp com a mensagem pronta. No PHP ele pode também gravar numa tabela `mensagem` e aparecer no painel.
- **Ainda a confirmar com a cliente:** imagem do QR code PIX e cidade (para o PIX copia e cola), Instagram, horários, prazo mínimo de encomenda, limite de pedidos por dia, endereço de retirada, região de entrega, política de cancelamento, ingredientes e validade dos doces. Tudo isso já tem lugar em Configurações e no cadastro do produto.

## Próximo passo: PHP + SQLite

Cada página já foi pensada para virar um `.php`, seguindo o padrão do projeto lojaFS:

| Hoje (HTML + JS)                 | Versão PHP                                                     |
|----------------------------------|---------------------------------------------------------------|
| `LojaDB.listar('produto')`       | `$pdo->query('SELECT * FROM produto')`                        |
| `LojaDB.salvar(...)`             | `produto_salvar.php` com `INSERT` / `UPDATE` (prepare + execute) |
| `LojaDB.excluir(...)`            | `produto_excluir.php` com `DELETE ... WHERE id = ?`           |
| `cardapio.js`                    | laço `foreach` em `cardapio.php` com `WHERE ativo = 1`        |
| `loja.js` → `gravarPedido()`      | `pedido_site_salvar.php`: INSERT em cliente, pedido e pedido_item numa transação |
| `LojaDB.config()`                 | `SELECT * FROM configuracao WHERE id = 1`                     |
| `LojaDB.banner()`                 | `SELECT * FROM banner WHERE id = 1` em `index.php`            |
| QR code e imagem do banner (data:)| upload com `move_uploaded_file` para `uploads/` e o caminho salvo na tabela |
| `admin/assets/admin.js` (guarda) | `admin/protecao.php` incluído no topo de cada página          |
| topo/rodapé repetidos            | `topo.php` e `rodape.php` com `include`                       |

As tabelas e colunas de `banco/01_criar_tabelas.sql` têm os mesmos nomes usados no `dados.js`, então as telas não precisam mudar. Nesta versão entraram as tabelas `configuracao`, `banner` e `folga` e novas colunas em `pedido` (data_entrega, horario, endereco, forma_pagamento, pago, taxa_entrega, origem) e `produto` (quantidade_minima, ingredientes, conservacao, tamanho). Quem já tinha dados salvos no navegador não perde nada: o `dados.js` completa as colunas novas ao abrir.
