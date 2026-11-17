/* ==========================================================
   FORNINHO DA LILI — "banco de dados" de demonstração
   ----------------------------------------------------------
   Enquanto o PHP + SQLite não entra, os dados ficam guardados
   no próprio navegador (localStorage). As "tabelas" abaixo têm
   os MESMOS nomes e colunas do arquivo banco/01_criar_tabelas.sql,
   então cada função daqui vira uma consulta SQL depois:

     LojaDB.listar('produto')        ->  SELECT * FROM produto
     LojaDB.buscar('produto', 3)     ->  SELECT * FROM produto WHERE id = 3
     LojaDB.salvar('produto', {...}) ->  INSERT ... ou UPDATE ... WHERE id = ?
     LojaDB.excluir('produto', 3)    ->  DELETE FROM produto WHERE id = 3

   Atenção: localStorage vale só para ESTE navegador, neste
   computador. Serve para apresentar o projeto, não para a loja
   funcionar de verdade (isso é papel do SQLite no servidor).
   ========================================================== */
(function () {
  'use strict';

  var CHAVE = 'forninho-da-lili:banco:v1';

  /* Categorias fixas do cardápio (no SQLite: tabela categoria) */
  var CATEGORIAS = [
    { id: 'docinhos', nome: 'Docinhos' },
    { id: 'cookies', nome: 'Cookies' },
    { id: 'kits', nome: 'Kits e presentes' }
  ];

  var STATUS_PEDIDO = ['Novo', 'Em preparo', 'Pronto', 'Entregue', 'Cancelado'];
  /* Próximo passo de cada situação (botão rápido na lista de pedidos) */
  var PROXIMO_STATUS = { 'Novo': 'Em preparo', 'Em preparo': 'Pronto', 'Pronto': 'Entregue' };
  var FORMAS_PAGAMENTO = ['PIX', 'Dinheiro'];

  /* Alérgicos mais comuns: no cadastro do produto viram caixinhas que montam o aviso */
  var ALERGICOS = ['glúten', 'leite', 'ovos', 'amendoim', 'castanhas'];

  /* Configuração inicial da loja (tabela configuracao, sempre a linha id = 1).
     Campo vazio = ainda não confirmado com a cliente: o site mostra "a confirmar". */
  function configInicial() {
    return {
      id: 1,
      whatsapp: '5511989634843',
      horario: '',
      instagram: '',
      pix_chave: '+5511989634843',  // chave PIX = celular da Lili
      pix_nome: 'Forninho da Lili',
      pix_cidade: '',               // só é preciso para gerar o PIX copia e cola
      pix_qrcode: '',               // imagem do QR code PIX enviada pelo painel
      taxa_entrega: 10,             // null = a confirmar no atendimento
      endereco_retirada: '',
      aceita_retirada: 0,           // 0 = só entrega (decisão da cliente); 1 = mostra a opção de retirada
      antecedencia_dias: null,      // null = a confirmar
      limite_pedidos_dia: null,     // null = sem limite
      politica_cancelamento: '',
      versao: 2
    };
  }

  /* Data no formato do banco (AAAA-MM-DD), contando dias para trás a partir de hoje.
     Assim os pedidos de exemplo sempre caem no mês atual da apresentação. */
  function diasAtras(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    var mes = String(d.getMonth() + 1).padStart(2, '0');
    var dia = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mes + '-' + dia;
  }

  /* Banner da página inicial (tabela banner, sempre a linha id = 1) */
  function bannerInicial() {
    return {
      id: 1,
      imagem: 'assets/img/bandeja-doces.jpg',
      imagem_alt: 'Bandeja com doces da Lili: coxinhas de ninho com chocolate, coxinhas de morango de chocolate, coxinhas de amendoim e castanhas e doces com morango aparente',
      titulo: 'Adoçando a vida com amor!',
      texto: 'Doces artesanais feitos sob encomenda para presentear, dividir com os colegas de trabalho e transformar momentos em memórias especiais.',
      destaque1_titulo: 'Feito sob encomenda', destaque1_texto: 'Cada pedido é preparado de forma artesanal',
      destaque2_titulo: 'Pagamento via PIX ou dinheiro', destaque2_texto: 'Combinado direto no atendimento',
      destaque3_titulo: 'Entrega no seu endereço', destaque3_texto: 'Taxa de entrega de R$ 10,00'
    };
  }

  /* Dados de exemplo: o mesmo conteúdo de banco/02_dados_exemplo.sql */
  function dadosIniciais() {
    var banco = {
      produto: [
        { id: 1, nome: 'Coxinha de morango de chocolate tradicional', categoria: 'docinhos', preco: 9.00,
          descricao: 'Morango envolvido em brigadeiro e coberto com granulado de chocolate.',
          alergia: 'Contém leite.', imagem: 'assets/img/produtos/coxinha-chocolate.jpg',
          imagem_alt: 'Coxinha de morango coberta com granulado de chocolate, em forminha de papel branca', ativo: 1 },
        { id: 2, nome: 'Coxinha de morango de amendoim e castanhas', categoria: 'docinhos', preco: 10.00,
          descricao: 'Coberta com amendoim e castanhas, com chocolate por cima.',
          alergia: 'Contém leite, amendoim e castanhas.', imagem: 'assets/img/produtos/coxinha-amendoim.jpg',
          imagem_alt: 'Coxinha coberta com amendoim e castanhas, com chocolate por cima, em forminha de papel branca', ativo: 1 },
        { id: 3, nome: 'Coxinha de ninho com chocolate', categoria: 'docinhos', preco: 8.00,
          descricao: 'Coxinha de ninho com chocolate aplicado à mão.',
          alergia: 'Contém glúten, leite e ovos.', imagem: 'assets/img/produtos/coxinha-ninho.jpg',
          imagem_alt: 'Coxinha de ninho com chocolate aplicado por cima, em forminha de papel branca', ativo: 1 },
        { id: 4, nome: 'Cookie com doce de leite', categoria: 'cookies', preco: 12.00,
          descricao: 'Cookie com gotas de chocolate e doce de leite por cima.',
          alergia: 'Contém glúten, leite e ovos.', imagem: 'assets/img/produtos/cookie-doce-de-leite.jpg',
          imagem_alt: 'Cookie com gotas de chocolate e doce de leite por cima, em embalagem transparente', ativo: 1 },
        { id: 5, nome: 'Cookie com gotas de chocolate', categoria: 'cookies', preco: 10.00,
          descricao: 'A versão clássica, com bastante gota de chocolate.',
          alergia: 'Contém glúten, leite e ovos.', imagem: '', imagem_alt: '', ativo: 1 },
        { id: 6, nome: 'Kit presente com 4 doces', categoria: 'kits', preco: 38.00,
          descricao: 'Uma caixinha delicada para surpreender alguém especial.',
          alergia: 'Contém glúten, leite e ovos.', imagem: '', imagem_alt: '', ativo: 1 },
        { id: 7, nome: 'Kit colegas de trabalho com 12 doces', categoria: 'kits', preco: 98.00,
          descricao: 'Doces sortidos para dividir com a equipe.',
          alergia: 'Contém glúten, leite e ovos.', imagem: '', imagem_alt: '', ativo: 1 },
        { id: 8, nome: 'Kit personalizado', categoria: 'kits', preco: null,
          descricao: 'Você conta a ocasião e a Lili monta o kit com os doces escolhidos.',
          alergia: 'Alérgicos variam conforme os doces escolhidos.', imagem: '', imagem_alt: '', ativo: 1 }
      ],
      cliente: [
        { id: 1, nome: 'Ana Souza', telefone: '(11) 97412-3086', cpf: '', email: 'ana.souza@email.com', cidade: 'São Paulo' },
        { id: 2, nome: 'Bruno Lima', telefone: '(11) 96358-1247', cpf: '', email: 'bruno.lima@email.com', cidade: 'Osasco' },
        { id: 3, nome: 'Carla Mendes', telefone: '(11) 95183-6720', cpf: '', email: 'carla.mendes@email.com', cidade: 'Barueri' },
        { id: 4, nome: 'Diego Santos', telefone: '(11) 98236-5149', cpf: '', email: 'diego.santos@email.com', cidade: 'Carapicuíba' },
        { id: 5, nome: 'Eduarda Rocha', telefone: '(11) 94075-8362', cpf: '', email: 'eduarda.rocha@email.com', cidade: 'Santana de Parnaíba' },
        { id: 6, nome: 'Fernanda Alves', telefone: '(11) 99512-0438', cpf: '', email: 'fernanda.alves@email.com', cidade: 'Cotia' }
      ],
      /* data_pedido = quando o pedido foi feito; data_entrega = quando a cliente recebe/retira.
         diasAtras com número negativo = dias no futuro. pago: 1 = pagamento confirmado. */
      pedido: [
        { id: 1, cliente_id: 1, data_pedido: diasAtras(12), data_entrega: diasAtras(10), horario: '10:00', status: 'Entregue', entrega: 'Retirada', endereco: '', forma_pagamento: 'PIX', pago: 1, taxa_entrega: null, origem: 'Painel', observacao: '' },
        { id: 2, cliente_id: 2, data_pedido: diasAtras(10), data_entrega: diasAtras(8), horario: '15:00', status: 'Entregue', entrega: 'Entrega', endereco: 'Endereço de exemplo, Osasco', forma_pagamento: 'Dinheiro', pago: 1, taxa_entrega: 10, origem: 'Painel', observacao: 'Entregar na portaria.' },
        { id: 3, cliente_id: 3, data_pedido: diasAtras(7), data_entrega: diasAtras(5), horario: '', status: 'Entregue', entrega: 'Retirada', endereco: '', forma_pagamento: 'PIX', pago: 1, taxa_entrega: null, origem: 'Painel', observacao: '' },
        { id: 4, cliente_id: 4, data_pedido: diasAtras(5), data_entrega: diasAtras(2), horario: '', status: 'Cancelado', entrega: 'Entrega', endereco: 'Endereço de exemplo, Carapicuíba', forma_pagamento: 'PIX', pago: 0, taxa_entrega: 10, origem: 'Painel', observacao: 'Cliente desistiu.' },
        { id: 5, cliente_id: 5, data_pedido: diasAtras(3), data_entrega: diasAtras(0), horario: '16:00', status: 'Pronto', entrega: 'Retirada', endereco: '', forma_pagamento: 'PIX', pago: 1, taxa_entrega: null, origem: 'Painel', observacao: 'Aniversário, caprichar no laço.' },
        { id: 6, cliente_id: 1, data_pedido: diasAtras(1), data_entrega: diasAtras(-1), horario: '11:00', status: 'Em preparo', entrega: 'Entrega', endereco: 'Endereço de exemplo, São Paulo', forma_pagamento: 'PIX', pago: 1, taxa_entrega: 10, origem: 'Painel', observacao: '' },
        { id: 7, cliente_id: 6, data_pedido: diasAtras(0), data_entrega: diasAtras(-3), horario: '', status: 'Novo', entrega: 'Retirada', endereco: '', forma_pagamento: 'PIX', pago: 0, taxa_entrega: null, origem: 'Site', observacao: '' }
      ],
      /* Cada linha é um produto dentro de um pedido. O preço é copiado no momento
         da venda: se a Lili mudar o preço depois, os pedidos antigos não mudam. */
      pedido_item: [
        { id: 1, pedido_id: 1, produto_id: 1, quantidade: 10, preco_unitario: 9.00 },
        { id: 2, pedido_id: 1, produto_id: 3, quantidade: 6, preco_unitario: 8.00 },
        { id: 3, pedido_id: 2, produto_id: 7, quantidade: 1, preco_unitario: 98.00 },
        { id: 4, pedido_id: 3, produto_id: 2, quantidade: 12, preco_unitario: 10.00 },
        { id: 5, pedido_id: 3, produto_id: 4, quantidade: 4, preco_unitario: 12.00 },
        { id: 6, pedido_id: 4, produto_id: 6, quantidade: 2, preco_unitario: 38.00 },
        { id: 7, pedido_id: 5, produto_id: 8, quantidade: 1, preco_unitario: 75.00 },
        { id: 8, pedido_id: 5, produto_id: 1, quantidade: 8, preco_unitario: 9.00 },
        { id: 9, pedido_id: 6, produto_id: 1, quantidade: 20, preco_unitario: 9.00 },
        { id: 10, pedido_id: 6, produto_id: 5, quantidade: 6, preco_unitario: 10.00 },
        { id: 11, pedido_id: 7, produto_id: 4, quantidade: 3, preco_unitario: 12.00 }
      ],
      configuracao: [configInicial()],
      banner: [bannerInicial()],
      folga: []
    };
    return migrar(banco);
  }

  /* Bancos salvos antes desta versão não têm as colunas novas.
     Completa o que falta sem apagar nada (no SQLite: ALTER TABLE ... ADD COLUMN). */
  function migrar(banco) {
    banco.produto = banco.produto || [];
    banco.produto.forEach(function (p) {
      if (p.quantidade_minima === undefined) p.quantidade_minima = 1;
      if (p.ingredientes === undefined) p.ingredientes = '';
      if (p.conservacao === undefined) p.conservacao = '';
      if (p.tamanho === undefined) p.tamanho = '';
    });
    banco.pedido = banco.pedido || [];
    banco.pedido.forEach(function (p) {
      if (p.data_entrega === undefined) p.data_entrega = p.data_pedido;
      if (p.horario === undefined) p.horario = '';
      if (p.endereco === undefined) p.endereco = '';
      if (p.forma_pagamento === undefined) p.forma_pagamento = 'PIX';
      if (p.pago === undefined) p.pago = p.status === 'Entregue' ? 1 : 0;
      if (p.taxa_entrega === undefined) p.taxa_entrega = null;
      if (p.origem === undefined) p.origem = 'Painel';
    });
    if (!banco.configuracao || !banco.configuracao.length) banco.configuracao = [configInicial()];
    else {
      var c = banco.configuracao[0];
      // Versão 2: chave PIX e taxa de entrega confirmadas pela cliente. Só preenche se ainda estiver vazio.
      if (!c.versao || c.versao < 2) {
        if (!c.pix_chave) c.pix_chave = configInicial().pix_chave;
        if (c.taxa_entrega === null || c.taxa_entrega === undefined || c.taxa_entrega === '') c.taxa_entrega = configInicial().taxa_entrega;
        c.versao = 2;
      }
      banco.configuracao[0] = Object.assign(configInicial(), c);
    }
    if (!banco.banner || !banco.banner.length) banco.banner = [bannerInicial()];
    else {
      var b = banco.banner[0];
      // A loja passou a trabalhar só com entrega: troca o texto antigo, se ninguém o editou
      if (b.destaque3_titulo === 'Entrega ou retirada' && b.destaque3_texto === 'Você escolhe como prefere receber') {
        b.destaque3_titulo = bannerInicial().destaque3_titulo;
        b.destaque3_texto = bannerInicial().destaque3_texto;
      }
      banco.banner[0] = Object.assign(bannerInicial(), b);
    }
    banco.folga = banco.folga || [];
    banco.cliente = banco.cliente || [];
    banco.cliente.forEach(function (c) { if (c.cpf === undefined) c.cpf = ''; });
    banco.pedido_item = banco.pedido_item || [];
    return banco;
  }

  /* ---------- leitura e gravação ---------- */
  var memoria = null; // usado se o navegador bloquear o localStorage

  function carregar() {
    try {
      var texto = window.localStorage.getItem(CHAVE);
      if (texto) return migrar(JSON.parse(texto));
    } catch (e) { /* sem localStorage: segue com a memória */ }
    if (!memoria) memoria = dadosIniciais();
    return memoria;
  }

  function gravar(banco) {
    memoria = banco;
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(banco));
      return true;
    } catch (e) {
      // Normalmente acontece quando a foto enviada é grande demais para o navegador
      console.warn('Não foi possível gravar no navegador:', e);
      return false;
    }
  }

  function copia(obj) { return obj ? JSON.parse(JSON.stringify(obj)) : null; }

  /* ---------- "SQL" ---------- */
  function listar(tabela) {
    return copia(carregar()[tabela] || []);
  }

  function buscar(tabela, id) {
    id = Number(id);
    var linha = (carregar()[tabela] || []).filter(function (r) { return r.id === id; })[0];
    return copia(linha);
  }

  /* Sem id -> INSERT (cria o próximo id). Com id -> UPDATE. Devolve o id salvo. */
  function salvar(tabela, registro) {
    var banco = carregar();
    var linhas = banco[tabela] || (banco[tabela] = []);
    registro = copia(registro);
    if (registro.id) {
      registro.id = Number(registro.id);
      var i = linhas.findIndex(function (r) { return r.id === registro.id; });
      if (i === -1) linhas.push(registro); else linhas[i] = Object.assign(linhas[i], registro);
    } else {
      var maior = linhas.reduce(function (m, r) { return Math.max(m, r.id); }, 0);
      registro.id = maior + 1;
      linhas.push(registro);
    }
    if (!gravar(banco)) throw new Error('armazenamento-cheio');
    return registro.id;
  }

  function excluir(tabela, id) {
    id = Number(id);
    var banco = carregar();
    banco[tabela] = (banco[tabela] || []).filter(function (r) { return r.id !== id; });
    gravar(banco);
  }

  /* Apaga várias linhas de uma vez (ex.: DELETE FROM pedido_item WHERE pedido_id = ?) */
  function excluirOnde(tabela, coluna, valor) {
    var banco = carregar();
    banco[tabela] = (banco[tabela] || []).filter(function (r) { return r[coluna] !== valor; });
    gravar(banco);
  }

  function restaurarExemplo() {
    memoria = null;
    try { window.localStorage.removeItem(CHAVE); } catch (e) { /* nada */ }
    gravar(dadosIniciais());
  }

  /* ---------- ajudantes de exibição ---------- */
  function dinheiro(valor) {
    if (valor === null || valor === undefined || valor === '') return 'Sob consulta';
    return 'R$ ' + Number(valor).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function dataBr(data) {
    if (!data) return '';
    var p = data.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function nomeCategoria(id) {
    var c = CATEGORIAS.filter(function (c) { return c.id === id; })[0];
    return c ? c.nome : id;
  }

  /* Evita que um nome digitado com < > quebre a página (equivale ao htmlspecialchars do PHP) */
  function esc(texto) {
    return String(texto === null || texto === undefined ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Caminho da foto visto de outra pasta (o admin fica em /admin, um nível abaixo) */
  function urlImagem(caminho, prefixo) {
    if (!caminho) return '';
    if (/^(https?:|data:|\/)/.test(caminho)) return caminho;
    return (prefixo || '') + caminho;
  }

  /* ---------- configuração da loja ---------- */
  function config() { return buscar('configuracao', 1) || configInicial(); }
  function banner() { return buscar('banner', 1) || bannerInicial(); }
  function salvarBanner(dados) { return salvar('banner', Object.assign(banner(), dados, { id: 1 })); }
  function bannerPadrao() { return bannerInicial(); }
  function salvarConfig(dados) { return salvar('configuracao', Object.assign(config(), dados, { id: 1 })); }

  function numeroWhatsApp() {
    var n = String(config().whatsapp || '').replace(/\D/g, '');
    return n || '5511989634843';
  }

  function linkWhatsApp(texto, numero) {
    return 'https://wa.me/' + (numero || numeroWhatsApp()) + '?text=' + encodeURIComponent(texto);
  }

  /* 5511989634843 -> (11) 98963-4843 */
  function telefoneBr(numero) {
    var n = String(numero || '').replace(/\D/g, '');
    if (n.length >= 12 && n.indexOf('55') === 0) n = n.slice(2);
    if (n.length === 11) return '(' + n.slice(0, 2) + ') ' + n.slice(2, 7) + '-' + n.slice(7);
    if (n.length === 10) return '(' + n.slice(0, 2) + ') ' + n.slice(2, 6) + '-' + n.slice(6);
    return numero || '';
  }

  /* ---------- validação de dados do cliente ----------
     Barra dados claramente inventados ("nnnnnn", "11999999999", CPF 111.111.111-11).
     Não comprova identidade: no PHP as mesmas regras devem ser repetidas no servidor. */
  function soDigitos(v) { return String(v || '').replace(/\D/g, ''); }

  function formatarCpf(v) {
    var n = soDigitos(v).slice(0, 11);
    if (n.length > 9) return n.slice(0, 3) + '.' + n.slice(3, 6) + '.' + n.slice(6, 9) + '-' + n.slice(9);
    if (n.length > 6) return n.slice(0, 3) + '.' + n.slice(3, 6) + '.' + n.slice(6);
    if (n.length > 3) return n.slice(0, 3) + '.' + n.slice(3);
    return n;
  }

  /* Máscara enquanto digita: (11) 98765-4321 */
  function mascaraTelefone(v) {
    var n = soDigitos(v);
    if (n.length > 11 && n.indexOf('55') === 0) n = n.slice(2);
    n = n.slice(0, 11);
    if (n.length > 7) return '(' + n.slice(0, 2) + ') ' + n.slice(2, n.length - 4) + '-' + n.slice(-4);
    if (n.length > 2) return '(' + n.slice(0, 2) + ') ' + n.slice(2);
    return n;
  }

  /* Devolve '' quando está tudo certo, ou a mensagem de erro */
  function problemaCpf(v) {
    var n = soDigitos(v);
    if (!n) return 'Informe seu CPF.';
    if (n.length !== 11) return 'O CPF tem 11 números.';
    if (/^(\d)\1{10}$/.test(n) || n === '12345678909') return 'Esse CPF não é válido. Confira os números.';
    for (var t = 9; t < 11; t++) {
      var soma = 0;
      for (var i = 0; i < t; i++) soma += Number(n[i]) * (t + 1 - i);
      var dv = (soma * 10) % 11 % 10;
      if (dv !== Number(n[t])) return 'Esse CPF não é válido. Confira os números.';
    }
    return '';
  }

  var DDDS = ('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 ' +
    '61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99').split(' ');

  function ehSequencia(n) {
    var sobe = true, desce = true;
    for (var i = 1; i < n.length; i++) {
      if ((Number(n[i - 1]) + 1) % 10 !== Number(n[i])) sobe = false;
      if ((Number(n[i - 1]) + 9) % 10 !== Number(n[i])) desce = false;
    }
    return sobe || desce;
  }

  function problemaCelular(v) {
    var n = soDigitos(v);
    if (n.length === 13 && n.indexOf('55') === 0) n = n.slice(2);
    if (!n) return 'Informe seu WhatsApp com DDD.';
    if (n.length !== 11) return 'Digite o celular com DDD: 11 números, como (11) 9XXXX-XXXX.';
    if (DDDS.indexOf(n.slice(0, 2)) === -1) return 'Esse DDD não existe. Confira o número.';
    if (n[2] !== '9') return 'O celular deve começar com 9 depois do DDD.';
    var assinante = n.slice(3), diferentes = {};
    assinante.split('').forEach(function (d) { diferentes[d] = 1; });
    if (Object.keys(diferentes).length <= 2 || ehSequencia(assinante) || ehSequencia(n.slice(2)))
      return 'Esse número não parece real. Use o WhatsApp em que a Lili pode falar com você.';
    var loja = soDigitos(config().whatsapp);
    if (loja.length === 13 && loja.indexOf('55') === 0) loja = loja.slice(2);
    if (n === loja) return 'Esse é o número da loja. Informe o seu WhatsApp.';
    return '';
  }

  var NOMES_FALSOS = ['teste', 'testes', 'testando', 'test', 'fulano', 'fulana', 'ciclano', 'ciclana', 'sicrano', 'sicrana',
    'beltrano', 'beltrana', 'nome', 'sobrenome', 'cliente', 'usuario', 'usuária', 'usuário', 'anonimo', 'anônimo', 'ninguem',
    'ninguém', 'xxx', 'asdf', 'qwerty', 'abc', 'abcd', 'abcde', 'aaa', 'blabla'];
  var LIGACOES = ['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'van', 'von'];
  var TECLADO = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'abcdefghijklmnopqrstuvwxyz'];

  function tirarAcento(t) { return t.normalize ? t.normalize('NFD').replace(/[̀-ͯ]/g, '') : t; }

  function palavraEstranha(p) {
    var w = tirarAcento(p.toLowerCase()).replace(/['.-]/g, '');
    if (NOMES_FALSOS.indexOf(w) !== -1 || NOMES_FALSOS.indexOf(p.toLowerCase()) !== -1) return true;
    if (/(.)\1\1/.test(w)) return true;                       // nnn, aaa
    if (!/[aeiouy]/.test(w)) return true;                     // sem vogal: "bcdf"
    if (/[^aeiouy]{5,}/.test(w)) return true;                 // "jkhgf"
    if (w.length >= 4 && TECLADO.some(function (linha) { return linha.indexOf(w) !== -1; })) return true; // "asdf", "abcd"
    if (/^(.{1,3})\1{2,}$/.test(w)) return true;             // "lalala", "abcabcabc"
    return false;
  }

  function problemaNome(v) {
    var nome = String(v || '').trim().replace(/\s+/g, ' ');
    if (!nome) return 'Informe seu nome completo.';
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' .-]+$/.test(nome)) return 'Use só letras no nome, sem números ou símbolos.';
    var palavras = nome.split(' ').filter(function (p) { return LIGACOES.indexOf(p.toLowerCase()) === -1; });
    if (palavras.some(function (p) { return p.replace(/['.-]/g, '').length >= 2 && palavraEstranha(p); }))
      return 'Esse nome não parece real. Use seu nome como está no documento.';
    if (palavras.length < 2) return 'Informe nome e sobrenome.';
    if (palavras.some(function (p) { return p.replace(/['.-]/g, '').length < 2; })) return 'Escreva o nome e o sobrenome por extenso.';
    if (palavras.length >= 2 && palavras.every(function (p) { return p.toLowerCase() === palavras[0].toLowerCase(); }))
      return 'Esse nome não parece real. Use seu nome como está no documento.';
    return '';
  }

  function problemaEndereco(v) {
    var e = String(v || '').trim();
    if (!e) return 'Informe o endereço de entrega.';
    var letras = (e.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length;
    if (/([A-Za-zÀ-ÿ])\1\1/i.test(e) || /(\d)\1{4,}/.test(e)) return 'Esse endereço não parece real. Confira rua, número e bairro.';
    if (e.length < 10 || letras < 5) return 'Informe rua, número e bairro.';
    if (!/\d/.test(e) && !/\bs\/?n\b/i.test(e)) return 'Inclua o número da casa ou prédio (ou "s/n").';
    return '';
  }

  /* Nome com iniciais maiúsculas: "maria DE souza" -> "Maria de Souza" */
  function arrumarNome(v) {
    return String(v || '').trim().replace(/\s+/g, ' ').toLowerCase().split(' ').map(function (p) {
      return LIGACOES.indexOf(p) !== -1 ? p : p.charAt(0).toUpperCase() + p.slice(1);
    }).join(' ');
  }

  /* ---------- datas ---------- */
  function hojeISO() { return diasAtras(0); }

  function somarDias(iso, n) {
    var d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  var DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  /* 2026-11-14 -> 14/11/2026 (sábado) */
  function dataLonga(iso) {
    if (!iso) return '';
    return dataBr(iso) + ' (' + DIAS_SEMANA[new Date(iso + 'T12:00:00').getDay()] + ')';
  }

  /* 2026-11-14 -> 14/11 (sáb) */
  function dataCurta(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + ' (' + DIAS_SEMANA[new Date(iso + 'T12:00:00').getDay()].slice(0, 3) + ')';
  }

  /* ---------- regras de agenda (valem para o site e para o painel) ---------- */
  function numeroOuNulo(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(String(v).replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function dataMinimaEntrega() {
    return somarDias(hojeISO(), Number(config().antecedencia_dias) || 0);
  }

  function pedidosNoDia(iso, ignorarId) {
    return listar('pedido').filter(function (p) {
      return p.data_entrega === iso && p.status !== 'Cancelado' && p.id !== ignorarId;
    }).length;
  }

  function ehFolga(iso) {
    return listar('folga').some(function (f) { return f.data === iso; });
  }

  /* Devolve o motivo de a data não poder ser escolhida, ou '' se estiver livre */
  function problemaData(iso) {
    var c = config();
    if (!iso) return 'Escolha a data.';
    if (iso < dataMinimaEntrega()) {
      return Number(c.antecedencia_dias) > 0
        ? 'Escolha uma data a partir de ' + dataLonga(dataMinimaEntrega()) + '.'
        : 'Escolha uma data a partir de hoje.';
    }
    if (ehFolga(iso)) return 'A Lili não atende nesse dia. Escolha outra data.';
    var limite = Number(c.limite_pedidos_dia) || 0;
    if (limite && pedidosNoDia(iso) >= limite) return 'Essa data já está com a agenda cheia. Escolha outra data.';
    return '';
  }

  /* ---------- totais do pedido ---------- */
  /* Item com preco_unitario vazio (null) = "a combinar" (ex.: kit personalizado pedido pelo site) */
  function totaisPedido(pedido, itens) {
    var seus = (itens || listar('pedido_item')).filter(function (i) { return i.pedido_id === pedido.id; });
    var subtotal = 0, aCombinar = false, unidades = 0;
    seus.forEach(function (i) {
      unidades += i.quantidade;
      if (i.preco_unitario === null || i.preco_unitario === undefined) aCombinar = true;
      else subtotal += i.quantidade * i.preco_unitario;
    });
    var taxa = pedido.entrega === 'Entrega' ? numeroOuNulo(pedido.taxa_entrega) : 0;
    var taxaPendente = pedido.entrega === 'Entrega' && taxa === null;
    return { itens: seus, unidades: unidades, subtotal: subtotal, taxa: taxa || 0, taxaPendente: taxaPendente, aCombinar: aCombinar, total: subtotal + (taxa || 0) };
  }

  function listaPt(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]; }

  /* "R$ 39,00 + entrega a combinar" */
  function textoTotal(t) {
    var pend = [];
    if (t.taxaPendente) pend.push('entrega');
    if (t.aCombinar) pend.push('itens sob consulta');
    return dinheiro(t.total) + (pend.length ? ' + ' + listaPt(pend) + ' a combinar' : '');
  }

  /* ---------- PIX copia e cola (padrão BR Code do Banco Central) ---------- */
  function campoPix(id, valor) { return id + String(valor.length).padStart(2, '0') + valor; }

  function crc16(texto) {
    var c = 0xFFFF;
    for (var i = 0; i < texto.length; i++) {
      c ^= texto.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF;
    }
    return c.toString(16).toUpperCase().padStart(4, '0');
  }

  function semAcento(texto, max) {
    return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().trim().slice(0, max);
  }

  /* Só gera o código quando a chave, o nome e a cidade estão configurados e o valor é conhecido */
  function pixCopiaECola(valor, identificador) {
    var c = config();
    if (!c.pix_chave || !c.pix_nome || !c.pix_cidade || !(valor > 0)) return '';
    var texto = campoPix('00', '01') +
      campoPix('26', campoPix('00', 'br.gov.bcb.pix') + campoPix('01', c.pix_chave.trim())) +
      campoPix('52', '0000') + campoPix('53', '986') + campoPix('54', valor.toFixed(2)) + campoPix('58', 'BR') +
      campoPix('59', semAcento(c.pix_nome, 25)) + campoPix('60', semAcento(c.pix_cidade, 15)) +
      campoPix('62', campoPix('05', semAcento(identificador || '***', 25).replace(/ /g, ''))) + '6304';
    return texto + crc16(texto);
  }

  window.LojaDB = {
    CATEGORIAS: CATEGORIAS,
    STATUS_PEDIDO: STATUS_PEDIDO,
    PROXIMO_STATUS: PROXIMO_STATUS,
    FORMAS_PAGAMENTO: FORMAS_PAGAMENTO,
    ALERGICOS: ALERGICOS,
    config: config,
    salvarConfig: salvarConfig,
    banner: banner,
    salvarBanner: salvarBanner,
    bannerPadrao: bannerPadrao,
    numeroWhatsApp: numeroWhatsApp,
    telefoneBr: telefoneBr,
    soDigitos: soDigitos,
    formatarCpf: formatarCpf,
    mascaraTelefone: mascaraTelefone,
    problemaCpf: problemaCpf,
    problemaCelular: problemaCelular,
    problemaNome: problemaNome,
    problemaEndereco: problemaEndereco,
    arrumarNome: arrumarNome,
    hojeISO: hojeISO,
    somarDias: somarDias,
    DIAS_SEMANA: DIAS_SEMANA,
    dataLonga: dataLonga,
    dataCurta: dataCurta,
    numeroOuNulo: numeroOuNulo,
    dataMinimaEntrega: dataMinimaEntrega,
    pedidosNoDia: pedidosNoDia,
    ehFolga: ehFolga,
    problemaData: problemaData,
    totaisPedido: totaisPedido,
    textoTotal: textoTotal,
    listaPt: listaPt,
    pixCopiaECola: pixCopiaECola,
    listar: listar,
    buscar: buscar,
    salvar: salvar,
    excluir: excluir,
    excluirOnde: excluirOnde,
    restaurarExemplo: restaurarExemplo,
    dinheiro: dinheiro,
    dataBr: dataBr,
    nomeCategoria: nomeCategoria,
    esc: esc,
    urlImagem: urlImagem,
    linkWhatsApp: linkWhatsApp
  };
})();
