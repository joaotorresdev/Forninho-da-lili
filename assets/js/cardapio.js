/* ==========================================================
   CARDÁPIO — monta os cartões a partir do "banco" (dados.js)
   Cada cartão tem o botão "Adicionar ao pedido" (loja.js).
   Só aparecem produtos ATIVOS. Produto desativado some do
   cardápio, mas continua guardado e nos pedidos antigos.
   Na versão PHP, este arquivo deixa de existir: o servidor
   faz o mesmo laço com SELECT * FROM produto WHERE ativo = 1.
   ========================================================== */
(function () {
  'use strict';
  if (!window.LojaDB) return;
  var db = window.LojaDB;
  var esc = db.esc;

  function foto(p) {
    if (p.imagem) {
      return '<div class="foto"><img src="' + esc(db.urlImagem(p.imagem)) + '" alt="' + esc(p.imagem_alt || p.nome) +
        '" width="800" height="800" loading="lazy"></div>';
    }
    // Produto ainda sem foto: mostra o selo da marca no lugar
    return '<div class="foto"><div class="foto-pendente"><img src="assets/img/logo-selo.jpg" alt="Forninho da Lili" width="120" height="120"></div></div>';
  }

  /* Botão "Adicionar ao pedido" (assets/js/loja.js). Sem o loja.js, volta ao link do WhatsApp. */
  function acao(p) {
    if (window.Loja) return window.Loja.htmlAcao(p);
    return '<a class="botao" href="' + esc(db.linkWhatsApp('Olá! Gostaria de encomendar: ' + p.nome + '.')) + '" target="_blank" rel="noopener">Encomendar via WhatsApp</a>';
  }

  function minimo(p) { return Math.max(1, Number(p.quantidade_minima) || 1); }

  /* Ficha com ingredientes, conservação e tamanho: só aparece se algum campo estiver preenchido */
  function ficha(p) {
    var linhas = [['Ingredientes', p.ingredientes], ['Conservação e validade', p.conservacao], ['Tamanho ou peso', p.tamanho]]
      .filter(function (l) { return l[1]; });
    if (!linhas.length) return '';
    return '<details class="ficha"><summary>Ficha do produto</summary><dl>' +
      linhas.map(function (l) { return '<div><dt>' + l[0] + '</dt><dd>' + esc(l[1]) + '</dd></div>'; }).join('') + '</dl></details>';
  }

  function cartao(p) {
    return '<article class="item">' + foto(p) +
      '<div class="item-corpo">' +
      '<h4 class="nome-produto">' + esc(p.nome) + '</h4>' +
      '<p class="preco">' + esc(db.dinheiro(p.preco)) + '</p>' +
      (p.descricao ? '<p class="item-descricao">' + esc(p.descricao) + '</p>' : '') +
      (p.alergia ? '<p class="alergia">' + esc(p.alergia) + '</p>' : '') +
      (minimo(p) > 1 ? '<p class="minimo">Pedido mínimo: ' + minimo(p) + ' unidades</p>' : '') +
      ficha(p) +
      '<div class="item-acao" data-acao="' + p.id + '">' + acao(p) + '</div>' +
      '</div></article>';
  }

  var ativos = db.listar('produto').filter(function (p) { return Number(p.ativo) === 1; });

  db.CATEGORIAS.forEach(function (cat) {
    var grupo = document.querySelector('.grupo[data-categoria="' + cat.id + '"]');
    if (!grupo) return;
    var lista = grupo.querySelector('.lista-produtos');
    var daCategoria = ativos.filter(function (p) { return p.categoria === cat.id; });
    lista.innerHTML = daCategoria.map(cartao).join('');
    // Categoria sem nenhum produto ativo não aparece
    grupo.hidden = daCategoria.length === 0;
  });
})();
