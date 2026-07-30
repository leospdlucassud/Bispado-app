// =============================================
// PONTO DE ENTRADA (ES Modules)
// Carrega os módulos na ordem de dependência e expõe seus símbolos no `window`.
// Essa "ponte" mantém os handlers inline (onclick="...") funcionando enquanto a
// migração avança. Nas próximas fases, cada área troca os onclick por listeners
// e sai da ponte, até ela poder ser removida.
// =============================================
import * as mDados     from './dados-membros.js';
import * as mConfig    from './config.js';
import * as mUtils     from './utils.js';
import * as mUi        from './ui.js';
import * as mDialogo   from './dialogo.js';
import * as mUsuario   from './usuario.js';
import * as mApi       from './api.js';
import * as mOffline   from './offline-pwa.js';
import * as mTema      from './tema.js';
import * as mAgenda    from './agenda.js';
import * as mAcomp     from './acompanhamento.js';
import * as mReunioes  from './reunioes.js';
import * as mDesig     from './designacoes.js';
import * as mCalendario from './calendario.js';
import * as mSacramental from './sacramental.js';
import * as mMembros   from './membros.js';
import * as mImport    from './membros-import.js';
import * as mNotas     from './notas.js';
import * as mManual    from './manual.js';
import * as mPdf       from './pdf.js';
import * as mBusca     from './busca.js';
import * as mApp       from './app.js';

const modulos = [
  mDados, mConfig, mUtils, mUi, mDialogo, mUsuario, mApi, mOffline, mTema,
  mAgenda, mAcomp, mReunioes, mDesig, mCalendario, mSacramental, mMembros,
  mImport, mNotas, mManual, mPdf, mBusca, mApp,
];

for (const ns of modulos) {
  for (const [nome, valor] of Object.entries(ns)) {
    window[nome] = valor;
  }
}
