-- 01_criar_tabelas.sql — Forninho da Lili (SQLite)
-- Mesmas tabelas e colunas usadas hoje em assets/js/dados.js.
-- Rode no DB Browser for SQLite: aba "Executar SQL" > Executar > Escrever modificações.

PRAGMA foreign_keys = ON;

CREATE TABLE usuario (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario     TEXT NOT NULL UNIQUE,
    nome        TEXT NOT NULL,
    senha_hash  TEXT NOT NULL            -- gerado com password_hash() no PHP, NUNCA a senha pura
);

CREATE TABLE categoria (
    id     TEXT PRIMARY KEY,             -- 'docinhos', 'cookies', 'kits'
    nome   TEXT NOT NULL,
    ordem  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE produto (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT NOT NULL,
    categoria   TEXT NOT NULL REFERENCES categoria (id),
    preco       REAL,                    -- NULL = "Sob consulta"
    descricao   TEXT,
    alergia     TEXT,
    imagem      TEXT,                    -- caminho: assets/img/produtos/arquivo.jpg
    imagem_alt  TEXT,
    ativo       INTEGER NOT NULL DEFAULT 1,  -- 1 = aparece no cardápio, 0 = desativado
    quantidade_minima INTEGER NOT NULL DEFAULT 1 CHECK (quantidade_minima >= 1),
    ingredientes TEXT,
    conservacao  TEXT,                   -- validade e como guardar
    tamanho      TEXT                    -- tamanho ou peso
);

CREATE TABLE cliente (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    nome      TEXT NOT NULL,
    cpf       TEXT UNIQUE,      -- só números (11 dígitos), validado antes de gravar; vazio = NULL
    telefone  TEXT,
    email     TEXT,
    cidade    TEXT
);

CREATE TABLE pedido (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id   INTEGER NOT NULL REFERENCES cliente (id),
    data_pedido  TEXT NOT NULL,          -- AAAA-MM-DD
    status       TEXT NOT NULL DEFAULT 'Novo'
                 CHECK (status IN ('Novo','Em preparo','Pronto','Entregue','Cancelado')),
    entrega      TEXT NOT NULL DEFAULT 'Retirada' CHECK (entrega IN ('Retirada','Entrega')),
    observacao   TEXT,
    data_entrega TEXT NOT NULL,          -- AAAA-MM-DD: quando a cliente recebe ou retira
    horario      TEXT,                   -- HH:MM (opcional)
    endereco     TEXT,                   -- só quando entrega = 'Entrega'
    forma_pagamento TEXT NOT NULL DEFAULT 'PIX' CHECK (forma_pagamento IN ('PIX','Dinheiro')),
    pago         INTEGER NOT NULL DEFAULT 0,   -- 1 = pagamento conferido pela Lili
    taxa_entrega REAL,                   -- NULL = a combinar
    origem       TEXT NOT NULL DEFAULT 'Painel' CHECK (origem IN ('Site','Painel'))
);

-- Um pedido pode ter vários produtos. O preço é COPIADO no momento da venda,
-- então mudar o preço do produto depois não altera pedidos antigos.
CREATE TABLE pedido_item (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id       INTEGER NOT NULL REFERENCES pedido (id) ON DELETE CASCADE,
    produto_id      INTEGER NOT NULL REFERENCES produto (id),   -- impede excluir produto já vendido
    quantidade      INTEGER NOT NULL CHECK (quantidade > 0),
    preco_unitario  REAL CHECK (preco_unitario IS NULL OR preco_unitario >= 0)  -- NULL = a combinar
);

-- Dados da loja usados no site e na mensagem do pedido. Sempre uma linha só (id = 1).
-- Campo vazio = ainda não confirmado: o site mostra "a confirmar".
CREATE TABLE configuracao (
    id                    INTEGER PRIMARY KEY CHECK (id = 1),
    whatsapp              TEXT NOT NULL,       -- só números, com 55 e DDD
    horario               TEXT,
    instagram             TEXT,
    pix_chave             TEXT,
    pix_nome              TEXT,
    pix_cidade            TEXT,                -- necessária para o PIX copia e cola
    pix_qrcode            TEXT,                -- caminho da imagem do QR code (ex.: uploads/qrcode-pix.png)
    taxa_entrega          REAL,
    endereco_retirada     TEXT,
    aceita_retirada       INTEGER NOT NULL DEFAULT 0,   -- 0 = só entrega
    antecedencia_dias     INTEGER,
    limite_pedidos_dia    INTEGER,
    politica_cancelamento TEXT
);

-- Banner da página inicial, editado pelo painel. Sempre uma linha só (id = 1).
CREATE TABLE banner (
    id                INTEGER PRIMARY KEY CHECK (id = 1),
    imagem            TEXT NOT NULL,           -- caminho da imagem (ex.: uploads/banner.jpg)
    imagem_alt        TEXT NOT NULL,
    titulo            TEXT NOT NULL,
    texto             TEXT,
    destaque1_titulo  TEXT, destaque1_texto TEXT,
    destaque2_titulo  TEXT, destaque2_texto TEXT,
    destaque3_titulo  TEXT, destaque3_texto TEXT
);

-- Dias em que a Lili não atende: o site não deixa escolher essas datas.
CREATE TABLE folga (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    data  TEXT NOT NULL UNIQUE                 -- AAAA-MM-DD
);
