/* ==========================================================
   LOJA — carrinho e pedido pelo WhatsApp (todas as páginas do site)
   ----------------------------------------------------------
   1. O carrinho fica guardado no navegador da cliente.
   2. O pedido é montado em 3 etapas: itens, entrega e dados, revisão.
   3. Ao enviar, o WhatsApp abre com a mensagem pronta (produtos, valor
      de cada um, total e chave PIX) e o pedido entra no painel como
      "Novo", com origem "Site". Na versão PHP, essa gravação vira um
      POST para pedido_site_salvar.php (INSERT em cliente, pedido e
      pedido_item), e o carrinho pode continuar igual.
   Precisa de assets/js/dados.js carregado antes.
   ========================================================== */
(function () {
  'use strict';
  if (!window.LojaDB) return;
  var db = window.LojaDB;
  var esc = db.esc;

  var CHAVE_CARRINHO = 'forninho-da-lili:carrinho';
  var CHAVE_DADOS = 'forninho-da-lili:dados-do-pedido';

  function ler(chave, padrao) {
    try { var v = window.localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; }
  }
  function guardar(chave, valor) {
    try { window.localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem armazenamento: segue na memória */ }
  }

  var carrinho = ler(CHAVE_CARRINHO, {});           // { id_do_produto: quantidade }
  var dados = Object.assign({ nome: '', cpf: '', telefone: '', entrega: 'Entrega', endereco: '', data_entrega: '', horario: '', forma_pagamento: 'PIX', observacao: '' }, ler(CHAVE_DADOS, {}));

  /* Retirada só aparece se a Lili ligar a opção em Configurações */
  function aceitaRetirada() { return Number(db.config().aceita_retirada) === 1; }

  if (!aceitaRetirada()) dados.entrega = 'Entrega';

  /* ---------- produtos e carrinho ---------- */
  function produtos() { return db.listar('produto'); }
  function produto(id) { return db.buscar('produto', id); }
  function ativo(p) { return p && Number(p.ativo) === 1; }
  function temPreco(p) { return p.preco !== null && p.preco !== undefined && p.preco !== ''; }
  function minimo(p) { return Math.max(1, Number(p && p.quantidade_minima) || 1); }

  function limparCarrinho() {
    Object.keys(carrinho).forEach(function (id) {
      if (!ativo(produto(id)) || !(carrinho[id] > 0)) delete carrinho[id];
    });
    guardar(CHAVE_CARRINHO, carrinho);
  }

  function itens() {
    return Object.keys(carrinho).map(function (id) { return { p: produto(id), qtd: carrinho[id] }; })
      .filter(function (i) { return ativo(i.p) && i.qtd > 0; });
  }

  function taxaEntrega() { return db.numeroOuNulo(db.config().taxa_entrega); }

  function resumo() {
    var lista = itens(), sub = 0, unidades = 0, aCombinar = false;
    lista.forEach(function (i) {
      unidades += i.qtd;
      if (temPreco(i.p)) sub += i.p.preco * i.qtd; else aCombinar = true;
    });
    var taxa = dados.entrega === 'Entrega' ? taxaEntrega() : 0;
    return { itens: lista, unidades: unidades, subtotal: sub, taxa: taxa || 0, taxaPendente: dados.entrega === 'Entrega' && taxa === null, aCombinar: aCombinar, total: sub + (taxa || 0) };
  }

  function definirQuantidade(id, q) {
    var p = produto(id);
    if (!p) return;
    if (q < minimo(p)) delete carrinho[id]; else carrinho[id] = Math.min(999, q);
    guardar(CHAVE_CARRINHO, carrinho);
    atualizarAcoes(String(id));
    atualizarContador();
    if (gaveta.open) desenharGaveta();
  }

  function adicionar(id) {
    var p = produto(id);
    if (!p) return;
    var novo = !carrinho[id];
    definirQuantidade(id, novo ? minimo(p) : carrinho[id] + 1);
    if (novo) avisar(p.nome + ' adicionado ao pedido.', true);
  }

  /* Botão "Adicionar ao pedido", ou o seletor de quantidade se já estiver no pedido */
  function htmlAcao(p) {
    if (!ativo(p)) return '<p class="indisponivel">Indisponível no momento</p>';
    var q = carrinho[p.id] || 0;
    if (!q) return '<button type="button" class="botao" data-add="' + p.id + '">Adicionar ao pedido</button>';
    return '<div class="stepper" role="group" aria-label="Quantidade de ' + esc(p.nome) + ' no pedido">' +
      '<button type="button" data-menos="' + p.id + '" aria-label="Diminuir">−</button><output>' + q + '</output>' +
      '<button type="button" data-mais="' + p.id + '" aria-label="Aumentar">+</button></div>';
  }

  function atualizarAcoes(id) {
    var foco = document.activeElement;
    var dono = foco && foco.closest ? foco.closest('.item-acao') : null;
    var tipo = dono && foco.hasAttribute('data-menos') ? 'menos' : 'mais';
    document.querySelectorAll('.item-acao[data-acao="' + id + '"]').forEach(function (el) { el.innerHTML = htmlAcao(produto(id)); });
    if (dono && dono.dataset.acao === id) {
      var alvo = dono.querySelector(tipo === 'menos' ? '[data-menos]' : '[data-mais]') || dono.querySelector('[data-add]');
      if (alvo) alvo.focus();
    }
  }

  function atualizarContador() {
    var r = resumo();
    document.querySelectorAll('.contador').forEach(function (c) { c.textContent = r.unidades; c.hidden = !r.unidades; });
    document.querySelectorAll('.botao-pedido').forEach(function (b) {
      b.setAttribute('aria-label', r.unidades ? 'Abrir pedido, ' + r.unidades + (r.unidades === 1 ? ' item' : ' itens') : 'Abrir pedido');
    });
    barra.hidden = !r.unidades;
    document.body.classList.toggle('tem-barra', !!r.unidades);
    barra.querySelector('[data-resumo]').textContent = r.unidades + (r.unidades === 1 ? ' item, ' : ' itens, ') + db.dinheiro(r.subtotal) + (r.aCombinar ? ' +' : '');
  }

  /* ---------- aviso rápido ---------- */
  var tempoAviso;
  function avisar(texto, comBotao) {
    aviso.innerHTML = '<span>' + esc(texto) + '</span>' + (comBotao ? '<button type="button" data-abrir-pedido>Ver pedido</button>' : '');
    aviso.classList.add('visivel');
    clearTimeout(tempoAviso);
    tempoAviso = setTimeout(function () {
      aviso.classList.remove('visivel');
      setTimeout(function () { if (!aviso.classList.contains('visivel')) aviso.innerHTML = ''; }, 400);
    }, 4000);
  }

  /* ---------- elementos fixos (criados aqui para não repetir em cada página) ---------- */
  document.body.insertAdjacentHTML('beforeend',
    '<button type="button" class="barra-pedido" data-abrir-pedido hidden><span>Ver pedido</span><span data-resumo></span></button>' +
    '<dialog class="gaveta" id="gaveta" aria-labelledby="gaveta-titulo">' +
      '<div class="gaveta-topo"><h2 id="gaveta-titulo" tabindex="-1">Seu pedido</h2><button type="button" class="fechar" data-fechar aria-label="Fechar pedido">×</button></div>' +
      '<ol class="etapas" id="etapas" aria-label="Etapas do pedido"></ol>' +
      '<div class="gaveta-corpo" id="gaveta-corpo"></div>' +
      '<div class="gaveta-rodape" id="gaveta-rodape"></div>' +
    '</dialog>' +
    '<div class="aviso-rapido" role="status" aria-live="polite"></div>');
  var barra = document.querySelector('.barra-pedido');
  var gaveta = document.getElementById('gaveta');
  var aviso = document.querySelector('.aviso-rapido');

  /* ---------- gaveta do pedido ---------- */
  var etapa = 1;
  var rascunho = null;     // pedido montado na revisão
  var enviado = null;      // pedido já gravado (tela de confirmação)

  function abrirGaveta() {
    if (etapa === 4 && !enviado) etapa = 1;
    if (!gaveta.open) gaveta.showModal();
    desenharGaveta();
    document.getElementById('gaveta-titulo').focus();
  }

  function irEtapa(n) {
    etapa = n;
    desenharGaveta();
    document.getElementById('gaveta-corpo').scrollTop = 0;
    document.getElementById('gaveta-titulo').focus();
  }

  function htmlItens(r) {
    if (!r.itens.length) {
      return '<div class="vazio-pedido"><img src="' + caminhoBase() + 'assets/img/logo-selo.jpg" alt="" width="72" height="72">' +
        '<h3>Seu pedido está vazio</h3><p>Escolha seus doces no cardápio e eles aparecem aqui.</p></div>';
    }
    return '<ul class="linhas">' + r.itens.map(function (i) {
      var p = i.p, foto = p.imagem ? db.urlImagem(p.imagem, caminhoBase()) : caminhoBase() + 'assets/img/logo-selo.jpg';
      return '<li class="linha"><img src="' + esc(foto) + '" alt="" width="64" height="64">' +
        '<div><h3>' + esc(p.nome) + '</h3><p class="nota">' + (temPreco(p) ? db.dinheiro(p.preco) + ' cada' : 'Valor a combinar') + '</p>' +
        '<div class="linha-controles"><div class="stepper stepper-mini" role="group" aria-label="Quantidade de ' + esc(p.nome) + '">' +
        '<button type="button" data-menos="' + p.id + '" aria-label="Diminuir">−</button><output>' + i.qtd + '</output>' +
        '<button type="button" data-mais="' + p.id + '" aria-label="Aumentar">+</button></div>' +
        '<button type="button" class="link-botao" data-remover="' + p.id + '">Remover<span class="visualmente-oculto"> ' + esc(p.nome) + '</span></button></div></div>' +
        '<p class="linha-total">' + (temPreco(p) ? db.dinheiro(p.preco * i.qtd) : 'A combinar') + '</p></li>';
    }).join('') + '</ul>' +
      (r.aCombinar ? '<p class="aviso-combinar">Itens sob consulta têm o valor combinado com a Lili pelo WhatsApp.</p>' : '');
  }

  function textoTaxa(t) { return t === null ? 'Taxa combinada pelo WhatsApp' : t === 0 ? 'Sem taxa de entrega' : 'Taxa de entrega de ' + db.dinheiro(t); }

  function htmlEntrega() {
    var c = db.config(), t = taxaEntrega(), ant = Number(c.antecedencia_dias) || 0;
    function marcado(campo, valor) { return dados[campo] === valor ? ' checked' : ''; }
    return '<form id="form-entrega" class="form-pedido" novalidate>' +
      '<div class="campo"><label for="pd-nome">Nome completo</label><input id="pd-nome" name="nome" autocomplete="name" autocapitalize="words" maxlength="80" required value="' + esc(dados.nome) + '" aria-describedby="erro-nome"><p class="erro" id="erro-nome" hidden></p></div>' +
      '<div class="linha-2">' +
        '<div class="campo"><label for="pd-cpf">CPF</label><input id="pd-cpf" name="cpf" inputmode="numeric" autocomplete="off" maxlength="14" required value="' + esc(dados.cpf) + '" placeholder="000.000.000-00" aria-describedby="erro-cpf"><p class="erro" id="erro-cpf" hidden></p></div>' +
        '<div class="campo"><label for="pd-telefone">WhatsApp com DDD</label><input id="pd-telefone" name="telefone" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="15" required value="' + esc(dados.telefone) + '" placeholder="(11) 90000-0000" aria-describedby="erro-telefone"><p class="erro" id="erro-telefone" hidden></p></div>' +
      '</div>' +
      (aceitaRetirada()
        ? '<fieldset class="campo"><legend>Como prefere receber?</legend><div class="opcoes">' +
            '<label class="opcao-cartao"><input type="radio" name="entrega" value="Entrega"' + marcado('entrega', 'Entrega') + '><span><strong>Entrega</strong><small>' + textoTaxa(t) + '</small></span></label>' +
            '<label class="opcao-cartao"><input type="radio" name="entrega" value="Retirada"' + marcado('entrega', 'Retirada') + '><span><strong>Retirada</strong><small>' + (c.endereco_retirada ? esc(c.endereco_retirada) : 'Endereço enviado pela Lili') + '</small></span></label>' +
          '</div></fieldset>'
        : '<p class="aviso-entrega"><strong>Entrega no seu endereço.</strong> ' + textoTaxa(t) + '.</p>') +
      '<div class="campo" id="campo-endereco"' + (dados.entrega === 'Entrega' ? '' : ' hidden') + '><label for="pd-endereco">Endereço de entrega</label><textarea id="pd-endereco" name="endereco" rows="2" autocomplete="street-address" placeholder="Rua, número, complemento e bairro" aria-describedby="erro-endereco">' + esc(dados.endereco) + '</textarea><p class="erro" id="erro-endereco" hidden></p></div>' +
      '<div class="linha-2">' +
        '<div class="campo"><label for="pd-data_entrega">Data</label><input type="date" id="pd-data_entrega" name="data_entrega" min="' + db.dataMinimaEntrega() + '" value="' + esc(dados.data_entrega) + '" required aria-describedby="dica-data erro-data_entrega">' +
          '<p class="dica" id="dica-data">' + (ant ? 'Antecedência mínima de ' + ant + (ant === 1 ? ' dia.' : ' dias.') : 'A Lili confirma a data pelo WhatsApp.') + '</p><p class="erro" id="erro-data_entrega" hidden></p></div>' +
        '<div class="campo"><label for="pd-horario">Horário preferido <span class="opcional">(opcional)</span></label><input type="time" id="pd-horario" name="horario" value="' + esc(dados.horario) + '"></div>' +
      '</div>' +
      '<fieldset class="campo"><legend>Pagamento</legend><div class="opcoes">' +
        '<label class="opcao-cartao"><input type="radio" name="forma_pagamento" value="PIX"' + marcado('forma_pagamento', 'PIX') + '><span><strong>PIX</strong><small>QR code e chave na tela de pagamento</small></span></label>' +
        '<label class="opcao-cartao"><input type="radio" name="forma_pagamento" value="Dinheiro"' + marcado('forma_pagamento', 'Dinheiro') + '><span><strong>Dinheiro</strong><small>Combinado no atendimento</small></span></label>' +
      '</div></fieldset>' +
      '<div class="campo"><label for="pd-observacao">Observações <span class="opcional">(opcional)</span></label><textarea id="pd-observacao" name="observacao" rows="3" maxlength="240" placeholder="Dedicatória, cartão de presente, restrição alimentar...">' + esc(dados.observacao) + '</textarea></div>' +
      '<p class="privacidade">Nome, CPF e WhatsApp são conferidos para evitar pedidos falsos. Seus dados são usados apenas para este pedido e para a Lili falar com você.</p>' +
    '</form>';
  }

  function validar() {
    var primeiro = null;
    function marca(campo, msg) {
      var erro = document.getElementById('erro-' + campo), el = document.getElementById('pd-' + campo);
      erro.textContent = msg; erro.hidden = !msg;
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg && !primeiro) primeiro = el;
    }
    marca('nome', db.problemaNome(dados.nome));
    marca('cpf', db.problemaCpf(dados.cpf));
    marca('telefone', db.problemaCelular(dados.telefone));
    marca('endereco', dados.entrega === 'Entrega' ? db.problemaEndereco(dados.endereco) : '');
    marca('data_entrega', db.problemaData(dados.data_entrega));
    if (primeiro) { primeiro.focus(); return false; }
    return true;
  }

  /* Monta o pedido como ele será gravado (mesmas colunas das tabelas pedido e pedido_item) */
  function montar() {
    var r = resumo();
    var proximoId = db.listar('pedido').reduce(function (m, p) { return Math.max(m, p.id); }, 0) + 1;
    return {
      numero: proximoId,
      nome: db.arrumarNome(dados.nome), cpf: db.formatarCpf(dados.cpf), telefone: db.telefoneBr(dados.telefone),
      pedido: {
        data_pedido: db.hojeISO(), data_entrega: dados.data_entrega, horario: dados.horario,
        status: 'Novo', entrega: dados.entrega, endereco: dados.entrega === 'Entrega' ? dados.endereco.trim() : '',
        forma_pagamento: dados.forma_pagamento, pago: 0,
        taxa_entrega: dados.entrega === 'Entrega' ? taxaEntrega() : null,
        origem: 'Site', observacao: dados.observacao.trim()
      },
      itens: r.itens.map(function (i) { return { produto_id: i.p.id, nome: i.p.nome, quantidade: i.qtd, preco_unitario: temPreco(i.p) ? i.p.preco : null }; }),
      totais: r
    };
  }

  /* Endereço público do QR code. Imagem enviada pelo painel na demonstração fica só no navegador
     (data:...), então não dá para mandar link. No PHP ela vira um arquivo (uploads/qrcode-pix.png). */
  function linkQrCode() {
    var q = db.config().pix_qrcode;
    if (!q || /^data:/.test(q)) return '';
    try { return new URL(q, window.location.href).href; } catch (e) { return ''; }
  }

  function mensagem(m) {
    var c = db.config(), t = m.totais, p = m.pedido;
    var L = ['Olá, Lili! Quero fazer uma encomenda pelo site.', '*Pedido nº ' + m.numero + '*', ''];
    m.itens.forEach(function (i) {
      L.push(i.preco_unitario !== null
        ? '• ' + i.quantidade + 'x ' + i.nome + ' — ' + db.dinheiro(i.preco_unitario) + ' cada = ' + db.dinheiro(i.preco_unitario * i.quantidade)
        : '• ' + i.quantidade + 'x ' + i.nome + ' — valor a combinar');
    });
    L.push('', 'Subtotal: ' + db.dinheiro(t.subtotal));
    if (p.entrega === 'Entrega') L.push(t.taxaPendente ? 'Entrega: taxa a combinar' : 'Entrega: ' + db.dinheiro(t.taxa));
    var pend = [];
    if (t.taxaPendente) pend.push('taxa de entrega');
    if (t.aCombinar) pend.push('itens sob consulta');
    L.push('*Total: ' + db.dinheiro(t.total) + '*' + (pend.length ? ' + ' + db.listaPt(pend) + ' a combinar' : ''), '');
    L.push('Data: ' + db.dataLonga(p.data_entrega) + (p.horario ? ' às ' + p.horario : ''));
    L.push(p.entrega === 'Entrega' ? 'Entrega em: ' + p.endereco : 'Retirada' + (c.endereco_retirada ? ' em: ' + c.endereco_retirada : ''));
    L.push('Nome: ' + m.nome);
    L.push('CPF: ' + m.cpf);
    L.push('WhatsApp: ' + m.telefone);
    L.push('Pagamento: ' + p.forma_pagamento);
    if (p.observacao) L.push('Observações: ' + p.observacao);
    if (p.forma_pagamento === 'PIX') {
      L.push('', 'Chave PIX: ' + (c.pix_chave || 'enviada pela Lili na confirmação'));
      if (c.pix_chave && c.pix_nome) L.push('Recebedor: ' + c.pix_nome);
      if (linkQrCode()) L.push('QR code PIX: ' + linkQrCode());
      L.push('', t.aCombinar
        ? '_Meu pedido tem item sob consulta. Aguardo o valor final para fazer o PIX e enviar o comprovante._'
        : '*Segue o comprovante do PIX.*');
    }
    return L.join('\n');
  }

  function htmlRevisao(m) {
    var c = db.config(), p = m.pedido, t = m.totais;
    var local = p.entrega === 'Entrega' ? esc(p.endereco) : (c.endereco_retirada ? esc(c.endereco_retirada) : 'Endereço informado pela Lili na confirmação');
    return '<section class="revisao"><h3>Itens</h3><ul class="linhas-resumo">' + m.itens.map(function (i) {
        return '<li><span>' + i.quantidade + 'x ' + esc(i.nome) + '</span><span>' + (i.preco_unitario !== null ? db.dinheiro(i.preco_unitario * i.quantidade) : 'A combinar') + '</span></li>';
      }).join('') + '</ul>' +
      '<dl class="contas"><div><dt>Subtotal</dt><dd>' + db.dinheiro(t.subtotal) + '</dd></div>' +
        (p.entrega === 'Entrega' ? '<div><dt>Entrega</dt><dd>' + (t.taxaPendente ? 'A combinar' : db.dinheiro(t.taxa)) + '</dd></div>' : '') +
        '<div class="total"><dt>Total</dt><dd>' + esc(db.textoTotal(t)) + '</dd></div></dl>' +
      '<h3>Entrega e pagamento</h3><dl class="dados-revisao">' +
        '<div><dt>Nome</dt><dd>' + esc(m.nome) + '<br>CPF ' + esc(m.cpf) + ' · ' + esc(m.telefone) + '</dd></div>' +
        '<div><dt>Data</dt><dd>' + db.dataLonga(p.data_entrega) + (p.horario ? ' às ' + esc(p.horario) : '') + '</dd></div>' +
        '<div><dt>' + (p.entrega === 'Entrega' ? 'Entrega em' : 'Retirada') + '</dt><dd>' + local + '</dd></div>' +
        '<div><dt>Pagamento</dt><dd>' + esc(p.forma_pagamento) + '</dd></div>' +
        (p.observacao ? '<div><dt>Observações</dt><dd>' + esc(p.observacao) + '</dd></div>' : '') +
      '</dl><button type="button" class="link-botao" data-ir-etapa="2">Alterar dados</button>' +
      '<details class="previa"><summary>Ver a mensagem que será enviada</summary><pre>' + esc(mensagem(m)) + '</pre></details></section>';
  }

  /* Etapa 4: pagamento. Primeiro o QR code, a chave e o passo a passo; o botão do WhatsApp vem por último. */
  function htmlPagamento(m) {
    var c = db.config(), t = m.totais, pix = m.pedido.forma_pagamento === 'PIX';
    var valor = t.aCombinar ? 'valor combinado com a Lili' : db.dinheiro(t.total);
    var recebedor = c.pix_nome ? esc(c.pix_nome) : '';
    var topo = '<p class="pagamento-pedido">Pedido nº ' + m.numero + ' registrado</p>' +
      '<div class="pagamento-valor"><span>' + (pix ? 'Valor do PIX' : 'Valor do pedido') + '</span><strong>' + esc(t.aCombinar ? db.textoTotal(t) : valor) + '</strong></div>';

    if (!pix) {
      return '<div class="pagamento">' + topo +
        '<section class="como-comprar" aria-labelledby="t-como"><h3 id="t-como">Como finalizar?</h3><ol>' +
          '<li>Clique no botão do WhatsApp abaixo e envie o seu pedido.</li>' +
          '<li>A Lili confirma a data e o pedido com você.</li>' +
          '<li>Pague em dinheiro conforme combinado com a Lili.</li>' +
        '</ol><p class="aviso-aprovacao">*O pedido só será aprovado após a confirmação pelo WhatsApp.</p></section></div>';
    }

    if (t.aCombinar) {
      return '<div class="pagamento">' + topo +
        '<section class="como-comprar" aria-labelledby="t-como"><h3 id="t-como">Como comprar?</h3>' +
          '<p>Seu pedido tem item sob consulta, então o valor final é combinado antes do PIX.</p><ol>' +
          '<li>Clique no botão do WhatsApp abaixo e envie o seu pedido.</li>' +
          '<li>A Lili informa o valor final.</li>' +
          '<li>Faça o PIX' + (recebedor ? ' para <strong>' + recebedor + '</strong>' : '') + ' usando a chave ' + (c.pix_chave ? '<strong>' + esc(c.pix_chave) + '</strong>' : 'enviada pela Lili') + '.</li>' +
          '<li>Envie o comprovante na mesma conversa do WhatsApp.</li>' +
        '</ol><p class="aviso-aprovacao">*O pedido só será aprovado após o envio do comprovante via WhatsApp.</p></section></div>';
    }

    var codigo = !t.taxaPendente ? db.pixCopiaECola(t.total, 'PEDIDO' + m.numero) : '';
    var qr = c.pix_qrcode ? db.urlImagem(c.pix_qrcode, caminhoBase()) : '';
    return '<div class="pagamento">' + topo +
      (qr ? '<figure class="pix-qr"><img src="' + esc(qr) + '" alt="QR code PIX' + (recebedor ? ' de ' + recebedor : '') + '" width="240" height="240">' +
        '<figcaption>No app do banco, escolha pagar com PIX e leia o QR code.</figcaption>' +
        '<a class="link-botao" href="' + esc(qr) + '" download="qrcode-pix-forninho-da-lili.png">Baixar QR code</a></figure>' : '') +
      (c.pix_chave
        ? '<div class="pix-copiar"><label for="pix-chave-campo">Chave PIX (celular)</label>' +
            '<div class="pix-copiar-linha"><input id="pix-chave-campo" type="text" readonly value="' + esc(c.pix_chave) + '" aria-describedby="pix-recebedor">' +
            '<button type="button" class="botao" data-copiar="chave" data-campo="pix-chave-campo">Copiar chave</button></div>' +
            (recebedor ? '<p class="dica" id="pix-recebedor">Recebedor: ' + recebedor + '</p>' : '') + '</div>' +
          (codigo ? '<details class="pix-codigo"><summary>Prefere o PIX copia e cola? (já com o valor)</summary><div class="pix-copiar-linha"><input id="pix-codigo-campo" type="text" readonly value="' + esc(codigo) + '" aria-label="PIX copia e cola">' +
            '<button type="button" class="botao botao-claro" data-copiar="codigo" data-campo="pix-codigo-campo">Copiar código</button></div></details>' : '')
        : '<p class="aviso-combinar">A chave PIX será enviada pela Lili no WhatsApp.</p>') +
      '<section class="como-comprar" aria-labelledby="t-como"><h3 id="t-como">Como comprar?</h3><ol>' +
        '<li>Copie a chave PIX' + (qr ? ' (ou leia o QR code)' : '') + ' e abra o app do seu banco.</li>' +
        '<li>Efetue um PIX' + (recebedor ? ' para <strong>' + recebedor + '</strong>' : '') + ' no valor de <strong>' + esc(valor) + '</strong>.</li>' +
        '<li>Salve o comprovante.</li>' +
        '<li>Clique no botão do WhatsApp abaixo e envie o seu comprovante.</li>' +
      '</ol><p class="aviso-aprovacao">*O pedido só será aprovado após o envio do comprovante via WhatsApp.</p></section></div>';
  }

  function textoBotaoWhatsApp(m) {
    if (m.pedido.forma_pagamento !== 'PIX' || m.totais.aCombinar) return 'Enviar pedido pelo WhatsApp';
    return 'Enviar comprovante pelo WhatsApp';
  }

  function htmlTotal() {
    return '<dl class="total-linha" id="total-linha"><div><dt>Total</dt><dd>' + esc(db.textoTotal(resumo())) + '</dd></div></dl>';
  }

  function desenharGaveta() {
    var foco = document.activeElement, chave = null;
    if (foco && gaveta.contains(foco)) ['data-mais', 'data-menos'].forEach(function (a) { if (foco.hasAttribute(a)) chave = '[' + a + '="' + foco.getAttribute(a) + '"]'; });
    var r = resumo();
    if (etapa > 1 && etapa < 4 && !r.itens.length) etapa = 1;
    var corpo = document.getElementById('gaveta-corpo'), rodape = document.getElementById('gaveta-rodape'), etapas = document.getElementById('etapas');
    etapas.hidden = etapa < 4 && !r.itens.length;
    etapas.innerHTML = [[1, 'Itens'], [2, 'Entrega'], [3, 'Revisão'], [4, 'Pagamento']].map(function (e) {
      // Depois de registrado (etapa 4), o pedido não volta para edição
      if (e[0] < etapa) return '<li class="feita">' + (etapa < 4 ? '<button type="button" data-ir-etapa="' + e[0] + '">' + e[1] + '</button>' : e[1]) + '</li>';
      return '<li' + (e[0] === etapa ? ' aria-current="step"' : '') + '>' + e[1] + '</li>';
    }).join('');
    document.getElementById('gaveta-titulo').textContent = etapa === 4 ? (enviado && enviado.pedido.forma_pagamento === 'PIX' ? 'Pagamento' : 'Finalizar pedido') : 'Seu pedido';

    if (etapa === 1) {
      corpo.innerHTML = htmlItens(r);
      rodape.innerHTML = r.itens.length
        ? '<dl class="total-linha"><div><dt>Subtotal</dt><dd>' + db.dinheiro(r.subtotal) + (r.aCombinar ? ' + a combinar' : '') + '</dd></div></dl><button type="button" class="botao" data-ir-etapa="2">Continuar</button>'
        : '<a class="botao" href="' + caminhoBase() + 'cardapio.html">Ver o cardápio</a>';
    } else if (etapa === 2) {
      corpo.innerHTML = htmlEntrega();
      rodape.innerHTML = htmlTotal() + '<div class="acoes-gaveta"><button type="button" class="botao botao-claro" data-ir-etapa="1">Voltar</button><button type="submit" class="botao" form="form-entrega">Revisar pedido</button></div>';
    } else if (etapa === 3) {
      rascunho = montar();
      corpo.innerHTML = htmlRevisao(rascunho);
      var ehPix = rascunho.pedido.forma_pagamento === 'PIX' && !rascunho.totais.aCombinar;
      rodape.innerHTML = '<p class="nota-envio">' + (ehPix ? 'Na próxima tela você vê o QR code e a chave PIX para pagar.' : 'Na próxima tela você envia o pedido pelo WhatsApp.') + '</p>' +
        '<div class="acoes-gaveta"><button type="button" class="botao botao-claro" data-ir-etapa="2">Voltar</button>' +
        '<button type="button" class="botao" id="btn-pagar">' + (ehPix ? 'Ir para o pagamento' : 'Continuar') + '</button></div>';
    } else {
      corpo.innerHTML = htmlPagamento(enviado);
      rodape.innerHTML = '<a class="botao botao-whatsapp" id="btn-whatsapp" href="' + esc(db.linkWhatsApp(mensagem(enviado))) + '" target="_blank" rel="noopener">' +
        '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.7-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z"/></svg>' +
        textoBotaoWhatsApp(enviado) + '</a>' +
        '<p class="nota-envio" id="nota-whatsapp" hidden>WhatsApp aberto em outra aba. Não esqueça de anexar o comprovante na conversa.</p>' +
        '<button type="button" class="link-botao" data-fechar>Fechar</button>';
    }
    if (chave) (gaveta.querySelector(chave) || document.getElementById('gaveta-titulo')).focus();
  }

  /* Grava cliente, pedido e itens (no PHP: INSERT nas três tabelas, numa transação) */
  function gravarPedido(m) {
    var fone = db.soDigitos(m.telefone), cpf = db.soDigitos(m.cpf), lista = db.listar('cliente');
    // 1º pelo CPF; se a cliente já existia sem CPF (cadastrada pelo painel), pelo WhatsApp
    var cliente = lista.filter(function (c) { return db.soDigitos(c.cpf) === cpf; })[0] ||
      lista.filter(function (c) { return !c.cpf && db.soDigitos(c.telefone) === fone; })[0];
    var clienteId = cliente
      ? db.salvar('cliente', { id: cliente.id, nome: cliente.nome || m.nome, cpf: m.cpf, telefone: m.telefone })
      : db.salvar('cliente', { nome: m.nome, cpf: m.cpf, telefone: m.telefone, email: '', cidade: '' });
    var pedidoId = db.salvar('pedido', Object.assign({ cliente_id: clienteId }, m.pedido));
    m.itens.forEach(function (i) {
      db.salvar('pedido_item', { pedido_id: pedidoId, produto_id: i.produto_id, quantidade: i.quantidade, preco_unitario: i.preco_unitario });
    });
    m.numero = pedidoId;
    return m;
  }

  function enviar() {
    if (!rascunho) return;
    try { enviado = gravarPedido(rascunho); } catch (e) { enviado = rascunho; }
    var ids = Object.keys(carrinho);
    carrinho = {};
    guardar(CHAVE_CARRINHO, carrinho);
    dados.observacao = ''; dados.data_entrega = ''; dados.horario = '';
    guardar(CHAVE_DADOS, dados);
    ids.forEach(atualizarAcoes);
    atualizarContador();
    etapa = 4;
    desenharGaveta();
    document.getElementById('gaveta-corpo').scrollTop = 0;
    document.getElementById('gaveta-titulo').focus();
  }

  /* Copia a chave. 1) API da área de transferência (sites com https);
     2) seleciona o campo visível e usa execCommand (celular e http/arquivo local);
     3) se nada der certo, deixa o texto selecionado para a pessoa copiar. */
  function copiar(texto, botao, campo) {
    var original = botao.dataset.rotulo || botao.textContent;
    botao.dataset.rotulo = original;
    function pronto(ok) {
      botao.textContent = ok ? 'Copiado!' : 'Toque e segure para copiar';
      botao.classList.toggle('copiado', ok);
      setTimeout(function () { botao.textContent = original; botao.classList.remove('copiado'); }, 2500);
    }
    function selecionar(el) {
      // iOS só seleciona campo editável: libera por um instante
      el.readOnly = false;
      el.focus({ preventScroll: true });
      el.setSelectionRange(0, el.value.length);
      el.readOnly = true;
    }
    function reserva() {
      var el = campo;
      var temporario = !el;
      if (temporario) {
        el = document.createElement('input');
        el.value = texto; el.style.position = 'fixed'; el.style.opacity = '0'; el.style.fontSize = '16px';
        gaveta.appendChild(el);
      }
      selecionar(el);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      if (temporario) el.remove();
      else if (ok) el.blur();
      pronto(ok);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texto).then(function () { pronto(true); }, reserva);
    else reserva();
  }

  // Tocar no campo da chave seleciona tudo (facilita copiar no celular)
  gaveta.addEventListener('focusin', function (e) {
    if (e.target.matches('.pix-copiar-linha input')) e.target.setSelectionRange(0, e.target.value.length);
  });

  gaveta.addEventListener('click', function (e) {
    if (e.target === gaveta) { gaveta.close(); return; }
    var b = e.target.closest('[data-ir-etapa],[data-fechar],[data-copiar],#btn-pagar,#btn-whatsapp');
    if (!b) return;
    if (b.id === 'btn-pagar') enviar();
    else if (b.id === 'btn-whatsapp') {
      var nota = document.getElementById('nota-whatsapp');
      if (nota && enviado.pedido.forma_pagamento === 'PIX' && !enviado.totais.aCombinar) nota.hidden = false;
    }
    else if (b.hasAttribute('data-fechar')) gaveta.close();
    else if (b.dataset.copiar) {
      var t = enviado.totais;
      copiar(b.dataset.copiar === 'chave' ? db.config().pix_chave : db.pixCopiaECola(t.total, 'PEDIDO' + enviado.numero), b, document.getElementById(b.dataset.campo));
    } else irEtapa(Number(b.dataset.irEtapa));
  });

  gaveta.addEventListener('input', function (e) {
    var t = e.target;
    if (!t.form || t.form.id !== 'form-entrega' || !(t.name in dados)) return;
    if (t.name === 'cpf') t.value = db.formatarCpf(t.value);
    if (t.name === 'telefone') t.value = db.mascaraTelefone(t.value);
    dados[t.name] = t.value;
    guardar(CHAVE_DADOS, dados);
    if (t.getAttribute('aria-invalid') === 'true') {
      t.setAttribute('aria-invalid', 'false');
      var erro = document.getElementById('erro-' + t.name);
      if (erro) erro.hidden = true;
    }
  });

  /* Confere o campo ao sair dele, para a pessoa corrigir na hora */
  var CONFERIR = {
    nome: function (v) { return db.problemaNome(v); },
    cpf: function (v) { return db.problemaCpf(v); },
    telefone: function (v) { return db.problemaCelular(v); },
    endereco: function (v) { return db.problemaEndereco(v); }
  };
  gaveta.addEventListener('focusout', function (e) {
    var t = e.target;
    if (!t.form || t.form.id !== 'form-entrega' || !CONFERIR[t.name] || !t.value.trim()) return;
    var msg = CONFERIR[t.name](t.value), erro = document.getElementById('erro-' + t.name);
    if (!erro) return;
    erro.textContent = msg; erro.hidden = !msg;
    t.setAttribute('aria-invalid', msg ? 'true' : 'false');
  });

  gaveta.addEventListener('change', function (e) {
    var t = e.target;
    if (!t.form || t.form.id !== 'form-entrega') return;
    if (t.name in dados) { dados[t.name] = t.value; guardar(CHAVE_DADOS, dados); }
    if (t.name === 'entrega') {
      document.getElementById('campo-endereco').hidden = t.value !== 'Entrega';
      document.getElementById('total-linha').outerHTML = htmlTotal();
    }
  });

  gaveta.addEventListener('submit', function (e) {
    if (e.target.id !== 'form-entrega') return;
    e.preventDefault();
    if (validar()) irEtapa(3);
  });

  gaveta.addEventListener('close', function () { if (etapa === 4) { etapa = 1; enviado = null; } });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add],[data-mais],[data-menos],[data-remover],[data-abrir-pedido]');
    if (!b) return;
    if (b.hasAttribute('data-abrir-pedido')) abrirGaveta();
    else if (b.dataset.add) adicionar(b.dataset.add);
    else if (b.dataset.mais) definirQuantidade(b.dataset.mais, (carrinho[b.dataset.mais] || 0) + 1);
    else if (b.dataset.menos) definirQuantidade(b.dataset.menos, (carrinho[b.dataset.menos] || 0) - 1);
    else if (b.dataset.remover) {
      var id = b.dataset.remover;
      delete carrinho[id];
      guardar(CHAVE_CARRINHO, carrinho);
      atualizarAcoes(id); atualizarContador(); desenharGaveta();
      document.getElementById('gaveta-titulo').focus();
    }
  });

  /* ---------- conteúdo que vem da configuração ---------- */
  /* As páginas ficam na raiz; o caminho base serve para o 404 em subpastas do servidor */
  function caminhoBase() { return document.documentElement.dataset.base || ''; }

  function atualizarLinksWhatsApp() {
    var numero = db.numeroWhatsApp();
    document.querySelectorAll('a[href^="https://wa.me/"]').forEach(function (a) {
      if (gaveta.contains(a)) return;
      a.href = a.href.replace(/wa\.me\/\d+/, 'wa.me/' + numero);
    });
  }

  /* Preenche as informações da loja. Campo vazio no painel: a linha inteira some do site. */
  function preencherConfig() {
    var c = db.config(), t = taxaEntrega(), ant = Number(c.antecedencia_dias) || 0;
    var insta = String(c.instagram || '').replace(/^@/, '').trim();
    var valores = {
      whatsapp: '<a href="' + esc(db.linkWhatsApp('Olá! Vim pelo site do Forninho da Lili.')) + '" target="_blank" rel="noopener">' + esc(db.telefoneBr(c.whatsapp)) + '</a>',
      horario: c.horario ? esc(c.horario) : '',
      instagram: insta ? '<a href="https://instagram.com/' + encodeURIComponent(insta) + '" target="_blank" rel="noopener">@' + esc(insta) + '</a>' : '',
      antecedencia: ant ? ant + (ant === 1 ? ' dia' : ' dias') : '',
      taxa: t === null ? '' : t === 0 ? 'Sem taxa' : db.dinheiro(t),
      retirada: aceitaRetirada() && c.endereco_retirada ? esc(c.endereco_retirada) : '',
      cancelamento: c.politica_cancelamento ? esc(c.politica_cancelamento) : ''
    };
    document.querySelectorAll('[data-config]').forEach(function (el) {
      var v = valores[el.dataset.config];
      if (v === undefined) return;
      el.innerHTML = v;
      // a linha é o <div> que envolve o <dt>/<dd>
      var linha = el.closest('dl > div');
      if (linha) linha.hidden = !v;
    });
    // Quadro de informações sem nenhuma linha visível some inteiro
    document.querySelectorAll('.infos').forEach(function (dl) {
      dl.hidden = !dl.querySelector(':scope > div:not([hidden])');
    });

    var faq = document.getElementById('faq-lista');
    if (faq) {
      var perguntas = [
        ['Como faço meu pedido?', 'Adicione os doces ao pedido, informe a data e o endereço, pague com PIX pelo QR code ou pela chave e envie o comprovante pelo WhatsApp. A mensagem já vai pronta com os produtos, os valores e o total.'],
        ['Quais são as formas de pagamento?', 'PIX ou dinheiro. No PIX, ao finalizar o pedido aparecem o QR code e a chave para copiar. Depois é só enviar o comprovante pelo WhatsApp: o pedido é aprovado após o envio do comprovante.'],
        ['Vocês fazem entrega?', (aceitaRetirada() ? 'Sim, e você também pode escolher retirar o pedido. ' : 'Sim, o pedido é entregue no endereço que você informar. ') + (t === null ? 'A taxa de entrega é combinada pelo WhatsApp.' : t === 0 ? 'A entrega não tem taxa.' : 'A taxa de entrega é de ' + db.dinheiro(t) + '.')],
        ['Com quanto tempo de antecedência devo pedir?', ant ? 'Faça o pedido com pelo menos ' + ant + (ant === 1 ? ' dia' : ' dias') + ' de antecedência. Todos os doces são feitos sob encomenda.' : 'Todos os doces são feitos sob encomenda. A antecedência mínima é confirmada pela Lili no atendimento.'],
        ['Posso personalizar um kit?', 'Sim. No Kit personalizado, você conta a ocasião e a Lili monta o kit com os doces escolhidos. O valor é combinado pelo WhatsApp.'],
        ['Tenho alergia ou restrição alimentar. E agora?', 'Cada produto mostra os alérgicos que contém. Se tiver alguma restrição, avise nas observações do pedido e confirme os ingredientes com a Lili.']
      ];
      faq.innerHTML = perguntas.map(function (q) { return '<details><summary>' + q[0] + '</summary><p>' + esc(q[1]) + '</p></details>'; }).join('');
    }
  }

  /* Banner da página inicial (tabela banner, editada em admin/banner.html) */
  function aplicarBanner() {
    if (!document.querySelector('[data-banner]')) return;
    var b = db.banner();
    document.querySelectorAll('[data-banner]').forEach(function (el) {
      var campo = el.dataset.banner;
      if (campo === 'imagem') {
        if (b.imagem) { el.src = db.urlImagem(b.imagem, caminhoBase()); el.alt = b.imagem_alt || ''; }
      } else if (b[campo] !== undefined) {
        el.textContent = b[campo];
      }
    });
    // Informação sem título nem texto some da faixa
    document.querySelectorAll('[data-banner-item]').forEach(function (li) {
      var n = li.dataset.bannerItem;
      li.hidden = !b['destaque' + n + '_titulo'] && !b['destaque' + n + '_texto'];
    });
  }

  /* Vitrine da página inicial: o texto e o botão de cada doce vêm do cadastro */
  function atualizarVitrine() {
    document.querySelectorAll('.vitrine-item[data-produto]').forEach(function (li) {
      var p = produto(li.dataset.produto);
      var acao = li.querySelector('.item-acao');
      if (!p) { acao.innerHTML = htmlAcao(null); return; }
      li.querySelector('h3').textContent = p.nome;
      li.querySelector('.preco').textContent = db.dinheiro(p.preco);
      var desc = li.querySelector('.vitrine-desc'); if (desc) desc.textContent = p.descricao || '';
      var al = li.querySelector('.alergia'); if (al) al.textContent = p.alergia || '';
      acao.innerHTML = htmlAcao(p);
    });
  }

  /* Formulário de contato: abre o WhatsApp com a mensagem escrita */
  var formContato = document.getElementById('form-contato');
  if (formContato) {
    formContato.addEventListener('submit', function (e) {
      e.preventDefault();
      var nome = formContato.nome.value.trim(), msg = formContato.mensagem.value.trim();
      var erro = document.getElementById('erro-mensagem');
      if (!msg) {
        erro.textContent = 'Escreva sua mensagem.'; erro.hidden = false;
        formContato.mensagem.setAttribute('aria-invalid', 'true'); formContato.mensagem.focus();
        return;
      }
      erro.hidden = true; formContato.mensagem.setAttribute('aria-invalid', 'false');
      window.open(db.linkWhatsApp('Olá, Lili!' + (nome ? ' Meu nome é ' + nome + '.' : '') + '\n\n' + msg), '_blank', 'noopener');
    });
  }

  limparCarrinho();
  aplicarBanner();
  atualizarLinksWhatsApp();
  preencherConfig();
  atualizarVitrine();
  atualizarContador();

  /* Se o carrinho mudar em outra aba, esta acompanha */
  window.addEventListener('storage', function (e) {
    if (e.key !== CHAVE_CARRINHO) return;
    carrinho = ler(CHAVE_CARRINHO, {});
    Object.keys(produtos().reduce(function (o, p) { o[p.id] = 1; return o; }, {})).forEach(atualizarAcoes);
    atualizarContador();
  });

  window.Loja = { htmlAcao: htmlAcao, minimo: minimo };
})();
