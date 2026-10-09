// Links de convite antigos (/?confirmar=<id>) abrem a página própria do convite.
// Script clássico e minúsculo, no <head>: roda antes de o resto do painel começar
// a baixar — o membro não precisa do app inteiro só para responder.
(function () {
  var id = new URLSearchParams(location.search).get('confirmar');
  if (id) location.replace('/convite.html?id=' + encodeURIComponent(id));
})();
