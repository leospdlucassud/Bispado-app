// =============================================
// DIÁLOGOS — substituem prompt() e confirm() nativos por modais no tema do app.
// Ambos retornam Promise; usar com await.
// =============================================

export function _fecharDialogo() {
  document.getElementById('modal-dialogo').classList.remove('open');
  document.getElementById('modal-dialogo-content').innerHTML = '';
}

// confirmar('Excluir?') -> Promise<boolean>
export function confirmar(mensagem, { perigo = false, okLabel = 'Confirmar' } = {}) {
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-dialogo');
    const box = document.getElementById('modal-dialogo-content');
    box.innerHTML = `
      <div style="font-size:14px;color:#c8d8e8;line-height:1.6;margin-bottom:18px">${esc(mensagem)}</div>
      <div style="display:flex;gap:8px">
        <button id="dlg-ok" style="flex:1;background:${perigo ? '#e05555' : '#c9a84c'};color:${perigo ? '#fff' : '#0d1b2a'};border:none;border-radius:10px;padding:11px;font-weight:700;cursor:pointer;font-size:13px">${esc(okLabel)}</button>
        <button id="dlg-cancel" style="background:rgba(74,106,138,.25);color:#8eacc8;border:none;border-radius:10px;padding:11px 18px;cursor:pointer;font-size:13px">Cancelar</button>
      </div>`;
    overlay.classList.add('open');
    const fim = v => { _fecharDialogo(); resolve(v); };
    box.querySelector('#dlg-ok').onclick = () => fim(true);
    box.querySelector('#dlg-cancel').onclick = () => fim(false);
    box.querySelector('#dlg-ok').focus();
  });
}

// pedirTexto('Título', [{id,label,tipo,valor,placeholder,obrigatorio}]) -> Promise<{id: valor}|null>
// Aceita também uma string simples como campos, virando um único campo de texto.
export function pedirTexto(titulo, campos, { okLabel = 'Salvar' } = {}) {
  if (typeof campos === 'string') campos = [{ id: 'valor', label: campos }];
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-dialogo');
    const box = document.getElementById('modal-dialogo-content');
    const campoHtml = c => {
      const comum = `id="dlg-${c.id}" style="font-size:13px" ${c.obrigatorio ? 'required' : ''}`;
      const controle = c.tipo === 'textarea'
        ? `<textarea class="form-input" ${comum} rows="3" placeholder="${esc(c.placeholder || '')}" style="resize:vertical;font-size:13px">${esc(c.valor || '')}</textarea>`
        : `<input type="${c.tipo || 'text'}" class="form-input" ${comum} value="${esc(c.valor || '')}" placeholder="${esc(c.placeholder || '')}">`;
      return `<div class="form-group"><label>${esc(c.label)}</label>${controle}</div>`;
    };
    box.innerHTML = `
      <h3>${esc(titulo)} <button class="modal-close" id="dlg-x">✕</button></h3>
      ${campos.map(campoHtml).join('')}
      <button class="btn-primary" id="dlg-ok">${esc(okLabel)}</button>`;
    overlay.classList.add('open');

    const cancelar = () => { _fecharDialogo(); resolve(null); };
    const confirmar = () => {
      const out = {};
      for (const c of campos) {
        const v = box.querySelector(`#dlg-${c.id}`).value.trim();
        if (c.obrigatorio && !v) { box.querySelector(`#dlg-${c.id}`).focus(); return; }
        out[c.id] = v;
      }
      _fecharDialogo();
      resolve(out);
    };
    box.querySelector('#dlg-x').onclick = cancelar;
    box.querySelector('#dlg-ok').onclick = confirmar;
    const primeiro = box.querySelector('input, textarea');
    if (primeiro) {
      primeiro.focus();
      primeiro.addEventListener('keydown', e => {
        if (e.key === 'Enter' && primeiro.tagName !== 'TEXTAREA') { e.preventDefault(); confirmar(); }
      });
    }
  });
}
