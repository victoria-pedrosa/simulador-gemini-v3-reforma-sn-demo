/**
 * =============================================================================
 *  AUTOMAÇÃO SIMPLES NACIONAL / REFORMA TRIBUTÁRIA 2027 — SCRIPT COMPLETO
 *  Escritório Contábil Exemplo
 *
 *  Compatível com a planilha "Simulador da Reforma SN 2027 - ESTRUTURADO"
 *  (29 colunas na aba "Simples Nacional", A..AC).
 *
 *  O QUE ESTE SCRIPT FAZ
 *   0️⃣  Setup da estrutura e injeção das bases (CNAE×Item e Item×NBS×Redução)
 *   1️⃣  Importa PJ do sistema e monta a Correlação CNAE × Item
 *   1️⃣b Reconstrói a Correlação sem duplicar empresas
 *   2️⃣  Lê os extratos do PGDAS-D (DAS, PIS, COFINS, faturamento, RBT12, RBT12p)
 *   2️⃣b Restaura as fórmulas calculadas (Faixa, Alíquota Cheia, ISS, RBT12 base)
 *   3️⃣  Gera o COMUNICADO TÉCNICO em PDF  (modelo Google Docs — INALTERADO)
 *   4️⃣  Gera o ESTUDO DETALHADO em PDF   (documento NOVO, em percentuais)
 *   🔧  Migra o layout 2027 e monta o painel da aba "Analise por CNPJ"
 *
 *  IMPORTANTE — o Comunicado e o Estudo Detalhado são documentos DIFERENTES:
 *  o Comunicado continua saindo do modelo ID_MODELO_COMUNICADO, em R$, sem
 *  nenhuma alteração. O Estudo Detalhado é gerado por código, em %, com paleta
 *  verde escuro, e nunca toca no modelo do Comunicado.
 * =============================================================================
 */

// =============================================================================
// CONFIGURAÇÕES — IDs DA AUTOMAÇÃO
// =============================================================================
const ID_PLANILHA_PJ        = "ID_EXEMPLO";
// Modelos do COMUNICADO TÉCNICO (Google Docs). São DOIS textos diferentes:
//   • ENGENHARIA e SAÚDE ... modelo específico desses segmentos
//   • demais segmentos ..... modelo padrão
// A escolha por empresa sai da aba "Segmentos" (coluna AR da aba Simples
// Nacional) — ver segmentoDaEmpresa_() e modeloComunicadoPara_().
const ID_MODELO_COMUNICADO_PADRAO     = "ID_EXEMPLO";
const ID_MODELO_COMUNICADO_ENG_SAUDE  = "ID_EXEMPLO";
// Compatibilidade com trechos antigos que citavam a constante única.
const ID_MODELO_COMUNICADO            = ID_MODELO_COMUNICADO_PADRAO;
const ID_PASTA_DESTINO_PDF  = "ID_EXEMPLO";
const ID_PASTA_EXTRATOS     = "ID_EXEMPLO";

// O DAS Híbrido 2027 (coluna T) hoje soma apenas a CBS, como estava na planilha
// original. A aba "Parâmetros" descreve "+ CBS + IBS". Vire para true quando
// decidirem incluir o IBS de teste (0,1%) no híbrido — muda o valor exibido em
// T, L e U para TODAS as empresas já processadas.
const INCLUIR_IBS_NO_HIBRIDO = false;

// Layout canônico da aba "Simples Nacional" — 29 colunas (A..AC).
// A..X já existiam. Y..AC entraram na reestruturação de 2027:
//   Y  RBT12p ....... receita proporcionalizada impressa pela Receita no extrato
//   Z  Data Abertura  identifica empresa com menos de 12 meses de atividade
//   AA RBT12 Base ... escolhe automaticamente Y (se houver) ou E
//   AB Alíq. ISS % .. ISS destacado na nota, com teto legal de 5%
//   AC Anexo Apurado  resolve cadastros multi-anexo ("III/V" -> "III")
//   AD CNAE Principal 7 dígitos do 1º CNAE do cadastro — define a redução (S)
//   AE ISS fora ..... 6ª faixa dos Anexos III/IV/V: o ISS sai do DAS e é devido ao
//                     Município, mas continua compondo a carga (Parâmetros!B4)
//   AF Total atual .. alíquota efetiva do DAS + ISS por fora = carga de hoje
const HEADERS_SN_2027 = [
  "CNPJ", "Razão Social", "CNAEs (Todos)", "Anexo do Simples Nacional",
  "RBT12", "Fator R", "Alíquota Efetiva Atual", "Valor no DAS",
  "Faturamento", "CBS Devido - FORA do DAS (R$)", "IBS Devido - FORA do DAS (R$)",
  "Alíquota Efetiva Híbrida 2027", "Status", "☑️ SELECIONAR",
  "% PIS+COFINS sobre o DAS", "PIS no DAS (R$)", "COFINS no DAS (R$)",
  "DAS sem PIS/COFINS (R$)", "Redução da Atividade (%)", "DAS Híbrido 2027 (R$)",
  "Diferença Híbrido x DAS Atual (R$)",
  "Faixa RBT12 (Simples)", "Alíquota Efetiva Cheia (RBT12, c/ ISS)",
  "ISS não recolhido via DAS (R$)",
  "RBT12p (Proporcionalizada)", "Data de Abertura",
  "RBT12 Base do Cálculo (R$)", "Alíquota ISS destacada na NF (%)",
  "Anexo Apurado (usado no cálculo)", "CNAE Principal (dígitos)",
  "ISS fora do DAS - 6ª faixa (%)", "Alíquota Efetiva Total Atual (c/ ISS fora) (%)",
  "Receita Mercado Interno (R$)", "Receita Mercado Externo (R$)", "% de Exportação (RPA)",
  "RBT12 Mercado Interno (R$)", "RBT12 Mercado Externo (R$)",
  "% do DAS Imune na Exportação (partilha)",
  "Alíquota Efetiva Atual Ajustada (imunidade export.) (%)",
  "Habilitação Profissional (art. 127)", "Redução Original do Item Predominante (%)",
  "Requisito do art. 127 (atividade diversa)", "CNAEs fora da habilitação profissional",
  "Segmento (modelo do Comunicado)"
];

// Layout da aba "Correlação CNAEs" — 13 colunas (A..M).
// A descrição do CNAE fica logo depois do CNAE (coluna D), do mesmo jeito que a
// descrição do item fica depois do item — por isso a Redução Reforma está em H.
// A coluna M repete a chave CNPJ|CNAE apenas na linha do item predominante:
// é por ela que a coluna S da aba "Simples Nacional" acha a redução do CNAE principal.
// Layout da aba "Correlação CNAEs" — 18 colunas (A..R), na ordem em que se LÊ
// a decisão: item -> redução aplicada -> redução original -> por que mudou ->
// qual CNAE derrubou -> qual habilitação. As colunas de chave e de controle
// ficam no fim, fora do caminho.
//   H  Redução APLICADA ....... é ESTA que a coluna S da aba Simples Nacional lê
//   I  Redução ORIGINAL ....... o que o item daria sem o art. 127
//   J  Requisito do art. 127 .. ZERADA / MANTIDA / não se aplica
//   K  CNAEs que descumprem ... basta um para zerar
//   L  Habilitação profissional
const HEADERS_CORRELACAO = [
  "CNPJ", "Razão Social", "CNAE", "Descrição do CNAE", "Item da Lista",
  "Descrição do Item", "NBS",
  "Redução APLICADA (%)", "Redução ORIGINAL do item (%)",
  "Art. 127 — requisito cumulativo", "CNAEs que descumprem o requisito",
  "Habilitação profissional (art. 127)",
  "Fundamento da Redução (LC 214/2025)",
  "CNAE (dígitos)", "Chave CNPJ+CNAE+Item",
  "Item predominante (S/N)", "Chave CNPJ+CNAE predominante",
  "Casamento CNAE × Item"
];
const COR_COL_CNPJ       = "A";
const COR_COL_REDUCAO    = "H";   // redução APLICADA — é a que alimenta a coluna S
const COR_COL_RED_ORIG   = "I";   // redução ANTES do teste do art. 127
const COR_COL_REQ127     = "J";   // status do requisito cumulativo
const COR_COL_FORA127    = "K";   // CNAEs que descumprem o requisito
const COR_COL_HABIL      = "L";   // habilitação profissional do art. 127
const COR_COL_CHAVE_PRED = "Q";   // CNPJ|7 dígitos do CNAE, só na linha predominante
const COR_COL_MATCH      = "R";   // casamento exato (subclasse) ou por aproximação (raiz)
const COR_COL_CHAVE_PRED_PESQ = "S"; // override: só existe quando pesquisa manual (VÁRIOS)
                                      // sobrescreve o item usado no cálculo do CNAE principal
const COR_COL_ITEM_PESQUISADO = "T"; // Item da Lista pesquisado manualmente (aba VÁRIOS)
const COR_COL_STATUS_PESQUISA = "U"; // status da conferência do item pesquisado
const COR_COL_ESTAGIARIO_PESQ = "V"; // estagiário responsável pela pesquisa
const ABA_ITENS_PESQUISADOS   = "Itens Pesquisados VÁRIOS";
const LARANJA_MULTI_ITEM      = "#FCE5CD";
const LARANJA_MULTI_ITEM_TXT  = "#B45F06";
// Índices 0-based das linhas montadas em memória (mesma ordem do cabeçalho)
const COR_IX = { cnpj: 0, razao: 1, cnae: 2, dcnae: 3, item: 4, ditem: 5, nbs: 6,
                 red: 7, redOrig: 8, req127: 9, fora127: 10, habil: 11, fund: 12,
                 dig: 13, chave: 14, pred: 15, chavePred: 16, match: 17 };
// Cores da marcação das linhas zeradas pelo art. 127 (consulta e explicação ao cliente)
const AMARELO_LINHA_127  = "#FFF2CC";
const AMARELO_CEL_127    = "#FFE599";
const AMARELO_TXT_127    = "#8C5A00";
// Faixa usada nas fórmulas do painel (a Correlação passa de 8.900 linhas com a
// expansão de todos os itens por CNAE; deixe folga se a carteira crescer).
const COR_LINHA_FIM   = 20000;

// Nome da aba do painel por CNPJ (antiga "Calculo Manual").
const ABA_ANALISE = "Analise por CNPJ";
// Colunas que ficam VISÍVEIS na aba "Simples Nacional" — as demais são ocultadas,
// já que a consulta empresa a empresa é feita na aba "Analise por CNPJ".
// Colunas VISÍVEIS na aba "Simples Nacional" — as demais ficam ocultas. A leitura
// empresa a empresa é feita na aba "Analise por CNPJ"; aqui fica só o panorama
// da carteira. A coluna S (Redução da Atividade) recebe formatação condicional
// AMARELA quando a redução foi zerada pelo art. 127 — ver formatarColunaReducao_.
const COLUNAS_VISIVEIS_SN = ["A", "B", "C", "D", "E", "G", "L", "M", "N", "S", "AF", "AR"];

// Paleta verde escuro (Estudo Detalhado e cabeçalhos)
const VERDE_ESCURO = "#0B3D2E";
const VERDE_MEDIO  = "#145A43";
const VERDE_HEADER = "#2E6B54";
const VERDE_CLARO  = "#E4EFE9";
const VERDE_TOTAL  = "#D5E8DD";
const DOURADO      = "#A98A2E";
const CINZA_TXT    = "#4A5A52";

// Linhas da tabela oficial na aba "Parâmetros" (5 anexos × 6 faixas)
const PAR_TAB_INI = 10;
const PAR_TAB_FIM = 39;

// =============================================================================
// MENU
// =============================================================================
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚙️ Automação 2027')
    .addItem('▶️  ATUALIZAR TUDO (é só clicar)', 'atualizarTudo_2027')
    .addSeparator()
    .addItem('1 · Ler os extratos do mês', 'lerExtratosDoMes_2027')
    .addItem('2 · Conferir e marcar linhas com problema', 'conferirLinhas_2027')
    .addItem('3 · Corrigir as linhas marcadas', 'reprocessarMarcadas_2027')
    .addItem('4 · Recalcular as fórmulas da aba', 'restaurarFormulasCalculadas')
    .addSeparator()
    .addItem('📄  Gerar Comunicado (PDF)', 'gerarComunicadoUnico')
    .addItem('📊  Gerar Estudo Detalhado (empresa da aba Analise por CNPJ)', 'gerarEstudoDetalhadoUnico')
    .addItem('📊  Gerar Estudo Detalhado em lote (linhas marcadas ☑️)', 'gerarEstudoDetalhadoEmLote')
    .addSeparator()
    .addSubMenu(ui.createMenu('🛠️  Avançado')
      .addItem('Importar PJ e gerar Correlação', 'importarEmpresasPJ')
      .addItem('Reconstruir Correlação CNAEs (sem duplicar empresas)', 'reconstruirCorrelacaoCNAEs')
      .addItem('Aplicar Item Pesquisado (VÁRIOS)', 'aplicarItensPesquisadosVarios')
      .addItem('Corrigir Anexo pelo Item Pesquisado (VÁRIOS)', 'corrigirAnexoPorItemPesquisado')
      .addSeparator()
      .addItem('Marcar só faturamento parcial', 'marcarFaturamentoSuspeito_2027')
      .addItem('Marcar só anexo do extrato / RBT12p', 'marcarReprocessarAnexoERbt12p_2027')
      .addItem('Recomeçar o "Atualizar tudo" do zero', 'reiniciarAtualizarTudo_2027')
      .addSeparator()
      .addItem('Migrar Layout 2027 (rodar 1x)', 'migrarLayout2027_v2')
      .addItem('Remontar painel da aba Analise por CNPJ', 'remontarCalculoManual')
      .addItem('Recalcular Alíquotas da aba EMPRESAS CLIENTES', 'gerarAliquotasClientes')
      .addItem('Setup: criar estrutura e injetar bases', 'setupPlanilhaEInjetarBase')
      .addSeparator()
      .addSubMenu(ui.createMenu('🧪 Diagnóstico')
        .addItem('Testar extração (3 empresas, 06/2026)', 'TEMP_testarExtrato_06_2026')
        .addItem('Testar 1 comunicado', 'TEMP_testarComunicado_1')
        .addItem('Dump do texto do extrato (1 CNPJ)', 'TEMP_dumpTeste')
        .addItem('Conferir colunas da aba Simples Nacional', 'TEMP_diagnosticoColunas')
        .addItem('Conferir duplicatas na Correlação', 'TEMP_diagnosticoDuplicatasChave')
      )
    )
    .addToUi();
}

function exibirAlerta(mensagem) {
  try { SpreadsheetApp.getUi().alert(mensagem); }
  catch (e) { Logger.log(mensagem); }
}

// =============================================================================
// ORÇAMENTO DE TEMPO DE UMA EXECUÇÃO
// -----------------------------------------------------------------------------
// O Apps Script mata a execução no limite duro da conta:
//   • Google Workspace (é o caso de @exemplo.com.br) ... 30 min por execução
//   • conta gratuita (@gmail.com) ......................... 6 min por execução
// Trabalhamos até MINUTOS_EXECUCAO menos a MARGEM_FECHAMENTO_MS, para sobrar
// tempo de gravar o status na planilha e mostrar o resumo na tela. Se a execução
// fosse até o limite exato, o Google cortaria antes do alerta aparecer e você
// não saberia o que ficou pronto.
// Para mudar o tempo de TODAS as rotinas (leitura de extratos, comunicados e
// Estudo Detalhado em PDF), mexa só em MINUTOS_EXECUCAO.
// =============================================================================
// SEM TRAVA DE TEMPO (padrão).
// MINUTOS_EXECUCAO = 0 significa: as rotinas NÃO param sozinhas por tempo. A fila
// é percorrida até o fim e, se o Apps Script cortar a execução no limite da conta
// (30 min no Workspace, 6 min em conta gratuita), corta — o que já ficou pronto
// está gravado na planilha e basta rodar de novo para continuar.
// Se algum dia quiser a parada preventiva de volta (com resumo na tela em vez de
// corte seco do Google), ponha aqui o número de minutos, ex.: 30.
const MINUTOS_EXECUCAO        = 0;
const MARGEM_FECHAMENTO_MS    = 90 * 1000;
const LIMITE_EXEC_MS          = MINUTOS_EXECUCAO > 0
  ? (MINUTOS_EXECUCAO * 60 * 1000 - MARGEM_FECHAMENTO_MS)
  : Infinity;
const SEM_TRAVA_DE_TEMPO      = !isFinite(LIMITE_EXEC_MS);

// Teto de insistência POR EMPRESA no lote. 0 = sem teto (uma empresa pode
// insistir o quanto precisar). Só faz sentido com MINUTOS_EXECUCAO > 0.
const LIMITE_POR_EMPRESA_MS   = 0;

// A insistência é limitada por NÚMERO DE TENTATIVAS, não por relógio: é isso que
// impede um erro permanente de girar em loop e consumir a execução inteira sem
// atender as outras empresas. 8 tentativas = ~3 min de espera acumulada.
const MAX_TENTATIVAS_RETRY    = 8;

// Espera entre tentativas (backoff). A última espera se repete: 2s, 5s, 10s, 20s, 30s, 60s...
const ESPERAS_BACKOFF_MS      = [2000, 5000, 10000, 20000, 30000, 60000];

// Cronômetro da execução. Use prazo.expirou() nos laços e prazo.restanteMs()
// para saber quanto tempo ainda pode ser gasto insistindo.
function novoPrazo_(limiteMs) {
  const inicio = new Date().getTime();
  const limite = (limiteMs === undefined || limiteMs === null) ? LIMITE_EXEC_MS : limiteMs;
  return {
    inicio: inicio,
    limiteMs: limite,
    decorridoMs: function () { return new Date().getTime() - inicio; },
    restanteMs: function () { return Math.max(limite - this.decorridoMs(), 0); },
    expirou: function () { return this.restanteMs() <= 0; },
    minutosDecorridos: function () { return Math.round(this.decorridoMs() / 6000) / 10; },
    // texto do tempo restante para os avisos (sem trava, não há "restante")
    restanteTxt: function () {
      return isFinite(this.limiteMs) ? ("~" + Math.ceil(this.restanteMs() / 60000) + " min de prazo")
                                     : "sem trava de tempo";
    }
  };
}

// Fatia de tempo de UMA empresa dentro de um lote. Com LIMITE_POR_EMPRESA_MS = 0
// (padrão) não há teto: a empresa insiste o que precisar, limitada só pelo número
// de tentativas do comRetryAtePrazo_.
function prazoDaEmpresa_(prazoGeral) {
  if (!LIMITE_POR_EMPRESA_MS || LIMITE_POR_EMPRESA_MS <= 0) return novoPrazo_(Infinity);
  const resta = prazoGeral ? prazoGeral.restanteMs() : Infinity;
  return novoPrazo_(Math.min(resta, LIMITE_POR_EMPRESA_MS));
}

// =============================================================================
// RETRY COM BACKOFF — envolve toda operação instável (Drive, conversão, PDF)
// Tenta até 3 vezes: espera 2s, depois 5s. Registra cada tentativa no Logger.
// Para insistir até esgotar um prazo (em vez de um número fixo de tentativas),
// use comRetryAtePrazo_ logo abaixo.
// =============================================================================
function comRetry_(rotulo, fn, tentativas, esperasMs) {
  tentativas = tentativas || 3;
  esperasMs  = esperasMs  || [2000, 5000];
  let ultimoErro = null;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = fn();
      if (i > 0) Logger.log('[retry] ' + rotulo + ' — OK na tentativa ' + (i + 1));
      return r;
    } catch (e) {
      ultimoErro = e;
      Logger.log('[retry] ' + rotulo + ' — falhou na tentativa ' + (i + 1) + ': ' + e.message);
      if (i < tentativas - 1) Utilities.sleep(esperasMs[Math.min(i, esperasMs.length - 1)]);
    }
  }
  throw new Error('Falha após ' + tentativas + ' tentativas em "' + rotulo + '": ' +
                  (ultimoErro ? ultimoErro.message : 'erro desconhecido'));
}

// =============================================================================
// RETRY POR PRAZO — insiste na mesma operação enquanto sobrar tempo
// -----------------------------------------------------------------------------
// Diferente do comRetry_ (3 tentativas fixas), aqui a operação é repetida com
// backoff crescente, até MAX_TENTATIVAS_RETRY vezes: falha de rate limit do
// Drive, conversão que demora, arquivo travado — tudo isso costuma passar sozinho
// na tentativa seguinte. O limite é por TENTATIVAS, não por relógio, então não há
// trava de tempo na execução; só não gira infinito num erro permanente.
// Só desiste antes do prazo quando o erro é claramente definitivo (permissão,
// pasta inexistente, CNPJ que não está na planilha): insistir não resolveria.
// =============================================================================
function erroDefinitivo_(msg) {
  const m = String(msg || "").toLowerCase();
  return /não encontrad|nao encontrad|not found|no such|permiss|permission|acesso negado|access denied|unauthorized|inválid|invalid argument/.test(m);
}

function comRetryAtePrazo_(rotulo, fn, prazo, aoTentar) {
  let tentativa = 0, ultimoErro = null;
  while (true) {
    tentativa++;
    try {
      const r = fn();
      if (tentativa > 1) Logger.log('[prazo] ' + rotulo + ' — OK na tentativa ' + tentativa +
        ' (' + prazo.minutosDecorridos() + ' min de insistência)');
      return r;
    } catch (e) {
      ultimoErro = e;
      Logger.log('[prazo] ' + rotulo + ' — tentativa ' + tentativa + ' falhou: ' + e.message);
      if (erroDefinitivo_(e.message)) {
        throw new Error(rotulo + ' — erro definitivo, não adianta insistir: ' + e.message);
      }
      const espera = ESPERAS_BACKOFF_MS[Math.min(tentativa - 1, ESPERAS_BACKOFF_MS.length - 1)];
      if (tentativa >= MAX_TENTATIVAS_RETRY) {
        throw new Error('Falhou nas ' + tentativa + ' tentativas de "' + rotulo + '" (' +
                        prazo.minutosDecorridos() + ' min). Último erro: ' +
                        (ultimoErro ? ultimoErro.message : 'desconhecido'));
      }
      if (prazo.restanteMs() <= espera) {
        throw new Error('Prazo esgotado após ' + tentativa + ' tentativa(s) em "' + rotulo +
                        '" (' + prazo.minutosDecorridos() + ' min). Último erro: ' +
                        (ultimoErro ? ultimoErro.message : 'desconhecido'));
      }
      if (typeof aoTentar === "function") {
        try { aoTentar(tentativa, Math.round(espera / 1000), prazo.restanteTxt()); } catch (x) { }
      }
      Utilities.sleep(espera);
    }
  }
}

// =============================================================================
// TABELA OFICIAL DO SIMPLES NACIONAL — LC 123/2006, redação da LC 155/2016
//   nom = alíquota nominal da faixa
//   ded = parcela a deduzir
//   iss = % do DAS que corresponde ao ISS (Anexos III, IV e V)
// Fórmula legal (art. 18, §1º-A):
//   Alíquota Efetiva = ((RBT12 × nominal) − dedução) ÷ RBT12
// =============================================================================
const TABELAS_SN_ = {
  "Anexo I": [
    { max: 180000,   nom: 0.040, ded: 0,       iss: 0 },
    { max: 360000,   nom: 0.073, ded: 5940,    iss: 0 },
    { max: 720000,   nom: 0.095, ded: 13860,   iss: 0 },
    { max: 1800000,  nom: 0.107, ded: 22500,   iss: 0 },
    { max: 3600000,  nom: 0.143, ded: 87300,   iss: 0 },
    { max: 4800000,  nom: 0.190, ded: 378000,  iss: 0 }
  ],
  "Anexo II": [
    { max: 180000,   nom: 0.045, ded: 0,       iss: 0 },
    { max: 360000,   nom: 0.078, ded: 5940,    iss: 0 },
    { max: 720000,   nom: 0.100, ded: 13860,   iss: 0 },
    { max: 1800000,  nom: 0.112, ded: 22500,   iss: 0 },
    { max: 3600000,  nom: 0.147, ded: 85500,   iss: 0 },
    { max: 4800000,  nom: 0.300, ded: 720000,  iss: 0 }
  ],
  "Anexo III": [
    { max: 180000,   nom: 0.060, ded: 0,       iss: 0.335 },
    { max: 360000,   nom: 0.112, ded: 9360,    iss: 0.320 },
    { max: 720000,   nom: 0.135, ded: 17640,   iss: 0.325 },
    { max: 1800000,  nom: 0.160, ded: 35640,   iss: 0.325 },
    { max: 3600000,  nom: 0.210, ded: 125640,  iss: 0.335 },
    { max: 4800000,  nom: 0.330, ded: 648000,  iss: 0 }
  ],
  "Anexo IV": [
    { max: 180000,   nom: 0.045, ded: 0,       iss: 0.445 },
    { max: 360000,   nom: 0.090, ded: 8100,    iss: 0.400 },
    { max: 720000,   nom: 0.102, ded: 12420,   iss: 0.400 },
    { max: 1800000,  nom: 0.140, ded: 39780,   iss: 0.400 },
    { max: 3600000,  nom: 0.220, ded: 183780,  iss: 0.434 },
    { max: 4800000,  nom: 0.330, ded: 828000,  iss: 0 }
  ],
  "Anexo V": [
    { max: 180000,   nom: 0.155, ded: 0,       iss: 0.140 },
    { max: 360000,   nom: 0.180, ded: 4500,    iss: 0.170 },
    { max: 720000,   nom: 0.195, ded: 9900,    iss: 0.190 },
    { max: 1800000,  nom: 0.205, ded: 17100,   iss: 0.210 },
    { max: 3600000,  nom: 0.230, ded: 62100,   iss: 0.235 },
    { max: 4800000,  nom: 0.305, ded: 540000,  iss: 0 }
  ]
};
const SEM_ISS  = { "Anexo I": true, "Anexo II": true };
const TETO_ISS = 0.05;   // art. 18, §§ 16 e 16-A da LC 123/2006

// =============================================================================
// TABELA DE PARTILHA DOS ANEXOS I A V (LC 123/2006, Anexos I a V — colunas de
// repartição do DAS entre os tributos). Serve para medir quanto do DAS é
// composto por tributos IMUNES na exportação:
//   PIS/COFINS ... CF art. 149, § 2º, I
//   IPI ......... CF art. 153, § 3º, III
//   ICMS ........ CF art. 155, § 2º, X, "a"
//   ISS ......... LC 116/2003, art. 2º, I (e LC 123/2006, art. 18, § 14)
// Ficam devidos, mesmo na exportação: IRPJ, CSLL e CPP.
// Cada linha soma 100%. Conferido contra extrato real (Anexo V, 3ª faixa:
// IRPJ 24% + CSLL 15% + CPP 23,85% = 62,85% => imune 37,15%).
// =============================================================================
const PARTILHA_SN_ = {
  "Anexo I": [
    { irpj: 5.50,  csll: 3.50,  cofins: 12.74, pis: 2.76, cpp: 41.50, ipi: 0,     icms: 34.00, iss: 0 },
    { irpj: 5.50,  csll: 3.50,  cofins: 12.74, pis: 2.76, cpp: 41.50, ipi: 0,     icms: 34.00, iss: 0 },
    { irpj: 5.50,  csll: 3.50,  cofins: 12.74, pis: 2.76, cpp: 42.00, ipi: 0,     icms: 33.50, iss: 0 },
    { irpj: 5.50,  csll: 3.50,  cofins: 12.74, pis: 2.76, cpp: 42.00, ipi: 0,     icms: 33.50, iss: 0 },
    { irpj: 5.50,  csll: 3.50,  cofins: 12.74, pis: 2.76, cpp: 42.00, ipi: 0,     icms: 33.50, iss: 0 },
    { irpj: 13.50, csll: 10.00, cofins: 28.27, pis: 6.13, cpp: 42.10, ipi: 0,     icms: 0,     iss: 0 }
  ],
  "Anexo II": [
    { irpj: 5.50, csll: 3.50, cofins: 11.51, pis: 2.49, cpp: 37.50, ipi: 7.50,  icms: 32.00, iss: 0 },
    { irpj: 5.50, csll: 3.50, cofins: 11.51, pis: 2.49, cpp: 37.50, ipi: 7.50,  icms: 32.00, iss: 0 },
    { irpj: 5.50, csll: 3.50, cofins: 11.51, pis: 2.49, cpp: 37.50, ipi: 7.50,  icms: 32.00, iss: 0 },
    { irpj: 5.50, csll: 3.50, cofins: 11.51, pis: 2.49, cpp: 37.50, ipi: 7.50,  icms: 32.00, iss: 0 },
    { irpj: 5.50, csll: 3.50, cofins: 11.51, pis: 2.49, cpp: 37.50, ipi: 7.50,  icms: 32.00, iss: 0 },
    { irpj: 8.50, csll: 7.50, cofins: 20.96, pis: 4.54, cpp: 23.50, ipi: 35.00, icms: 0,     iss: 0 }
  ],
  "Anexo III": [
    { irpj: 4.00,  csll: 3.50,  cofins: 12.82, pis: 2.78, cpp: 43.40, ipi: 0, icms: 0, iss: 33.50 },
    { irpj: 4.00,  csll: 3.50,  cofins: 14.05, pis: 3.05, cpp: 43.40, ipi: 0, icms: 0, iss: 32.00 },
    { irpj: 4.00,  csll: 3.50,  cofins: 13.64, pis: 2.96, cpp: 43.40, ipi: 0, icms: 0, iss: 32.50 },
    { irpj: 4.00,  csll: 3.50,  cofins: 13.64, pis: 2.96, cpp: 43.40, ipi: 0, icms: 0, iss: 32.50 },
    { irpj: 4.00,  csll: 3.50,  cofins: 12.82, pis: 2.78, cpp: 43.40, ipi: 0, icms: 0, iss: 33.50 },
    { irpj: 35.00, csll: 15.00, cofins: 16.03, pis: 3.47, cpp: 30.50, ipi: 0, icms: 0, iss: 0 }
  ],
  "Anexo IV": [
    { irpj: 18.80, csll: 15.20, cofins: 17.67, pis: 3.83, cpp: 0, ipi: 0, icms: 0, iss: 44.50 },
    { irpj: 19.80, csll: 15.20, cofins: 20.55, pis: 4.45, cpp: 0, ipi: 0, icms: 0, iss: 40.00 },
    { irpj: 20.80, csll: 15.20, cofins: 19.73, pis: 4.27, cpp: 0, ipi: 0, icms: 0, iss: 40.00 },
    { irpj: 17.80, csll: 19.20, cofins: 18.90, pis: 4.10, cpp: 0, ipi: 0, icms: 0, iss: 40.00 },
    { irpj: 18.80, csll: 19.20, cofins: 18.08, pis: 3.92, cpp: 0, ipi: 0, icms: 0, iss: 40.00 },
    { irpj: 53.50, csll: 21.50, cofins: 20.55, pis: 4.45, cpp: 0, ipi: 0, icms: 0, iss: 0 }
  ],
  "Anexo V": [
    { irpj: 25.00, csll: 15.00, cofins: 14.10, pis: 3.05, cpp: 28.85, ipi: 0, icms: 0, iss: 14.00 },
    { irpj: 23.00, csll: 15.00, cofins: 14.10, pis: 3.05, cpp: 27.85, ipi: 0, icms: 0, iss: 17.00 },
    { irpj: 24.00, csll: 15.00, cofins: 14.10, pis: 3.05, cpp: 23.85, ipi: 0, icms: 0, iss: 20.00 },
    { irpj: 21.00, csll: 15.00, cofins: 14.10, pis: 3.05, cpp: 23.85, ipi: 0, icms: 0, iss: 23.00 },
    { irpj: 23.00, csll: 12.50, cofins: 14.10, pis: 3.05, cpp: 23.85, ipi: 0, icms: 0, iss: 23.50 },
    { irpj: 35.00, csll: 15.50, cofins: 16.44, pis: 3.56, cpp: 29.50, ipi: 0, icms: 0, iss: 0 }
  ]
};

// % do DAS que é IMUNE quando a receita é de EXPORTAÇÃO.
function percImuneExportacao_(romano, faixa) {
  const tab = PARTILHA_SN_["Anexo " + String(romano).toUpperCase()];
  if (!tab) return 0;
  const f = tab[Number(faixa) - 1];
  if (!f) return 0;
  return (f.cofins + f.pis + f.ipi + f.icms + f.iss) / 100;
}

// % do DAS que é ICMS na tabela de partilha (só existe nos Anexos I e II —
// nos demais o ICMS não compõe o DAS). Usada para descontar a alíquota cheia
// quando a empresa tem imunidade/isenção permanente de ICMS (ex.: livros e
// bíblias, CF art. 150, VI, "d") — coluna "Imunidade de ICMS" (01/09/2026).
function percIcmsPartilha_(romano, faixa) {
  const tab = PARTILHA_SN_["Anexo " + String(romano).toUpperCase()];
  if (!tab) return 0;
  const f = tab[Number(faixa) - 1];
  if (!f) return 0;
  return (f.icms || 0) / 100;
}

// % do DAS que é PIS + COFINS na tabela de partilha (LC 123/2006). Usada para
// montar a Alíquota Efetiva Híbrida 2027 POR ALÍQUOTA quando a empresa não tem
// faturamento no período: sem DAS não há PIS nem COFINS em R$ no extrato, e o
// percentual tem de vir da própria tabela (coluna K da aba "Parâmetros").
function percPisCofinsPartilha_(romano, faixa) {
  const tab = PARTILHA_SN_["Anexo " + String(romano).toUpperCase()];
  if (!tab) return 0;
  const f = tab[Number(faixa) - 1];
  if (!f) return 0;
  return ((f.cofins || 0) + (f.pis || 0)) / 100;
}

// =============================================================================
// ART. 127 DA LC 214/2025 — PROFISSÕES INTELECTUAIS E O REQUISITO CUMULATIVO
// -----------------------------------------------------------------------------
// A redução de 30% do art. 127 (cClassTrib 200052) NÃO é automática: depende de
// requisitos CUMULATIVOS. Um deles é a sociedade não exercer atividade DIVERSA
// da habilitação profissional dos sócios (outro é não ter pessoa jurídica no
// quadro societário — esse não é aferível pelo CNAE e fica para conferência
// manual). Basta UM CNAE fora da habilitação para a redução cair a zero.
//
// Como a habilitação é aferida aqui: pelos ITENS da Lista de Serviços que a
// Receita vincula a cada CNAE. Um CNAE só é INERENTE à habilitação se tiver ao
// menos um item da MESMA família profissional que concede a redução. Exemplos
// reais da carteira:
//   • 7119-7/03 (desenho técnico) -> item 32.01 ....... NÃO é engenharia
//   • 7020-4/00 (consultoria em gestão) -> 17.01/17.03/17.17/17.20/35.01 .. não
//   • 8219-9/99 (apoio administrativo) -> 17.02 ....... não
//   • 8599-6/04 (treinamento gerencial) -> 08.02 ..... não
// Logo, engenharia + qualquer um desses = redução 0%.
//
// Para liberar um CNAE que você entenda inerente à habilitação (ex.: perícia de
// segurança do trabalho feita por engenheiro), acrescente-o em
// CNAES_INERENTES_EXTRA_ — a lista nasce vazia de propósito.
// =============================================================================
const ITENS_ART127_ = {
  "07.01": "ENGENHARIA, AGRONOMIA, ARQUITETURA E URBANISMO (CREA/CAU)",
  "07.03": "ENGENHARIA, AGRONOMIA, ARQUITETURA E URBANISMO (CREA/CAU)",
  "07.19": "ENGENHARIA, AGRONOMIA, ARQUITETURA E URBANISMO (CREA/CAU)",
  "07.20": "ENGENHARIA, AGRONOMIA, ARQUITETURA E URBANISMO (CREA/CAU)",
  "31.01": "ENGENHARIA, AGRONOMIA, ARQUITETURA E URBANISMO (CREA/CAU)",
  "05.01": "MEDICINA VETERINÁRIA E ZOOTECNIA (CRMV)",
  "05.03": "MEDICINA VETERINÁRIA E ZOOTECNIA (CRMV)",
  "05.04": "MEDICINA VETERINÁRIA E ZOOTECNIA (CRMV)",
  "17.16": "CONTABILIDADE E AUDITORIA (CRC)",
  "17.19": "CONTABILIDADE E AUDITORIA (CRC)",
  "17.14": "ADVOCACIA (OAB)",
  "17.20": "ECONOMIA — CONSULTORIA E ASSESSORIA FINANCEIRA (CORECON)",
  "17.21": "ESTATÍSTICA",
  "27.01": "ASSISTÊNCIA SOCIAL",
  "29.01": "BIBLIOTECONOMIA",
  "30.01": "BIOLOGIA, BIOTECNOLOGIA E QUÍMICA"
};

// CNAEs que você considera inerentes a uma habilitação mesmo sem item da
// família. Formato: { "7120-1/00": "ENGENHARIA, AGRONOMIA, ARQUITETURA E URBANISMO (CREA/CAU)" }
const CNAES_INERENTES_EXTRA_ = {};

const FUND_ART127_ = "Art. 127 da LC 214/2025: a redução de 30% das profissões intelectuais é " +
  "condicionada a requisitos CUMULATIVOS, entre eles o de a sociedade não exercer atividade " +
  "DIVERSA da habilitação profissional dos sócios (e não ter pessoa jurídica no quadro " +
  "societário). Havendo CNAE fora da habilitação, a redução deixa de ser aplicável e a " +
  "atividade volta à alíquota padrão de IBS/CBS.";

// Tokens usados nas fórmulas (SEARCH) — mudar o texto sem mudar o token não quebra nada.
const TOKEN_127_ZERADA  = "ZERADA";
const TOKEN_127_OK      = "MANTIDA";
const REQ127_NAO_APLICA = "— não se aplica";
const REQ127_OK         = "✔ MANTIDA — todos os CNAEs são da habilitação";
const REQ127_ZERADA     = "✖ ZERADA — atividade diversa da habilitação";

function familiaArt127_(item) {
  return ITENS_ART127_[chaveItem_(item)] || "";
}

// -----------------------------------------------------------------------------
// Aplica o requisito do art. 127 sobre as linhas da Correlação (array de arrays
// no layout de HEADERS_CORRELACAO, ainda com 14 colunas). Devolve as linhas com
// as 4 colunas do art. 127 preenchidas, além da lista de índices a marcar de
// amarelo e um resumo para o alerta.
// -----------------------------------------------------------------------------
function aplicarArt127_(linhas) {
  const itensPorCnpjCnae = {};   // "cnpj||cnae" -> { familia: true }
  const familiasPorCnpj  = {};   // cnpj -> { familia: true }
  const cnaesPorCnpj     = {};   // cnpj -> { cnae: true }
  for (let i = 0; i < linhas.length; i++) {
    const cnpj = String(linhas[i][COR_IX.cnpj]), cnae = String(linhas[i][COR_IX.cnae]);
    const item = String(linhas[i][COR_IX.item]).replace(/^'/, "");
    const k = cnpj + "||" + cnae;
    if (!cnaesPorCnpj[cnpj]) cnaesPorCnpj[cnpj] = {};
    cnaesPorCnpj[cnpj][cnae] = true;
    if (!itensPorCnpjCnae[k]) itensPorCnpjCnae[k] = {};
    let fam = familiaArt127_(item);
    if (!fam && CNAES_INERENTES_EXTRA_[cnae]) fam = CNAES_INERENTES_EXTRA_[cnae];
    if (fam) {
      itensPorCnpjCnae[k][fam] = true;
      if (!familiasPorCnpj[cnpj]) familiasPorCnpj[cnpj] = {};
      familiasPorCnpj[cnpj][fam] = true;
    }
  }
  // uma família só é preservada se TODOS os CNAEs do CNPJ tiverem item dela
  const foraPorFamilia = {};     // "cnpj||familia" -> array de CNAEs fora
  Object.keys(familiasPorCnpj).forEach(function (cnpj) {
    Object.keys(familiasPorCnpj[cnpj]).forEach(function (fam) {
      const fora = Object.keys(cnaesPorCnpj[cnpj]).filter(function (c) {
        const inerente = CNAES_INERENTES_EXTRA_[c] === fam;
        return !inerente && !(itensPorCnpjCnae[cnpj + "||" + c] || {})[fam];
      }).sort();
      foraPorFamilia[cnpj + "||" + fam] = fora;
    });
  });

  const amarelas = [];
  let zerados = 0;
  const cnpjsZerados = {};
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    const cnpj = String(l[COR_IX.cnpj]);
    const item = String(l[COR_IX.item]).replace(/^'/, "");
    const fam = familiaArt127_(item);
    const redOriginal = Number(l[COR_IX.red]) || 0;
    l[COR_IX.redOrig] = redOriginal;
    if (!fam) {
      l[COR_IX.req127] = REQ127_NAO_APLICA;
      l[COR_IX.fora127] = "—";
      l[COR_IX.habil] = "—";
      continue;
    }
    const fora = foraPorFamilia[cnpj + "||" + fam] || [];
    l[COR_IX.habil] = fam;
    if (fora.length === 0) {
      l[COR_IX.req127] = REQ127_OK;
      l[COR_IX.fora127] = "— (nenhum)";
    } else {
      l[COR_IX.red] = 0;
      l[COR_IX.fund] = FUND_ART127_;
      l[COR_IX.req127] = REQ127_ZERADA;
      l[COR_IX.fora127] = fora.join(", ");
      if (redOriginal > 0) { amarelas.push(i); zerados++; cnpjsZerados[cnpj] = true; }
    }
  }
  return { linhas: linhas, amarelas: amarelas, zerados: zerados,
           cnpjs: Object.keys(cnpjsZerados).length };
}

const ORDEM_ANEXOS_ = ["I", "II", "III", "IV", "V"];

// Resolve cadastros multi-anexo ("III/V" -> "III") e normaliza o romano.
function anexoApurado_(textoAnexo) {
  let a = String(textoAnexo == null ? "" : textoAnexo).trim().toUpperCase();
  if (a.indexOf("/") >= 0) a = a.split("/")[0].trim();
  return a;
}

// Faixa (1..6) + Alíquota Efetiva Cheia + Alíquota de ISS destacada na NF.
// rbt12Base já deve vir resolvida (RBT12p quando aplicável).
function calcularAliquotaCheiaSN_(anexoRomano, rbt12Base) {
  const romano = anexoApurado_(anexoRomano);
  const chave  = "Anexo " + romano;
  const tabela = TABELAS_SN_[chave];
  const base   = Number(rbt12Base) || 0;
  if (!tabela || base <= 0) return { faixa: "", aliqCheia: "", aliqISS: "" };
  for (let i = 0; i < tabela.length; i++) {
    if (base <= tabela[i].max) {
      const f = tabela[i];
      const aliqCheia = ((base * f.nom) - f.ded) / base;
      let aliqISS;
      if (SEM_ISS[chave])   aliqISS = "NÃO POSSUI";
      else if (f.iss === 0) aliqISS = "NÃO DESTACADO";   // 6ª faixa: ISS sai do DAS
      else                  aliqISS = Math.min(aliqCheia * f.iss, TETO_ISS);
      return { faixa: i + 1, aliqCheia: aliqCheia, aliqISS: aliqISS };
    }
  }
  return { faixa: "EXCEDEU LIMITE", aliqCheia: "EXCEDEU LIMITE", aliqISS: "EXCEDEU LIMITE" };
}

// =============================================================================
// HELPERS GERAIS
// =============================================================================
function normalizar(texto)      { return String(texto).replace(/\D/g, ""); }

// Chave do Item da Lista preservando sufixos de variante (ex.: "17.12-G").
// NÃO usar normalizar() aqui: ele apagaria o sufixo e faria "17.12" e "17.12-G"
// colidirem na mesma chave.
function chaveItem_(texto) {
  return String(texto == null ? "" : texto).replace(/^'/, "").replace(/\s+/g, "").toUpperCase();
}

// 7 dígitos do CNAE principal (1º CNAE do cadastro), completando à direita.
function cnaePrincipalDigitos_(textoCnaes) {
  const tok = String(textoCnaes == null ? "" : textoCnaes).replace(/\n/g, ",").split(",")[0];
  const dig = tok.replace(/\D/g, "");
  return dig === "" ? "" : (dig + "0000000").substring(0, 7);
}
function extrairRaizCNAE(texto) { return normalizar(texto).substring(0, 5); }

function formatarCNAE(texto) {
  const num = normalizar(texto).padEnd(7, "0").substring(0, 7);
  return num.replace(/^(\d{4})(\d)(\d{2})$/, "$1-$2/$3");
}

function chaveTexto_(texto) {
  return String(texto == null ? "" : texto)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

function acharColuna(headers, chaves) {
  for (const c of chaves) {
    const alvo = chaveTexto_(c);
    const idx = headers.findIndex(h => chaveTexto_(h).includes(alvo));
    if (idx !== -1) return idx;
  }
  return -1;
}

function buscarIndiceColuna(headers, nome) {
  const alvo = chaveTexto_(nome);
  return headers.findIndex(h => chaveTexto_(h).includes(alvo));
}

// =============================================================================
// LEITURA DA RBT12 PROPORCIONALIZADA (RBT12p)
// No extrato o rótulo quebra em DUAS linhas e os valores ficam na PRIMEIRA:
//     Receita bruta acumulada nos doze meses anteriores ao PA   X   Y   Z
//     proporcionalizada (RBT12p)
// Quando não se aplica, a primeira linha vem sem número nenhum. Regex do tipo
// /proporcionalizada[\s\S]{0,80}?(numero)/ capturavam a linha SEGUINTE (a RBA)
// e gravavam uma RBT12p falsa — por isso a leitura aqui é ancorada em linha.
// Devolve o TOTAL (interno + externo) ou 0 quando o campo está vazio.
// =============================================================================
function lerRBT12p_(texto) {
  const linhas = String(texto == null ? "" : texto).split(/\r?\n/);
  const NUM = /[\d\.]+,\d{2}/g;
  function totalDaLinha(linha) {
    const nums = (linha || "").match(NUM);
    if (!nums || nums.length === 0) return 0;
    const v = nums.map(parseMoney_IBSCBS);
    if (v.length >= 3 && Math.abs((v[0] + v[1]) - v[2]) <= 0.02) return v[2];
    return v[v.length - 1];
  }
  for (let l = 0; l < linhas.length; l++) {
    if (!/proporcionaliza/i.test(linhas[l])) continue;
    // 1) valores na própria linha do rótulo
    let t = totalDaLinha(linhas[l]);
    if (t > 0) return t;
    // 2) rótulo quebrado: valores na linha anterior, que precisa ser a
    //    continuação do mesmo rótulo ("...anteriores ao PA")
    if (l > 0 && /anteriores\s*ao\s*PA/i.test(linhas[l - 1])) {
      t = totalDaLinha(linhas[l - 1]);
      if (t > 0) return t;
    }
    return 0;   // rótulo achado e sem valor => campo vazio no extrato
  }
  return 0;
}

function getColunaLetra(index) {   // index 1-based
  let letter = '', i = index - 1;
  while (i >= 0) { letter = String.fromCharCode((i % 26) + 65) + letter; i = Math.floor(i / 26) - 1; }
  return letter;
}

// =============================================================================
// LEITURA DE RECEITAS POR MERCADO (Discriminativo de Receitas do PGDAS-D)
// O extrato traz TRÊS colunas: Mercado Interno | Mercado Externo | Total.
// A leitura antiga pegava só o primeiro número da linha — que para uma empresa
// exportadora é o Mercado Interno, muitas vezes 0,00 — e por isso o RPA e o
// RBT12 voltavam zerados. Aqui lemos os três e conferimos se interno + externo
// fecha com o total (tolerância de 2 centavos por causa do arredondamento).
// Layouts antigos com 2 ou 1 valor continuam funcionando pelos fallbacks.
// Devolve { interno, externo, total, colunas }.
// =============================================================================
function lerReceitasMercado_(texto, rotulos) {
  const txt = String(texto == null ? "" : texto);
  const NUM = /[\d\.]+,\d{2}/g;
  const temExterno = /Mercado\s*Externo/i.test(txt);
  const vazio = { interno: 0, externo: 0, total: 0, colunas: 0 };

  function montar(nums) {
    const v = nums.map(parseMoney_IBSCBS);
    if (v.length >= 3) {
      const a = v[0], b = v[1], c = v[2];
      // Interno | Externo | Total
      if (Math.abs((a + b) - c) <= 0.02) return { interno: a, externo: b, total: c, colunas: 3 };
      // não fecha: usa o último como total (é a coluna Total do extrato)
      const t = v[v.length - 1];
      return { interno: temExterno ? a : t, externo: temExterno ? Math.max(t - a, 0) : 0, total: t, colunas: 3 };
    }
    if (v.length === 2) {
      const a = v[0], b = v[1];
      // Interno | Total (sem mercado externo): os dois valores são iguais
      if (Math.abs(a - b) <= 0.02) return { interno: a, externo: 0, total: a, colunas: 2 };
      // Externo | Total quando o interno é 0,00 e não foi impresso
      if (temExterno && b > a) return { interno: Math.max(b - a, 0), externo: a, total: b, colunas: 2 };
      return { interno: a, externo: 0, total: a, colunas: 2 };
    }
    if (v.length === 1) return { interno: v[0], externo: 0, total: v[0], colunas: 1 };
    return null;
  }

  // --- 1ª tentativa: por LINHA (mais seguro; não invade a linha seguinte)
  const linhas = txt.split(/\r?\n/);
  for (let r = 0; r < rotulos.length; r++) {
    let re;
    try { re = new RegExp("^\\s*(?:\\d+(?:\\.\\d+)*\\)?\\s*)?" + rotulos[r], "i"); }
    catch (e) { continue; }
    for (let l = 0; l < linhas.length; l++) {
      if (!re.test(linhas[l])) continue;
      const nums = linhas[l].match(NUM);
      if (!nums || nums.length === 0) continue;   // rótulo quebrado em 2 linhas
      const out = montar(nums);
      if (out && out.total > 0) return out;
    }
  }

  // --- 2ª tentativa: regex livre (para extratos sem quebra de linha preservada)
  const M = "([\\d\\.]+,\\d{2})";
  for (let r = 0; r < rotulos.length; r++) {
    let m = null;
    try { m = txt.match(new RegExp(rotulos[r] + "[\\s\\S]{0,40}?" + M + "\\s+" + M + "\\s+" + M, "i")); }
    catch (e) { m = null; }
    if (m) {
      const out = montar([m[1], m[2], m[3]]);
      if (out && out.total > 0) return out;
    }
  }
  for (let r = 0; r < rotulos.length; r++) {
    let m = null;
    try { m = txt.match(new RegExp(rotulos[r] + "[\\s\\S]{0,60}?" + M, "i")); }
    catch (e) { m = null; }
    if (m) {
      const v = parseMoney_IBSCBS(m[1]);
      if (v > 0) return { interno: v, externo: 0, total: v, colunas: 1 };
    }
  }
  return vazio;
}

function parseMoney_IBSCBS(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
}

function parseMonetario_(valor) {
  if (typeof valor === "number") return valor;
  if (typeof valor === "string") {
    const limpo = valor.replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", ".").trim();
    const num = parseFloat(limpo);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// Percentual no padrão brasileiro: 9,07%
function pctBR_(x, casas) {
  if (typeof x === "string" && x !== "") return x;          // "NÃO POSSUI", "EXCEDEU LIMITE"...
  casas = (casas === undefined) ? 2 : casas;
  return ((Number(x) || 0) * 100).toFixed(casas).replace(".", ",") + "%";
}
function ppBR_(x) {
  const v = (Number(x) || 0) * 100;
  return (v >= 0 ? "+" : "") + v.toFixed(2).replace(".", ",") + " p.p.";
}
function reaisBR_(v) {
  const p = (Number(v) || 0).toFixed(2).split(".");
  return "R$ " + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + p[1];
}

function validarIndicesColunas(mapaIndices) {
  const faltando = Object.entries(mapaIndices).filter(([, idx]) => idx === -1).map(([nome]) => nome);
  if (faltando.length > 0) throw new Error("Coluna(s) não encontrada(s) no cabeçalho: " + faltando.join(", "));
}

// Mapeia índices (0-based) das colunas da aba "Simples Nacional".
function mapearColunas_SN_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return {
    cnpj:          buscarIndiceColuna(headers, "CNPJ"),
    empresa:       buscarIndiceColuna(headers, "Razão Social"),
    cnaes:         buscarIndiceColuna(headers, "CNAEs"),
    anexo:         buscarIndiceColuna(headers, "Anexo do Simples"),
    rbt12:         buscarIndiceColuna(headers, "RBT12"),
    fatorR:        buscarIndiceColuna(headers, "Fator R"),
    aliqEfetiva:   buscarIndiceColuna(headers, "Alíquota Efetiva Atual"),
    valorDas:      buscarIndiceColuna(headers, "Valor no DAS"),
    faturamento:   buscarIndiceColuna(headers, "Faturamento"),
    cbsFora:       buscarIndiceColuna(headers, "CBS Devido"),
    ibsFora:       buscarIndiceColuna(headers, "IBS Devido"),
    aliqHibrida:   buscarIndiceColuna(headers, "Hibrida 2027"),
    status:        buscarIndiceColuna(headers, "Status"),
    selecionar:    buscarIndiceColuna(headers, "SELECIONAR"),
    percPisCofins: buscarIndiceColuna(headers, "% PIS+COFINS sobre"),
    pis:           buscarIndiceColuna(headers, "PIS no DAS"),
    cofins:        buscarIndiceColuna(headers, "COFINS no DAS"),
    dasLiquido:    buscarIndiceColuna(headers, "DAS sem PIS"),
    reducao:       buscarIndiceColuna(headers, "Redução da Atividade"),
    dasHibrido:    buscarIndiceColuna(headers, "DAS Híbrido"),
    diferenca:     buscarIndiceColuna(headers, "Diferença Híbrido"),
    faixaRbt12:    buscarIndiceColuna(headers, "Faixa RBT12"),
    aliqCheia:     buscarIndiceColuna(headers, "Aliquota Efetiva Cheia"),
    issReais:      buscarIndiceColuna(headers, "ISS não recolhido"),
    rbt12p:        buscarIndiceColuna(headers, "RBT12p"),
    dataAbertura:  buscarIndiceColuna(headers, "Data de Abertura"),
    rbt12Base:     buscarIndiceColuna(headers, "RBT12 Base"),
    aliqISS:       buscarIndiceColuna(headers, "Aliquota ISS destacada"),
    anexoApurado:  buscarIndiceColuna(headers, "Anexo Apurado"),
    cnaePrincipal: buscarIndiceColuna(headers, "CNAE Principal"),
    issFora:       buscarIndiceColuna(headers, "ISS fora do DAS"),
    aliqTotal:     buscarIndiceColuna(headers, "Aliquota Efetiva Total Atual"),
    recInterna:    buscarIndiceColuna(headers, "Receita Mercado Interno"),
    recExterna:    buscarIndiceColuna(headers, "Receita Mercado Externo"),
    percExport:    buscarIndiceColuna(headers, "% de Exportacao"),
    rbt12Interno:  buscarIndiceColuna(headers, "RBT12 Mercado Interno"),
    rbt12Externo:  buscarIndiceColuna(headers, "RBT12 Mercado Externo"),
    percImune:     buscarIndiceColuna(headers, "% do DAS Imune na Exportacao"),
    aliqAjustada:  buscarIndiceColuna(headers, "Aliquota Efetiva Atual Ajustada"),
    habilitacao:   buscarIndiceColuna(headers, "Habilitacao Profissional"),
    redOriginal:   buscarIndiceColuna(headers, "Reducao Original do Item Predominante"),
    requisito127:  buscarIndiceColuna(headers, "Requisito do art. 127"),
    foraHabilit:   buscarIndiceColuna(headers, "CNAEs fora da habilitacao"),
    segmento:      buscarIndiceColuna(headers, "Segmento (modelo do Comunicado)"),
    // --- imunidade de ICMS (coluna opcional — nova, 01/09/2026). Se a coluna
    // não existir na aba, fica -1 e todo o código que a usa é ignorado (veja os
    // "if (ix.icmsImune > -1)" e o "temIcms" em formulasCalculadas_).
    icmsImune:     buscarIndiceColuna(headers, "Imunidade de ICMS"),
    // --- link do extrato usado no cálculo (coluna opcional — 02/09/2026)
    linkExtrato:   buscarIndiceColuna(headers, "Extrato usado"),
    // --- anexo declarado no próprio extrato (coluna opcional — 02/09/2026)
    anexoExtrato:  buscarIndiceColuna(headers, "Anexo no Extrato")
  };
}

// =============================================================================
// 0. SETUP — ESTRUTURA DAS ABAS E INJEÇÃO DAS BASES
// =============================================================================
// As bases abaixo são as mesmas que já estão na planilha entregue
// ("Simulador da Reforma SN 2027 - ESTRUTURADO"): 803 correlações CNAE × Item da
// Lista e 66 itens com NBS, redução setorial e fundamento legal.
// O Setup NUNCA sobrescreve dados já existentes — se a aba já tiver linhas, a
// injeção é pulada e o Setup só normaliza cabeçalhos e formatos.

// Base CNAE x Item da Lista de Serviços — 803 pares, 534 CNAEs, 110 com mais de um item.
// Fonte: Cnae_X_Item_Lista_Servicos (Receita Federal).
// CNAE | Descrição do CNAE | Item da Lista | Descrição do Item | Item predominante (S/N)
// "Item predominante" = o item de que sai a redução quando este CNAE é o CNAE PRINCIPAL
// da empresa. Default = o item de maior redução do CNAE. Nos 110 CNAEs com mais de um
// item, mova o "S" de linha se o item efetivamente prestado for outro.
// O item "17.12-G" é a variante de gestão de negócios/hospitalar (sem redução);
// o "17.12" puro é a variante imobiliária (com redução) — ver nota no Banco_Dados.
const DADOS_CNAE_BASE = [
    ["0161-0/01", "Serviço de pulverização e controle de pragas agrícolas", "07.13", "Dedetização, desinfecção, desinsetização, imunização...", "S"],
    ["0161-0/03", "SERVICO DE PREPARACAO DE TERRENO, CULTIVO E COLHEITA", "07.16", "Florestamento, reflorestamento, semeadura, adubação e congêneres.", "S"],
    ["0162-8/01", "Serviço de inseminação artificial em animais", "05.04", "Inseminação artificial, fertilização in vitro e congêneres (veterinária).", "S"],
    ["0162-8/02", "SERVICO DE TOSQUIAMENTO DE OVINOS", "05.08", "Guarda, tratamento, amestramento, embelezamento, alojamento (animais).", "S"],
    ["0162-8/03", "SERVICO DE MANEJO DE ANIMAIS", "05.08", "Guarda, tratamento, amestramento, embelezamento, alojamento (animais).", "S"],
    ["0162-8/99", "ATIVIDADES DE APOIO A PECUARIA NAO ESPECIFICADAS ANTERIORMENTE", "05.08", "Guarda, tratamento, amestramento, embelezamento, alojamento (animais).", "S"],
    ["0162-8/99", "ATIVIDADES DE APOIO A PECUARIA NAO ESPECIFICADAS ANTERIORMENTE", "07.13", "Dedetização, desinfecção, desinsetização, imunização...", "N"],
    ["0162-8/99", "ATIVIDADES DE APOIO A PECUARIA NAO ESPECIFICADAS ANTERIORMENTE", "17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "N"],
    ["0220-9/06", "Conservação de florestas nativas", "07.16", "Florestamento, reflorestamento, semeadura, adubação e congêneres.", "S"],
    ["0230-6/00", "Atividades de apoio à produção florestal", "07.16", "Florestamento, reflorestamento, semeadura, adubação e congêneres.", "S"],
    ["0311-6/04", "ATIVIDADES DE APOIO A PESCA EM AGUA SALGADA", "17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "S"],
    ["0311-6/04", "ATIVIDADES DE APOIO A PESCA EM AGUA SALGADA", "20.01", "Serviços portuários...", "N"],
    ["0312-4/04", "ATIVIDADES DE APOIO A PESCA EM AGUA DOCE", "17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "S"],
    ["0312-4/04", "ATIVIDADES DE APOIO A PESCA EM AGUA DOCE", "20.01", "Serviços portuários...", "N"],
    ["0321-3/05", "ATIVIDADES DE APOIO A AQUICULTURA EM AGUA SALGADA E SALOBRA", "17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "S"],
    ["0321-3/05", "ATIVIDADES DE APOIO A AQUICULTURA EM AGUA SALGADA E SALOBRA", "20.01", "Serviços portuários...", "N"],
    ["0322-1/07", "Atividades de apoio à aquicultura em água doce", "17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "S"],
    ["0910-6/00", "Atividades de apoio à extração de petróleo e gás natural", "07.21", "Pesquisa, perfuração, cimentação, mergulho, perfilagem...", "S"],
    ["0990-4/01", "ATIVIDADES DE APOIO A EXTRACAO DE MINERIO DE FERRO", "07.21", "Pesquisa, perfuração, cimentação, mergulho, perfilagem...", "S"],
    ["0990-4/02", "ATIVIDADES DE APOIO A EXTRACAO DE MINERAIS METÁLICOS NÃO-FERROSOS", "07.21", "Pesquisa, perfuração, cimentação, mergulho, perfilagem...", "S"],
    ["0990-4/03", "ATIVIDADES DE APOIO À EXTRAÇÃO DE MINERAIS NÃO-METÁLICOS", "07.21", "Pesquisa, perfuração, cimentação, mergulho, perfilagem...", "S"],
    ["1340-5/01", "ESTAMPARIA E TEXTURIZACAO EM FIOS, TECIDOS, ARTEFATOS TEXTEIS E PECAS DO VESTUARIO", "14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "S"],
    ["1340-5/02", "Alvejamento, tingimento e torção em fios, tecidos, artefatos têxteis e peças do vestuário", "14.10", "Tinturaria e lavanderia.", "S"],
    ["1340-5/99", "Outros serviços de acabamento em fios, tecidos, artefatos têxteis e peças do vestuário", "14.09", "Alfaiataria e costura, quando o material for fornecido pelo usuário final...", "S"],
    ["1340-5/99", "Outros serviços de acabamento em fios, tecidos, artefatos têxteis e peças do vestuário", "14.10", "Tinturaria e lavanderia.", "N"],
    ["1411-8/02", "Facção de roupas íntimas", "14.09", "Alfaiataria e costura, quando o material for fornecido pelo usuário final...", "S"],
    ["1412-6/02", "Confecção, sob medida, de peças do vestuário, exceto roupas íntimas", "14.09", "Alfaiataria e costura, quando o material for fornecido pelo usuário final...", "S"],
    ["1412-6/03", "Facção de peças do vestuário, exceto roupas íntimas", "14.09", "Alfaiataria e costura, quando o material for fornecido pelo usuário final...", "S"],
    ["1413-4/01", "CONFECCAO DE ROUPAS PROFISSIONAIS, EXCETO SOB MEDIDA", "14.09", "Alfaiataria e costura, quando o material for fornecido pelo usuário final...", "S"],
    ["1413-4/02", "Confecção, sob medida, de roupas profissionais", "14.09", "Alfaiataria e costura, quando o material for fornecido pelo usuário final...", "S"],
    ["1413-4/03", "Facção de roupas profissionais", "14.09", "Alfaiataria e costura, quando o material for fornecido pelo usuário final...", "S"],
    ["1531-9/02", "Acabamento de calçados de couro sob contrato", "14.09", "Alfaiataria e costura, quando o material for fornecido pelo usuário final...", "S"],
    ["1622-6/99", "Fabricação de outros artigos de carpintaria para construção", "14.13", "Carpintaria e serralheria.", "S"],
    ["1629-3/01", "Fabricação de artefatos diversos de madeira, exceto móveis", "14.07", "Colocação de molduras e congêneres.", "S"],
    ["1741-9/01", "Fabricação de formulários contínuos", "13.05", "Composição gráfica, fotocomposição, clicheria.", "S"],
    ["1811-3/01", "Impressão de jornais", "13.05", "Composição gráfica, fotocomposição, clicheria.", "S"],
    ["1811-3/02", "Impressão de livros, revistas e outras publicações periódicas", "13.05", "Composição gráfica, fotocomposição, clicheria.", "S"],
    ["1812-1/00", "Impressão de material de segurança", "13.05", "Composição gráfica, fotocomposição, clicheria.", "S"],
    ["1813-0/01", "Impressão de material para uso publicitário", "13.05", "Composição gráfica, fotocomposição, clicheria.", "S"],
    ["1813-0/99", "Impressão de material para outros usos", "13.05", "Composição gráfica, fotocomposição, clicheria.", "S"],
    ["1821-1/00", "Serviços de pré-impressão", "13.05", "Composição gráfica, fotocomposição, clicheria.", "S"],
    ["1822-9/01", "Serviços de encadernação e plastificação", "13.05", "Composição gráfica, fotocomposição, clicheria.", "S"],
    ["1822-9/99", "Serviços de acabamentos gráficos, exceto encadernação e plastificação", "14.08", "Encadernação, gravação e douração de livros, revistas e congêneres.", "S"],
    ["1830-0/01", "REPRODUCAO DE SOM EM QUALQUER SUPORTE", "13.02", "Fonografia ou gravação de sons, inclusive trucagem.", "S"],
    ["1830-0/02", "REPRODUCAO DE VIDEO EM QUALQUER SUPORTE", "13.03", "Fotografia e cinematografia, inclusive revelação.", "S"],
    ["1830-0/03", "REPRODUCAO DE SOFTWARE EM QUALQUER SUPORTE", "01.03", "Processamento, Armazenamento Ou Hospedagem De Dados.", "S"],
    ["2212-9/00", "Reforma de pneumáticos usados", "14.04", "Recauchutagem ou regeneração de pneus.", "S"],
    ["2330-3/05", "PREPARAÇÃO DE MASSA DE CONCRETO E AGAMASSA PARA CONSTRUÇÃO", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["2391-5/01", "BRITAMENTO DE PEDRAS, EXCETO ASSOCIADO À EXTRAÇÃO", "07.01", "Engenharia, Agronomia, Arquitetura, Urbanismo.", "S"],
    ["2391-5/01", "BRITAMENTO DE PEDRAS, EXCETO ASSOCIADO À EXTRAÇÃO", "14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "N"],
    ["2391-5/02", "APARELHAMENTO DE PEDRAS PARA CONSTRUÇÃO, EXCETO ASSOCIADO À EXTRAÇÃO", "14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "S"],
    ["2391-5/03", "APARELHMANTO DE PLACAS E EXECUÇÃO DE TRABALHOS EM MÁRMORE, GRANITO, ARDÓSIA E OUTRAS PEDRAS", "14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "S"],
    ["2399-1/01", "Decoração, lapidação, gravação, vitrificação e outros trabalhos em cerâmica, louça, vidro e cristal", "14.13", "Carpintaria e serralheria.", "S"],
    ["2512-8/00", "Fabricação de esquadrias de metal", "14.13", "Carpintaria e serralheria.", "S"],
    ["2539-0/01", "Serviços de usinagem, tornearia e solda", "14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "S"],
    ["2539-0/02", "Serviços de tratamento e revestimento em metais", "14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "S"],
    ["2542-0/00", "Fabricação de artigos de serralheria, exceto esquadrias", "14.13", "Carpintaria e serralheria.", "S"],
    ["2599-3/01", "Serviços de confecção de armações metálicas para a construção", "14.13", "Carpintaria e serralheria.", "S"],
    ["2599-3/02", "Serviços de corte e dobra de metais", "14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "S"],
    ["2722-8/02", "Recondicionamento de baterias e acumuladores para veículos automotores", "14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "S"],
    ["2930-1/03", "FABRICAÇÃO DE CABINES, CARROCERIAS E REBOQUES PARA OUTROS VEÍCULOS AUTOMOTORES, EXCETO CAMINHÕES E ÔNIBUS", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["2950-6/00", "Recondicionamento e recuperação de motores para veículos automotores", "14.03", "Recondicionamento de motores (exceto peças e partes empregadas...", "S"],
    ["3211-6/01", "Lapidação de gemas", "39.01", "Serviços de ourivesaria e lapidação.", "S"],
    ["3250-7/03", "Fabricação de aparelhos e utensílios para correção de defeitos físicos e aparelhos ortopédicos em geral sob encomenda", "04.14", "Próteses Sob Encomenda.", "S"],
    ["3250-7/06", "Serviços de prótese dentária", "04.14", "Próteses Sob Encomenda.", "S"],
    ["3250-7/09", "Serviços de laboratórios ópticos", "14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "S"],
    ["3299-0/03", "Fabricação de letras, letreiros e placas de qualquer material, exceto luminosos", "24.01", "Serviços de chaveiros, confecção de carimbos...", "S"],
    ["3299-0/04", "Fabricação de painéis e letreiros luminosos", "24.01", "Serviços de chaveiros, confecção de carimbos...", "S"],
    ["3311-2/00", "Manutenção e reparação de tanques, reservatórios metálicos e caldeiras, exceto para veículos", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3312-1/02", "Manutenção e reparação de aparelhos e instrumentos de medida, teste e controle", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3312-1/03", "Manutenção e reparação de aparelhos eletromédicos e eletroterapêuticos e equipamentos de irradiação", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3312-1/04", "Manutenção e reparação de equipamentos e instrumentos ópticos", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3313-9/01", "Manutenção e reparação de geradores, transformadores e motores elétricos", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3313-9/02", "Manutenção e reparação de baterias e acumuladores elétricos, exceto para veículos", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3313-9/99", "Manutenção e reparação de máquinas, aparelhos e materiais elétricos não especificados anteriormente", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/01", "Manutenção e reparação de máquinas motrizes não-elétricas", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/02", "Manutenção e reparação de equipamentos hidráulicos e pneumáticos, exceto válvulas", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/03", "Manutenção e reparação de válvulas industriais", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/04", "Manutenção e reparação de compressores", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/05", "Manutenção e reparação de equipamentos de transmissão para fins industriais", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/06", "Manutenção e reparação de máquinas, aparelhos e equipamentos para instalações térmicas", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/07", "Manutenção e reparação de máquinas e aparelhos de refrigeração e ventilação para uso industrial e comercial", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/08", "Manutenção e reparação de máquinas, equipamentos e aparelhos para transporte e elevação de cargas", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/09", "Manutenção e reparação de máquinas de escrever, calcular e de outros equipamentos não eletrônicos para escritório", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/10", "Manutenção e reparação de máquinas e equipamentos para uso geral não especificados anteriormente", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/11", "Manutenção e reparação de máquinas e equipamentos para agricultura e pecuária", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/12", "Manutenção e reparação de tratores agrícolas", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/13", "Manutenção e reparação de máquinas- ferramenta", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/14", "Manutenção e reparação de máquinas e equipamentos para a prospecção e extração de petróleo", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/15", "Manutenção e reparação de máquinas e equipamentos para uso na extração mineral, exceto na extração de petróleo", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/16", "Manutenção e reparação de tratores, exceto agrícolas", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/17", "Manutenção e reparação de máquinas e equipamentos de terraplenagem, pavimentação e construção, exceto tratores", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/18", "Manutenção e reparação de máquinas para a indústria metalúrgica, exceto máquinas- ferramenta", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/19", "Manutenção e reparação de máquinas e equipamentos para as indústrias de alimentos, bebidas e fumo", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/20", "Manutenção e reparação de máquinas e equipamentos para a indústria têxtil, do vestuário, do couro e calçados", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/21", "Manutenção e reparação de máquinas e aparelhos para a indústria de celulose, papel e papelão e artefatos", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/22", "Manutenção e reparação de máquinas e aparelhos para a indústria do plástico", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3314-7/99", "Manutenção e reparação de outras máquinas e equipamentos para usos industriais não especificados anteriormente", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3315-5/00", "Manutenção e reparação de veículos ferroviários", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3316-3/01", "Manutenção e reparação de aeronaves, exceto a manutenção na pista", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3316-3/02", "Manutenção de aeronaves na pista", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3317-1/01", "Manutenção e reparação de embarcações e estruturas flutuantes", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3317-1/02", "Manutenção e reparação de embarcações para esporte e lazer", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3319-8/00", "Manutenção e reparação de equipamentos e produtos não especificados anteriormente", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["3321-0/00", "Instalação de máquinas e equipamentos industriais", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["3321-0/00", "Instalação de máquinas e equipamentos industriais", "14.06", "Instalação E Montagem De Aparelhos E Equipamentos.", "N"],
    ["3329-5/01", "Serviços de montagem de móveis de qualquer material", "14.13", "Carpintaria e serralheria.", "S"],
    ["3329-5/99", "Instalação de outros equipamentos não especificados anteriormente", "14.06", "Instalação E Montagem De Aparelhos E Equipamentos.", "S"],
    ["3514-0/00", "Distribuição de energia elétrica", "03.04", "Locação e Arrendamento de Bens.", "S"],
    ["3520-4/02", "Distribuição de combustíveis gasosos por redes urbanas", "03.04", "Locação e Arrendamento de Bens.", "S"],
    ["3702-9/00", "Atividades relacionadas a esgoto, exceto a gestão de redes", "07.10", "Limpeza, Manutenção E Conservação De Imóveis.", "S"],
    ["3811-4/00", "Coleta de resíduos não-perigosos", "07.09", "Varrição, Coleta E Remoção De Lixo.", "S"],
    ["3812-2/00", "Coleta de resíduos perigosos", "07.09", "Varrição, Coleta E Remoção De Lixo.", "S"],
    ["3821-1/00", "Tratamento e disposição de resíduos não- perigosos", "07.09", "Varrição, Coleta E Remoção De Lixo.", "S"],
    ["3821-1/00", "Tratamento e disposição de resíduos não- perigosos", "07.12", "Controle e tratamento de efluentes de qualquer natureza...", "N"],
    ["3822-0/00", "Tratamento e disposição de resíduos perigosos", "07.09", "Varrição, Coleta E Remoção De Lixo.", "S"],
    ["3822-0/00", "Tratamento e disposição de resíduos perigosos", "07.12", "Controle e tratamento de efluentes de qualquer natureza...", "N"],
    ["3831-9/01", "Recuperação de sucatas de alumínio", "07.09", "Varrição, Coleta E Remoção De Lixo.", "S"],
    ["3831-9/99", "Recuperação de materiais metálicos, exceto alumínio", "07.09", "Varrição, Coleta E Remoção De Lixo.", "S"],
    ["3832-7/00", "Recuperação de materiais plásticos", "07.09", "Varrição, Coleta E Remoção De Lixo.", "S"],
    ["3839-4/01", "Usinas de compostagem", "07.09", "Varrição, Coleta E Remoção De Lixo.", "S"],
    ["3839-4/99", "Recuperação de materiais não especificados anteriormente", "07.09", "Varrição, Coleta E Remoção De Lixo.", "S"],
    ["3900-5/00", "Descontaminação e outros serviços de gestão de resíduos", "07.18", "Limpeza e dragagem de rios, portos, canais, baías, lagos...", "S"],
    ["4120-4/00", "Construção de edifícios", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4120-4/00", "Construção de edifícios", "07.05", "Reforma E Manutenção De Edifícios.", "N"],
    ["4211-1/01", "Construção de rodovias e ferrovias", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4211-1/01", "Construção de rodovias e ferrovias", "07.05", "Reforma E Manutenção De Edifícios.", "N"],
    ["4211-1/02", "Pintura para sinalização em pistas rodoviárias e aeroportos", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4211-1/02", "Pintura para sinalização em pistas rodoviárias e aeroportos", "07.05", "Reforma E Manutenção De Edifícios.", "N"],
    ["4212-0/00", "Construção de obras-de-arte especiais", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4212-0/00", "Construção de obras-de-arte especiais", "07.05", "Reforma E Manutenção De Edifícios.", "N"],
    ["4213-8/00", "Obras de urbanização - ruas, praças e calçadas", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4221-9/01", "Construção de barragens e represas para geração de energia elétrica", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4221-9/02", "Construção de estações e redes de distribuição de energia elétrica", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4221-9/03", "Manutenção de redes de distribuição de energia elétrica", "07.05", "Reforma E Manutenção De Edifícios.", "S"],
    ["4221-9/04", "Construção de estações e redes de telecomunicações", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4221-9/05", "Manutenção de estações e redes de telecomunicações", "07.05", "Reforma E Manutenção De Edifícios.", "S"],
    ["4222-7/01", "Construção de redes de abastecimento de água, coleta de esgoto e construções correlatas, exceto obras de irrigação", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4222-7/02", "Obras de irrigação", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4223-5/00", "Construção de redes de transportes por dutos, exceto para água e esgoto", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4291-0/00", "Obras portuárias, marítimas e fluviais", "07.18", "Limpeza e dragagem de rios, portos, canais, baías, lagos...", "S"],
    ["4292-8/01", "Montagem de estruturas metálicas", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4292-8/02", "Obras de montagem industrial", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4299-5/01", "Construção de instalações esportivas e recreativas", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4299-5/99", "Outras obras de engenharia civil não especificadas anteriormente", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4299-5/99", "Outras obras de engenharia civil não especificadas anteriormente", "07.17", "Escoramento, contenção de encostas e serviços congêneres.", "N"],
    ["4311-8/01", "Demolição de edifícios e outras estruturas", "07.04", "Demolição.", "S"],
    ["4311-8/02", "Preparação de canteiro e limpeza de terreno", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4312-6/00", "Perfurações e sondagens", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4313-4/00", "Obras de terraplenagem", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4319-3/00", "Serviços de preparação do terreno não especificados anteriormente", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4321-5/00", "Instalação e manutenção elétrica", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4321-5/00", "Instalação e manutenção elétrica", "07.05", "Reforma E Manutenção De Edifícios.", "N"],
    ["4322-3/01", "Instalações hidráulicas, sanitárias e de gás", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4322-3/01", "Instalações hidráulicas, sanitárias e de gás", "07.05", "Reforma E Manutenção De Edifícios.", "N"],
    ["4322-3/02", "Instalação e manutenção de sistemas centrais de ar condicionado, de ventilação e refrigeração", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4322-3/02", "Instalação e manutenção de sistemas centrais de ar condicionado, de ventilação e refrigeração", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "N"],
    ["4322-3/03", "Instalações de sistema de prevenção contra incêndio", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4322-3/03", "Instalações de sistema de prevenção contra incêndio", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "N"],
    ["4322-3/03", "Instalações de sistema de prevenção contra incêndio", "14.06", "Instalação E Montagem De Aparelhos E Equipamentos.", "N"],
    ["4329-1/01", "Instalação de painéis publicitários", "24.01", "Serviços de chaveiros, confecção de carimbos...", "S"],
    ["4329-1/02", "Instalação de equipamentos para orientação à navegação marítima, fluvial e lacustre", "14.06", "Instalação E Montagem De Aparelhos E Equipamentos.", "S"],
    ["4329-1/03", "Instalação, manutenção e reparação de elevadores, escadas e esteiras rolantes, exceto de fabricação própria", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4329-1/03", "Instalação, manutenção e reparação de elevadores, escadas e esteiras rolantes, exceto de fabricação própria", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "N"],
    ["4329-1/04", "Montagem e instalação de sistemas e equipamentos de iluminação e sinalização em vias públicas, portos e aeroportos", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["4329-1/04", "Montagem e instalação de sistemas e equipamentos de iluminação e sinalização em vias públicas, portos e aeroportos", "14.06", "Instalação E Montagem De Aparelhos E Equipamentos.", "N"],
    ["4329-1/05", "Tratamentos térmicos, acústicos ou de vibração", "07.08", "Calafetação.", "S"],
    ["4329-1/05", "Tratamentos térmicos, acústicos ou de vibração", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "N"],
    ["4329-1/99", "Outras obras de instalações em construções não especificadas anteriormente", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4330-4/01", "Impermeabilização em obras de engenharia civil", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4330-4/02", "Instalação de portas, janelas, tetos, divisórias e armários embutidos de qualquer material", "07.06", "Colocação e instalação de tapetes, carpetes, assoalhos, cortinas...", "S"],
    ["4330-4/02", "Instalação de portas, janelas, tetos, divisórias e armários embutidos de qualquer material", "14.13", "Carpintaria e serralheria.", "N"],
    ["4330-4/03", "Obras de acabamento em gesso e estuque", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4330-4/03", "Obras de acabamento em gesso e estuque", "07.05", "Reforma E Manutenção De Edifícios.", "N"],
    ["4330-4/03", "Obras de acabamento em gesso e estuque", "07.06", "Colocação e instalação de tapetes, carpetes, assoalhos, cortinas...", "N"],
    ["4330-4/03", "Obras de acabamento em gesso e estuque", "14.07", "Colocação de molduras e congêneres.", "N"],
    ["4330-4/04", "Serviços de pintura de edifícios em geral", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4330-4/04", "Serviços de pintura de edifícios em geral", "07.05", "Reforma E Manutenção De Edifícios.", "N"],
    ["4330-4/05", "Aplicação de revestimentos e de resinas em interiores e exteriores", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4330-4/05", "Aplicação de revestimentos e de resinas em interiores e exteriores", "07.05", "Reforma E Manutenção De Edifícios.", "N"],
    ["4330-4/05", "Aplicação de revestimentos e de resinas em interiores e exteriores", "07.06", "Colocação e instalação de tapetes, carpetes, assoalhos, cortinas...", "N"],
    ["4330-4/05", "Aplicação de revestimentos e de resinas em interiores e exteriores", "07.07", "Recuperação, raspagem, polimento e lustração de pisos e congêneres.", "N"],
    ["4330-4/05", "Aplicação de revestimentos e de resinas em interiores e exteriores", "07.08", "Calafetação.", "N"],
    ["4330-4/99", "Outras obras de acabamento da construção", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4330-4/99", "Outras obras de acabamento da construção", "07.05", "Reforma E Manutenção De Edifícios.", "N"],
    ["4330-4/99", "Outras obras de acabamento da construção", "07.06", "Colocação e instalação de tapetes, carpetes, assoalhos, cortinas...", "N"],
    ["4391-6/00", "Obras de fundações", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4399-1/01", "Administração de obras", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4399-1/02", "Montagem e desmontagem de andaimes e outras estruturas temporárias", "03.05", "Cessão De Andaimes, Palcos, Coberturas.", "S"],
    ["4399-1/03", "Obras de alvenaria", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4399-1/03", "Obras de alvenaria", "07.05", "Reforma E Manutenção De Edifícios.", "N"],
    ["4399-1/04", "Serviços de operação e fornecimento de equipamentos para transporte e elevação de cargas e pessoas para uso em obras", "03.05", "Cessão De Andaimes, Palcos, Coberturas.", "S"],
    ["4399-1/05", "Perfuração e construção de poços de água", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4399-1/99", "Serviços especializados para construção não especificados anteriormente", "07.02", "Execução De Obras De Construção Civil.", "S"],
    ["4399-1/99", "Serviços especializados para construção não especificados anteriormente", "07.05", "Reforma E Manutenção De Edifícios.", "N"],
    ["4512-9/01", "Representantes comerciais e agentes do comércio de veículos automotores", "10.09", "Representação Comercial.", "S"],
    ["4512-9/02", "Comércio sob consignação de veículos automotores", "10.05", "Corretagem De Bens Móveis Ou Imóveis (Intermediação).", "S"],
    ["4512-9/02", "Comércio sob consignação de veículos automotores", "10.09", "Representação Comercial.", "N"],
    ["4520-0/01", "Serviços de manutenção e reparação mecânica de veículos automotores", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["4520-0/02", "Serviços de lanternagem ou funilaria e pintura de veículos automotores", "14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "S"],
    ["4520-0/02", "Serviços de lanternagem ou funilaria e pintura de veículos automotores", "14.12", "Funilaria e lanternagem.", "N"],
    ["4520-0/03", "Serviços de manutenção e reparação elétrica de veículos automotores", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["4520-0/04", "Serviços de alinhamento e balanceamento de veículos automotores", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["4520-0/05", "Serviços de lavagem, lubrificação e polimento de veículos automotores", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["4520-0/05", "Serviços de lavagem, lubrificação e polimento de veículos automotores", "14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "N"],
    ["4520-0/06", "Serviços de borracharia para veículos automotores", "14.04", "Recauchutagem ou regeneração de pneus.", "S"],
    ["4520-0/07", "Serviços de instalação, manutenção e reparação de acessórios para veículos automotores", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["4520-0/08", "Serviços de capotaria", "14.11", "Tapeçaria e reforma de estofamentos em geral.", "S"],
    ["4530-7/06", "Representantes comerciais e agentes do comércio de peças e acessórios novos e usados para veículos automotores", "10.09", "Representação Comercial.", "S"],
    ["4542-1/01", "Representantes comerciais e agentes do comércio de motocicletas e motonetas, peças e acessórios", "10.09", "Representação Comercial.", "S"],
    ["4543-9/00", "Manutenção e reparação de motocicletas e motonetas", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["4611-7/00", "Representantes comerciais e agentes do comércio de matérias-primas agrícolas e animais vivos", "10.09", "Representação Comercial.", "S"],
    ["4612-5/00", "Representantes comerciais e agentes do comércio de combustíveis, minerais, produtos siderúrgicos e químicos", "10.09", "Representação Comercial.", "S"],
    ["4613-3/00", "Representantes comerciais e agentes do comércio de madeira, material de construção e ferragens", "10.09", "Representação Comercial.", "S"],
    ["4614-1/00", "Representantes comerciais e agentes do comércio de máquinas, equipamentos, embarcações e aeronaves", "10.09", "Representação Comercial.", "S"],
    ["4615-0/00", "Representantes comerciais e agentes do comércio de eletrodomésticos, móveis e artigos de uso doméstico", "10.09", "Representação Comercial.", "S"],
    ["4616-8/00", "Representantes comerciais e agentes do comércio de têxteis, vestuário, calçados e artigos de viagem", "10.09", "Representação Comercial.", "S"],
    ["4617-6/00", "Representantes comerciais e agentes do comércio de produtos alimentícios, bebidas e fumo", "10.09", "Representação Comercial.", "S"],
    ["4618-4/01", "Representantes comerciais e agentes do comércio de medicamentos, cosméticos e produtos de perfumaria", "10.09", "Representação Comercial.", "S"],
    ["4618-4/02", "Representantes comerciais e agentes do comércio de instrumentos e materiais odonto- médico-hospitalares", "10.09", "Representação Comercial.", "S"],
    ["4618-4/03", "Representantes comerciais e agentes do comércio de jornais, revistas e outras publicações", "10.09", "Representação Comercial.", "S"],
    ["4618-4/99", "Outros representantes comerciais e agentes do comércio especializado em produtos não especificados anteriormente", "10.09", "Representação Comercial.", "S"],
    ["4619-2/00", "Representantes comerciais e agentes do comércio de mercadorias em geral não especializado", "10.09", "Representação Comercial.", "S"],
    ["4751-2/02", "Recarga de cartuchos para equipamentos de informática", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["4771-7/02", "Comércio varejista de produtos farmacêuticos, com manipulação de fórmulas", "04.07", "Serviços farmacêuticos", "S"],
    ["4771-7/03", "Comércio varejista de produtos farmacêuticos homeopáticos", "04.07", "Serviços farmacêuticos", "S"],
    ["4911-6/00", "Transporte ferroviário de carga", "03.04", "Locação e Arrendamento de Bens.", "S"],
    ["4912-4/02", "Transporte ferroviário de passageiros municipal e em região metropolitana", "16.01", "Serviços de transporte municipal...", "S"],
    ["4912-4/03", "Transporte metroviário", "16.01", "Serviços de transporte municipal...", "S"],
    ["4921-3/01", "Transporte rodoviário coletivo de passageiros, com itinerário fixo, municipal", "16.01", "Serviços de transporte municipal...", "S"],
    ["4923-0/01", "Serviço de táxi", "16.01", "Serviços de transporte municipal...", "S"],
    ["4923-0/02", "Serviço de transporte de passageiros - locação de automóveis com motorista", "16.01", "Serviços de transporte municipal...", "S"],
    ["4924-8/00", "Transporte escolar", "16.01", "Serviços de transporte municipal...", "S"],
    ["4929-9/01", "Transporte rodoviário coletivo de passageiros, sob regime de fretamento, municipal", "16.01", "Serviços de transporte municipal...", "S"],
    ["4929-9/03", "Organização de excursões em veículos rodoviários próprios, municipal", "09.02", "Agenciamento De Viagens E Turismo.", "S"],
    ["4929-9/04", "Organização de excursões em veículos rodoviários próprios, intermunicipal, interestadual e internacional", "09.02", "Agenciamento De Viagens E Turismo.", "S"],
    ["4930-2/01", "Transporte rodoviário de carga, exceto produtos perigosos e mudanças, municipal", "16.01", "Serviços de transporte municipal...", "S"],
    ["4930-2/03", "Transporte rodoviário de produtos perigosos", "16.01", "Serviços de transporte municipal...", "S"],
    ["4930-2/04", "Transporte rodoviário de mudanças", "11.04", "Armazenamento, depósito, carga, descarga...", "S"],
    ["4930-2/04", "Transporte rodoviário de mudanças", "16.01", "Serviços de transporte municipal...", "N"],
    ["4940-0/00", "TRANSPORTE DUTOVIÁRIO", "16.01", "Serviços de transporte municipal...", "S"],
    ["4950-7/00", "Trens turísticos, teleféricos e similares", "16.01", "Serviços de transporte municipal...", "S"],
    ["5021-1/01", "Transporte por navegação interior de carga, municipal, exceto travessia", "16.01", "Serviços de transporte municipal...", "S"],
    ["5022-0/01", "Transporte por navegação interior de passageiros em linhas regulares, municipal, exceto travessia", "16.01", "Serviços de transporte municipal...", "S"],
    ["5030-1/01", "Navegação de apoio marítimo", "20.01", "Serviços portuários...", "S"],
    ["5030-1/02", "Navegação de apoio portuário", "20.01", "Serviços portuários...", "S"],
    ["5091-2/01", "Transporte por navegação de travessia, municipal", "16.01", "Serviços de transporte municipal...", "S"],
    ["5099-8/01", "Transporte aquaviário para passeios turísticos", "16.01", "Serviços de transporte municipal...", "S"],
    ["5112-9/99", "Outros serviços de transporte aéreo de passageiros não-regular", "16.01", "Serviços de transporte municipal...", "S"],
    ["5211-7/01", "Armazéns gerais - emissão de warrant", "11.04", "Armazenamento, depósito, carga, descarga...", "S"],
    ["5211-7/01", "Armazéns gerais - emissão de warrant", "20.01", "Serviços portuários...", "N"],
    ["5211-7/02", "Guarda-móveis", "11.04", "Armazenamento, depósito, carga, descarga...", "S"],
    ["5211-7/99", "Depósitos de mercadorias para terceiros, exceto armazéns gerais e guarda-móveis", "11.04", "Armazenamento, depósito, carga, descarga...", "S"],
    ["5211-7/99", "Depósitos de mercadorias para terceiros, exceto armazéns gerais e guarda-móveis", "20.01", "Serviços portuários...", "N"],
    ["5212-5/00", "Carga e descarga", "11.04", "Armazenamento, depósito, carga, descarga...", "S"],
    ["5212-5/00", "Carga e descarga", "20.01", "Serviços portuários...", "N"],
    ["5221-4/00", "Concessionárias de rodovias, pontes, túneis e serviços relacionados", "03.04", "Locação e Arrendamento de Bens.", "S"],
    ["5221-4/00", "Concessionárias de rodovias, pontes, túneis e serviços relacionados", "22.01", "Serviços de exploração de rodovia...", "N"],
    ["5222-2/00", "Terminais rodoviários e ferroviários", "20.03", "Serviços de Terminais rodoviários...", "S"],
    ["5223-1/00", "Estacionamento de veículos", "11.01", "Guarda E Estacionamento De Veículos.", "S"],
    ["5229-0/01", "Serviços de apoio ao transporte por táxi, inclusive centrais de chamada", "17.02", "Datilografia, Digitação, Secretaria Em Geral.", "S"],
    ["5229-0/02", "Serviços de reboque de veículos", "16.01", "Serviços de transporte municipal...", "S"],
    ["5229-0/99", "Outras atividades auxiliares dos transportes terrestres não especificadas anteriormente", "11.03", "Escolta, inclusive de veículos e cargas.", "S"],
    ["5231-1/01", "Administração da infra-estrutura portuária", "20.01", "Serviços portuários...", "S"],
    ["5231-1/02", "Operações de terminais", "11.04", "Armazenamento, depósito, carga, descarga...", "S"],
    ["5231-1/02", "Operações de terminais", "20.01", "Serviços portuários...", "N"],
    ["5232-0/00", "Atividades de agenciamento marítimo", "10.06", "Agenciamento marítimo.", "S"],
    ["5239-7/00", "Atividades auxiliares dos transportes aquaviários não especificadas anteriormente", "20.01", "Serviços portuários...", "S"],
    ["5240-1/01", "Operação dos aeroportos e campos de aterrissagem", "20.02", "Serviços aeroportuários...", "S"],
    ["5240-1/99", "Atividades auxiliares dos transportes aéreos, exceto operação dos aeroportos e campos de aterrissagem", "11.01", "Guarda E Estacionamento De Veículos.", "S"],
    ["5240-1/99", "Atividades auxiliares dos transportes aéreos, exceto operação dos aeroportos e campos de aterrissagem", "20.02", "Serviços aeroportuários...", "N"],
    ["5250-8/01", "Comissaria de despachos", "33.01", "Serviços de desembaraço aduaneiro...", "S"],
    ["5250-8/02", "Atividades de despachantes aduaneiros", "33.01", "Serviços de desembaraço aduaneiro...", "S"],
    ["5250-8/03", "Agenciamento de cargas, exceto para o transporte marítimo", "10.05", "Corretagem De Bens Móveis Ou Imóveis (Intermediação).", "S"],
    ["5250-8/04", "Organização logística do transporte de carga", "11.04", "Armazenamento, depósito, carga, descarga...", "S"],
    ["5250-8/05", "OPERADOR DE TRANSPORTE MULTIMODAL OTM", "20.01", "Serviços portuários...", "S"],
    ["5250-8/05", "OPERADOR DE TRANSPORTE MULTIMODAL OTM", "20.02", "Serviços aeroportuários...", "N"],
    ["5250-8/05", "OPERADOR DE TRANSPORTE MULTIMODAL OTM", "20.03", "Serviços de Terminais rodoviários...", "N"],
    ["5310-5/01", "Atividades do Correio Nacional", "26.01", "Atividades de transporte de valores...", "S"],
    ["5310-5/02", "Atividades de franqueadas do Correio Nacional", "17.08", "Franquia (franchising).", "S"],
    ["5310-5/02", "Atividades de franqueadas do Correio Nacional", "26.01", "Atividades de transporte de valores...", "N"],
    ["5320-2/01", "Serviços de malote não realizados pelo Correio Nacional", "26.01", "Atividades de transporte de valores...", "S"],
    ["5320-2/02", "Serviços de entrega rápida", "26.01", "Atividades de transporte de valores...", "S"],
    ["5510-8/01", "Hotéis", "09.01", "Hospedagem Em Hotéis, Pousadas E Similares.", "S"],
    ["5510-8/02", "Apart-hotéis", "09.01", "Hospedagem Em Hotéis, Pousadas E Similares.", "S"],
    ["5510-8/03", "Motéis", "09.01", "Hospedagem Em Hotéis, Pousadas E Similares.", "S"],
    ["5590-6/01", "Albergues, exceto assistenciais", "09.01", "Hospedagem Em Hotéis, Pousadas E Similares.", "S"],
    ["5590-6/02", "Campings", "09.01", "Hospedagem Em Hotéis, Pousadas E Similares.", "S"],
    ["5590-6/03", "Pensões (alojamento)", "09.01", "Hospedagem Em Hotéis, Pousadas E Similares.", "S"],
    ["5590-6/99", "Outros alojamentos não especificados anteriormente", "09.01", "Hospedagem Em Hotéis, Pousadas E Similares.", "S"],
    ["5620-1/02", "Serviços de alimentação para eventos e recepções – bufê", "17.11", "Organização de festas e recepções...", "S"],
    ["5811-5/00", "Edição de livros", "10.03", "Agenciamento, corretagem ou intermediação de direitos da propriedade...", "S"],
    ["5811-5/00", "Edição de livros", "17.02", "Datilografia, Digitação, Secretaria Em Geral.", "N"],
    ["5812-3/00", "Edição de jornais", "17.02", "Datilografia, Digitação, Secretaria Em Geral.", "S"],
    ["5813-1/00", "Edição de revistas", "17.02", "Datilografia, Digitação, Secretaria Em Geral.", "S"],
    ["5819-1/00", "Edição de cadastros, listas e outros produtos gráficos", "17.02", "Datilografia, Digitação, Secretaria Em Geral.", "S"],
    ["5821-2/00", "Edição integrada à impressão de livros", "17.02", "Datilografia, Digitação, Secretaria Em Geral.", "S"],
    ["5822-1/00", "Edição integrada à impressão de jornais", "17.02", "Datilografia, Digitação, Secretaria Em Geral.", "S"],
    ["5823-9/00", "Edição integrada à impressão de revistas", "17.02", "Datilografia, Digitação, Secretaria Em Geral.", "S"],
    ["5829-8/00", "Edição integrada à impressão de cadastros, listas e outros produtos gráficos", "17.02", "Datilografia, Digitação, Secretaria Em Geral.", "S"],
    ["5911-1/01", "Estúdios cinematográficos", "13.03", "Fotografia e cinematografia, inclusive revelação.", "S"],
    ["5911-1/02", "Produção de filmes para publicidade", "17.06", "Propaganda E Publicidade.", "S"],
    ["5911-1/99", "Atividades de produção cinematográfica, de vídeos e de programas de televisão não especificadas anteriormente", "12.13", "Produção, mediante ou sem encomenda prévia, de eventos.", "S"],
    ["5912-0/01", "Serviços de dublagem", "13.02", "Fonografia ou gravação de sons, inclusive trucagem.", "S"],
    ["5912-0/02", "Serviços de mixagem sonora em produção audiovisual", "13.02", "Fonografia ou gravação de sons, inclusive trucagem.", "S"],
    ["5912-0/99", "Atividades de pós-produção cinematográfica, de vídeos e de programas de televisão não especificadas anteriormente", "13.03", "Fotografia e cinematografia, inclusive revelação.", "S"],
    ["5913-8/00", "Distribuição cinematográfica, de vídeo e de programas de televisão", "10.10", "Distribuição de bens de terceiros", "S"],
    ["5914-6/00", "Atividades de exibição cinematográfica", "12.02", "Exibições cinematográficas.", "N"],
    ["5914-6/00", "Atividades de exibição cinematográfica", "12.16", "Exibição de filmes, entrevistas, musicais.", "S"],
    ["5920-1/00", "Atividades de gravação de som e de edição de música", "13.02", "Fonografia ou gravação de sons, inclusive trucagem.", "S"],
    ["6021-7/00", "Atividades de televisão aberta", "12.13", "Produção, mediante ou sem encomenda prévia, de eventos.", "S"],
    ["6022-5/02", "Atividades relacionadas à televisão por assinatura, exceto programadoras", "10.03", "Agenciamento, corretagem ou intermediação de direitos da propriedade...", "S"],
    ["6190-6/01", "Provedores de acesso às redes de comunicações", "01.03", "Processamento, Armazenamento Ou Hospedagem De Dados.", "S"],
    ["6190-6/99", "Outras atividades de telecomunicações não especificadas anteriormente", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["6190-6/99", "Outras atividades de telecomunicações não especificadas anteriormente", "14.06", "Instalação E Montagem De Aparelhos E Equipamentos.", "N"],
    ["6201-5/00", "Desenvolvimento de programas de computador sob encomenda", "01.01", "Análise E Desenvolvimento De Sistemas.", "S"],
    ["6201-5/00", "Desenvolvimento de programas de computador sob encomenda", "01.02", "Programação.", "N"],
    ["6201-5/00", "Desenvolvimento de programas de computador sob encomenda", "01.04", "Elaboração De Programas De Computadores e Jogos.", "N"],
    ["6201-5/00", "Desenvolvimento de programas de computador sob encomenda", "01.08", "Planejamento e Manutenção De Páginas Eletrônicas.", "N"],
    ["6202-3/00", "Desenvolvimento e licenciamento de programas de computador customizáveis", "01.04", "Elaboração De Programas De Computadores e Jogos.", "S"],
    ["6202-3/00", "Desenvolvimento e licenciamento de programas de computador customizáveis", "01.05", "Licenciamento Ou Cessão De Direito De Uso De Programas.", "N"],
    ["6203-1/00", "Desenvolvimento e licenciamento de programas de computador não-customizáveis", "01.04", "Elaboração De Programas De Computadores e Jogos.", "S"],
    ["6204-0/00", "Consultoria em tecnologia da informação", "01.06", "Assessoria E Consultoria Em Informática.", "S"],
    ["6209-1/00", "Suporte técnico, manutenção e outros serviços em tecnologia da informação", "01.07", "Suporte Técnico Em Informática.", "S"],
    ["6311-9/00", "Tratamento de dados, provedores de serviços de aplicação e serviços de hospedagem na internet", "01.03", "Processamento, Armazenamento Ou Hospedagem De Dados.", "S"],
    ["6319-4/00", "Portais, provedores de conteúdo e outros serviços de informação na internet", "01.08", "Planejamento e Manutenção De Páginas Eletrônicas.", "S"],
    ["6391-7/00", "Agências de notícias", "10.07", "Agenciamento de notícias.", "S"],
    ["6399-2/00", "Outras atividades de prestação de serviços de informação não especificadas anteriormente", "17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "S"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.01", "Administração de cartões de crédito...", "S"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.02", "Abertura de contas em geral...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.03", "Locação e manutenção de cofres particulares...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.04", "Fornecimento ou emissão de atestados em geral...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.05", "Cadastro, elaboração de ficha cadastral...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.06", "Emissão, reemissão e fornecimento de avisos...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.07", "Acesso, movimentação, atendimento...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.08", "Emissão, reemissão, alteração...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.09", "Arrendamento mercantil...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.10", "Serviços relacionados a cobranças...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.11", "Devolução de títulos, protesto...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.12", "Custódia em geral...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.13", "Serviços relacionados a operações de câmbio...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.14", "Fornecimento, emissão, reemissão...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.15", "Compensação de cheques...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.16", "Emissão, reemissão, liquidação...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.17", "Emissão, fornecimento, devolução...", "N"],
    ["6421-2/00", "BANCOS COMERCIAIS", "15.18", "Serviços relacionados a crédito imobiliário...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.01", "Administração de cartões de crédito...", "S"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.02", "Abertura de contas em geral...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.03", "Locação e manutenção de cofres particulares...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.04", "Fornecimento ou emissão de atestados em geral...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.05", "Cadastro, elaboração de ficha cadastral...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.06", "Emissão, reemissão e fornecimento de avisos...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.07", "Acesso, movimentação, atendimento...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.08", "Emissão, reemissão, alteração...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.09", "Arrendamento mercantil...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.10", "Serviços relacionados a cobranças...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.11", "Devolução de títulos, protesto...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.12", "Custódia em geral...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.13", "Serviços relacionados a operações de câmbio...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.14", "Fornecimento, emissão, reemissão...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.15", "Compensação de cheques...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.16", "Emissão, reemissão, liquidação...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.17", "Emissão, fornecimento, devolução...", "N"],
    ["6422-1/00", "BANCOS MULTIPLOS, COM CARTEIRA COMERCIAL", "15.18", "Serviços relacionados a crédito imobiliário...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.01", "Administração de cartões de crédito...", "S"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.02", "Abertura de contas em geral...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.03", "Locação e manutenção de cofres particulares...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.04", "Fornecimento ou emissão de atestados em geral...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.05", "Cadastro, elaboração de ficha cadastral...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.06", "Emissão, reemissão e fornecimento de avisos...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.07", "Acesso, movimentação, atendimento...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.08", "Emissão, reemissão, alteração...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.09", "Arrendamento mercantil...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.10", "Serviços relacionados a cobranças...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.11", "Devolução de títulos, protesto...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.12", "Custódia em geral...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.13", "Serviços relacionados a operações de câmbio...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.14", "Fornecimento, emissão, reemissão...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.15", "Compensação de cheques...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.16", "Emissão, reemissão, liquidação...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.17", "Emissão, fornecimento, devolução...", "N"],
    ["6423-9/00", "CAIXAS ECONOMICAS", "15.18", "Serviços relacionados a crédito imobiliário...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.01", "Administração de cartões de crédito...", "S"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.02", "Abertura de contas em geral...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.03", "Locação e manutenção de cofres particulares...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.04", "Fornecimento ou emissão de atestados em geral...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.05", "Cadastro, elaboração de ficha cadastral...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.06", "Emissão, reemissão e fornecimento de avisos...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.07", "Acesso, movimentação, atendimento...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.08", "Emissão, reemissão, alteração...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.09", "Arrendamento mercantil...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.10", "Serviços relacionados a cobranças...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.11", "Devolução de títulos, protesto...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.12", "Custódia em geral...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.13", "Serviços relacionados a operações de câmbio...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.14", "Fornecimento, emissão, reemissão...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.15", "Compensação de cheques...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.16", "Emissão, reemissão, liquidação...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.17", "Emissão, fornecimento, devolução...", "N"],
    ["6424-7/01", "BANCOS COOPERATIVOS", "15.18", "Serviços relacionados a crédito imobiliário...", "N"],
    ["6424-7/02", "COOPERATIVAS CENTRAIS DE CREDITO", "15.01", "Administração de cartões de crédito...", "S"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.01", "Administração de cartões de crédito...", "S"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.02", "Abertura de contas em geral...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.03", "Locação e manutenção de cofres particulares...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.04", "Fornecimento ou emissão de atestados em geral...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.05", "Cadastro, elaboração de ficha cadastral...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.06", "Emissão, reemissão e fornecimento de avisos...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.07", "Acesso, movimentação, atendimento...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.08", "Emissão, reemissão, alteração...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.09", "Arrendamento mercantil...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.10", "Serviços relacionados a cobranças...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.11", "Devolução de títulos, protesto...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.12", "Custódia em geral...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.13", "Serviços relacionados a operações de câmbio...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.14", "Fornecimento, emissão, reemissão...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.15", "Compensação de cheques...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.16", "Emissão, reemissão, liquidação...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.17", "Emissão, fornecimento, devolução...", "N"],
    ["6424-7/03", "COOPERATIVAS DE CREDITO MUTUO", "15.18", "Serviços relacionados a crédito imobiliário...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.01", "Administração de cartões de crédito...", "S"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.02", "Abertura de contas em geral...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.03", "Locação e manutenção de cofres particulares...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.04", "Fornecimento ou emissão de atestados em geral...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.05", "Cadastro, elaboração de ficha cadastral...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.06", "Emissão, reemissão e fornecimento de avisos...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.07", "Acesso, movimentação, atendimento...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.08", "Emissão, reemissão, alteração...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.09", "Arrendamento mercantil...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.10", "Serviços relacionados a cobranças...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.11", "Devolução de títulos, protesto...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.12", "Custódia em geral...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.13", "Serviços relacionados a operações de câmbio...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.14", "Fornecimento, emissão, reemissão...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.15", "Compensação de cheques...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.16", "Emissão, reemissão, liquidação...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.17", "Emissão, fornecimento, devolução...", "N"],
    ["6424-7/04", "COOPERATIVAS DE CREDITO RURAL", "15.18", "Serviços relacionados a crédito imobiliário...", "N"],
    ["6431-0/00", "BANCOS MULTIPLOS, SEM CARTEIRA COMERCIAL", "15.01", "Administração de cartões de crédito...", "S"],
    ["6431-0/00", "BANCOS MULTIPLOS, SEM CARTEIRA COMERCIAL", "15.06", "Emissão, reemissão e fornecimento de avisos...", "N"],
    ["6431-0/00", "BANCOS MULTIPLOS, SEM CARTEIRA COMERCIAL", "15.08", "Emissão, reemissão, alteração...", "N"],
    ["6431-0/00", "BANCOS MULTIPLOS, SEM CARTEIRA COMERCIAL", "15.09", "Arrendamento mercantil...", "N"],
    ["6431-0/00", "BANCOS MULTIPLOS, SEM CARTEIRA COMERCIAL", "15.12", "Custódia em geral...", "N"],
    ["6431-0/00", "BANCOS MULTIPLOS, SEM CARTEIRA COMERCIAL", "15.18", "Serviços relacionados a crédito imobiliário...", "N"],
    ["6432-8/00", "BANCOS DE INVESTIMENTO", "15.01", "Administração de cartões de crédito...", "S"],
    ["6432-8/00", "BANCOS DE INVESTIMENTO", "15.07", "Acesso, movimentação, atendimento...", "N"],
    ["6432-8/00", "BANCOS DE INVESTIMENTO", "15.08", "Emissão, reemissão, alteração...", "N"],
    ["6432-8/00", "BANCOS DE INVESTIMENTO", "15.16", "Emissão, reemissão, liquidação...", "N"],
    ["6433-6/00", "BANCOS DE DESENVOLVIMENTO", "15.01", "Administração de cartões de crédito...", "S"],
    ["6433-6/00", "BANCOS DE DESENVOLVIMENTO", "15.02", "Abertura de contas em geral...", "N"],
    ["6433-6/00", "BANCOS DE DESENVOLVIMENTO", "15.07", "Acesso, movimentação, atendimento...", "N"],
    ["6433-6/00", "BANCOS DE DESENVOLVIMENTO", "15.08", "Emissão, reemissão, alteração...", "N"],
    ["6433-6/00", "BANCOS DE DESENVOLVIMENTO", "15.16", "Emissão, reemissão, liquidação...", "N"],
    ["6434-4/00", "AGENCIAS DE FOMENTO", "15.01", "Administração de cartões de crédito...", "S"],
    ["6435-2/01", "SOCIEDADES DE CREDITO IMOBILIARIO", "15.18", "Serviços relacionados a crédito imobiliário...", "S"],
    ["6435-2/02", "ASSOCIACOES DE POUPANCA E EMPRESTIMO", "15.02", "Abertura de contas em geral...", "S"],
    ["6435-2/02", "ASSOCIACOES DE POUPANCA E EMPRESTIMO", "15.08", "Emissão, reemissão, alteração...", "N"],
    ["6435-2/02", "ASSOCIACOES DE POUPANCA E EMPRESTIMO", "15.18", "Serviços relacionados a crédito imobiliário...", "N"],
    ["6435-2/03", "COMPANHIAS HIPOTECARIAS", "15.01", "Administração de cartões de crédito...", "S"],
    ["6435-2/03", "COMPANHIAS HIPOTECARIAS", "15.07", "Acesso, movimentação, atendimento...", "N"],
    ["6435-2/03", "COMPANHIAS HIPOTECARIAS", "15.08", "Emissão, reemissão, alteração...", "N"],
    ["6435-2/03", "COMPANHIAS HIPOTECARIAS", "15.18", "Serviços relacionados a crédito imobiliário...", "N"],
    ["6436-1/00", "SOCIEDADES DE CREDITO, FINANCIAMENTO E INVESTIMENTO - FINANCEIRAS", "15.08", "Emissão, reemissão, alteração...", "S"],
    ["6437-9/00", "SOCIEDADES DE CREDITO AO MICROEMPREENDEDOR", "15.08", "Emissão, reemissão, alteração...", "S"],
    ["6438-7/01", "BANCOS DE CAMBIO", "15.13", "Serviços relacionados a operações de câmbio...", "S"],
    ["6438-7/99", "OUTRAS INSTITUICOES DE INTERMEDIACAO NÃO-MONETARIA NAO ESPECIFIDAS ANTERIORMENTE", "15.13", "Serviços relacionados a operações de câmbio...", "S"],
    ["6440-9/00", "ARRENDAMENTO MERCANTIL", "15.09", "Arrendamento mercantil...", "S"],
    ["6450-6/00", "SOCIEDADES DE CAPITALIZACAO", "15.02", "Abertura de contas em geral...", "S"],
    ["6450-6/00", "SOCIEDADES DE CAPITALIZACAO", "15.07", "Acesso, movimentação, atendimento...", "N"],
    ["6470-1/01", "FUNDOS DE INVESTIMENTO, EXCETO PREVIDENCIÁRIOS E IMOBILIÁRIOS", "15.01", "Administração de cartões de crédito...", "S"],
    ["6470-1/02", "FUNDOS DE INVESTIMENTO PREVIDENCIARIOS", "15.01", "Administração de cartões de crédito...", "S"],
    ["6470-1/03", "FUNDOS DE INVESTIMENTO IMOBILIARIOS", "15.01", "Administração de cartões de crédito...", "S"],
    ["6491-3/00", "Sociedades de fomento mercantil - factoring", "17.23", "Assessoria, análise, avaliação, atendimento...", "S"],
    ["6493-0/00", "Administração de consórcios para aquisição de bens e direitos", "17.12-G", "Administração Em Geral, Inclusive De Bens E Negócios De Terceiros — Gestão de Negócios/Hospitalar (sem bem imóvel)", "S"],
    ["6499-9/01", "CLUBES DE INVESTIMENTO", "15.01", "Administração de cartões de crédito...", "S"],
    ["6499-9/02", "SOCIEDADES DE INVESTIMENTO", "15.01", "Administração de cartões de crédito...", "S"],
    ["6499-9/04", "CAIXAS DE FINANCIAMENTO DE CORPORACOES", "15.18", "Serviços relacionados a crédito imobiliário...", "S"],
    ["6499-9/05", "CONCESSAO DE CREDITO PELAS OSCIP", "15.08", "Emissão, reemissão, alteração...", "S"],
    ["6499-9/99", "OUTRAS ATIVIDADES DE SERVICOS FINANCEIROS NAO ESPECIFICADAS ANTERIORMENTE", "15.12", "Custódia em geral...", "S"],
    ["6511-1/02", "Planos de auxílio-funeral", "25.03", "Planos ou convênio funerários.", "S"],
    ["6550-2/00", "Planos de saúde", "04.22", "Planos De Saúde E Convênios Médicos.", "S"],
    ["6550-2/00", "Planos de saúde", "04.23", "Outros planos de saúde com terceiros contratados/credenciados.", "N"],
    ["6550-2/00", "Planos de saúde", "05.09", "Planos de atendimento e assistência médico-veterinária.", "N"],
    ["6611-8/01", "Bolsa de valores", "17.12-G", "Administração Em Geral, Inclusive De Bens E Negócios De Terceiros — Gestão de Negócios/Hospitalar (sem bem imóvel)", "S"],
    ["6611-8/02", "Bolsa de mercadorias", "17.12-G", "Administração Em Geral, Inclusive De Bens E Negócios De Terceiros — Gestão de Negócios/Hospitalar (sem bem imóvel)", "S"],
    ["6611-8/03", "Bolsa de mercadorias e futuros", "17.12-G", "Administração Em Geral, Inclusive De Bens E Negócios De Terceiros — Gestão de Negócios/Hospitalar (sem bem imóvel)", "S"],
    ["6611-8/04", "Administração de mercados de balcão organizados", "17.12-G", "Administração Em Geral, Inclusive De Bens E Negócios De Terceiros — Gestão de Negócios/Hospitalar (sem bem imóvel)", "S"],
    ["6612-6/01", "Corretoras de títulos e valores mobiliários", "10.02", "Corretagem De Títulos E Valores Mobiliários.", "S"],
    ["6612-6/02", "Distribuidoras de títulos e valores mobiliários", "10.02", "Corretagem De Títulos E Valores Mobiliários.", "S"],
    ["6612-6/03", "Corretoras de câmbio", "10.01", "Agenciamento, Corretagem De Seguros E Planos De Saúde.", "S"],
    ["6612-6/04", "Corretoras de contratos de mercadorias", "10.02", "Corretagem De Títulos E Valores Mobiliários.", "S"],
    ["6612-6/05", "Agentes de investimentos em aplicações financeiras", "10.02", "Corretagem De Títulos E Valores Mobiliários.", "N"],
    ["6612-6/05", "Agentes de investimentos em aplicações financeiras", "10.05", "Corretagem De Bens Móveis Ou Imóveis (Intermediação).", "S"],
    ["6612-6/05", "Agentes de investimentos em aplicações financeiras", "17.20", "Consultoria E Assessoria Financeira.", "N"],
    ["6613-4/00", "Administração de cartões de crédito", "15.01", "Administração de cartões de crédito...", "S"],
    ["6619-3/01", "SERVIÇOS DE LIQUIDAÇÃO E CUSTÓDIA", "15.10", "Serviços relacionados a cobranças...", "S"],
    ["6619-3/01", "SERVIÇOS DE LIQUIDAÇÃO E CUSTÓDIA", "15.12", "Custódia em geral...", "N"],
    ["6619-3/02", "CORRESPONDENTES DE INSTITUICOES FINANCEIRAS", "15.10", "Serviços relacionados a cobranças...", "S"],
    ["6619-3/03", "REPRESENTACOES DE BANCOS ESTRANGEIROS", "10.09", "Representação Comercial.", "S"],
    ["6619-3/04", "CAIXAS ELETRONICOS", "15.07", "Acesso, movimentação, atendimento...", "S"],
    ["6619-3/05", "OPERADORAS DE CARTOES DE DEBITO", "15.01", "Administração de cartões de crédito...", "S"],
    ["6619-3/99", "Outras atividades auxiliares dos serviços financeiros não especificadas anteriormente", "10.02", "Corretagem De Títulos E Valores Mobiliários.", "S"],
    ["6621-5/01", "Peritos e avaliadores de seguros", "17.09", "Perícias, Laudos, Exames Técnicos.", "N"],
    ["6621-5/01", "Peritos e avaliadores de seguros", "17.16", "Auditoria.", "S"],
    ["6621-5/01", "Peritos e avaliadores de seguros", "18.01", "Serviços de regulação de sinistros...", "N"],
    ["6621-5/01", "Peritos e avaliadores de seguros", "28.01", "Serviços de avaliação de bens...", "N"],
    ["6621-5/02", "Auditoria e consultoria atuarial", "17.16", "Auditoria.", "S"],
    ["6621-5/02", "Auditoria e consultoria atuarial", "17.18", "Atuária e cálculos técnicos de qualquer natureza.", "N"],
    ["6621-5/02", "Auditoria e consultoria atuarial", "17.20", "Consultoria E Assessoria Financeira.", "N"],
    ["6622-3/00", "Corretores e agentes de seguros, de planos de previdência complementar e de saúde", "10.01", "Agenciamento, Corretagem De Seguros E Planos De Saúde.", "S"],
    ["6622-3/00", "Corretores e agentes de seguros, de planos de previdência complementar e de saúde", "10.02", "Corretagem De Títulos E Valores Mobiliários.", "N"],
    ["6629-1/00", "Atividades auxiliares dos seguros, da previdência complementar e dos planos de saúde não especificadas anteriorme", "18.01", "Serviços de regulação de sinistros...", "S"],
    ["6630-4/00", "Atividades de administração de fundos por contrato ou comissão", "17.12-G", "Administração Em Geral, Inclusive De Bens E Negócios De Terceiros — Gestão de Negócios/Hospitalar (sem bem imóvel)", "S"],
    ["6821-8/01", "Corretagem na compra e venda e avaliação de imóveis", "10.05", "Corretagem De Bens Móveis Ou Imóveis (Intermediação).", "S"],
    ["6821-8/01", "Corretagem na compra e venda e avaliação de imóveis", "28.01", "Serviços de avaliação de bens...", "N"],
    ["6821-8/02", "Corretagem no aluguel de imóveis", "10.05", "Corretagem De Bens Móveis Ou Imóveis (Intermediação).", "S"],
    ["6822-6/00", "Gestão e administração da propriedade imobiliária", "17.12", "Administração Em Geral, Inclusive De Bens E Negócios De Terceiros — Administração de Imóveis de Terceiros", "S"],
    ["6911-7/01", "Serviços advocatícios", "17.14", "Advocacia.", "S"],
    ["6911-7/02", "Atividades auxiliares da justiça", "17.09", "Perícias, Laudos, Exames Técnicos.", "S"],
    ["6911-7/02", "Atividades auxiliares da justiça", "17.15", "Arbitragem de qualquer espécie...", "N"],
    ["6911-7/03", "Agente de propriedade industrial", "10.03", "Agenciamento, corretagem ou intermediação de direitos da propriedade...", "S"],
    ["6912-5/00", "Cartórios", "21.01", "Serviços de registros públicos...", "S"],
    ["6920-6/01", "Atividades de contabilidade", "17.19", "Contabilidade E Serviços Técnicos Auxiliares.", "S"],
    ["6920-6/02", "Atividades de consultoria e auditoria contábil e tributária", "17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "N"],
    ["6920-6/02", "Atividades de consultoria e auditoria contábil e tributária", "17.09", "Perícias, Laudos, Exames Técnicos.", "N"],
    ["6920-6/02", "Atividades de consultoria e auditoria contábil e tributária", "17.16", "Auditoria.", "S"],
    ["7020-4/00", "Atividades de consultoria em gestão empresarial, exceto consultoria técnica específica", "17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "N"],
    ["7020-4/00", "Atividades de consultoria em gestão empresarial, exceto consultoria técnica específica", "17.03", "Planejamento E Organização Técnica/Administrativa.", "N"],
    ["7020-4/00", "Atividades de consultoria em gestão empresarial, exceto consultoria técnica específica", "17.17", "Análise de Organização e Métodos.", "N"],
    ["7020-4/00", "Atividades de consultoria em gestão empresarial, exceto consultoria técnica específica", "17.20", "Consultoria E Assessoria Financeira.", "S"],
    ["7020-4/00", "Atividades de consultoria em gestão empresarial, exceto consultoria técnica específica", "35.01", "Serviços de reportagem, assessoria de imprensa...", "N"],
    ["7111-1/00", "Serviços de arquitetura", "07.01", "Engenharia, Agronomia, Arquitetura, Urbanismo.", "S"],
    ["7112-0/00", "Serviços de engenharia", "07.01", "Engenharia, Agronomia, Arquitetura, Urbanismo.", "S"],
    ["7112-0/00", "Serviços de engenharia", "07.03", "Elaboração De Projetos De Engenharia.", "N"],
    ["7112-0/00", "Serviços de engenharia", "07.19", "Acompanhamento e fiscalização da execução de obras de engenharia...", "N"],
    ["7112-0/00", "Serviços de engenharia", "17.09", "Perícias, Laudos, Exames Técnicos.", "N"],
    ["7112-0/00", "Serviços de engenharia", "28.01", "Serviços de avaliação de bens...", "N"],
    ["7119-7/01", "Serviços de cartografia, topografia e geodésia", "07.01", "Engenharia, Agronomia, Arquitetura, Urbanismo.", "S"],
    ["7119-7/01", "Serviços de cartografia, topografia e geodésia", "07.20", "Aerofotogrametria (inclusive interpretação), cartografia...", "N"],
    ["7119-7/02", "Atividades de estudos geológicos", "07.01", "Engenharia, Agronomia, Arquitetura, Urbanismo.", "S"],
    ["7119-7/02", "Atividades de estudos geológicos", "07.20", "Aerofotogrametria (inclusive interpretação), cartografia...", "N"],
    ["7119-7/03", "Serviços de desenho técnico relacionados à arquitetura e engenharia", "32.01", "Serviços de desenhos técnicos.", "S"],
    ["7119-7/04", "Serviços de perícia técnica relacionados à segurança do trabalho", "17.09", "Perícias, Laudos, Exames Técnicos.", "S"],
    ["7119-7/99", "Atividades técnicas relacionadas à engenharia e arquitetura não especificadas anteriormente", "07.20", "Aerofotogrametria (inclusive interpretação), cartografia...", "S"],
    ["7119-7/99", "Atividades técnicas relacionadas à engenharia e arquitetura não especificadas anteriormente", "31.01", "Serviços técnicos em edificações...", "N"],
    ["7120-1/00", "Testes e análises técnicas", "17.09", "Perícias, Laudos, Exames Técnicos.", "S"],
    ["7210-0/00", "Pesquisa e desenvolvimento experimental em ciências físicas e naturais", "02.01", "Serviços De Pesquisas E Desenvolvimento.", "N"],
    ["7210-0/00", "Pesquisa e desenvolvimento experimental em ciências físicas e naturais", "30.01", "Serviços de biologia, biotecnologia e química.", "S"],
    ["7220-7/00", "Pesquisa e desenvolvimento experimental em ciências sociais e humanas", "02.01", "Serviços De Pesquisas E Desenvolvimento.", "S"],
    ["7311-4/00", "Agências de publicidade", "17.06", "Propaganda E Publicidade.", "S"],
    ["7312-2/00", "Agenciamento de espaços para publicidade, exceto em veículos de comunicação", "10.08", "Agenciamento De Publicidade E Propaganda.", "S"],
    ["7319-0/01", "Criação e montagem de estandes para feiras e exposições", "17.06", "Propaganda E Publicidade.", "S"],
    ["7319-0/02", "Promoção de vendas", "17.06", "Propaganda E Publicidade.", "S"],
    ["7319-0/03", "Marketing direto", "17.06", "Propaganda E Publicidade.", "S"],
    ["7319-0/04", "Consultoria em publicidade", "17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "S"],
    ["7319-0/99", "Outras atividades de publicidade não especificadas anteriormente", "17.06", "Propaganda E Publicidade.", "S"],
    ["7320-3/00", "Pesquisas de mercado e de opinião pública", "17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "N"],
    ["7320-3/00", "Pesquisas de mercado e de opinião pública", "17.21", "Estatística.", "S"],
    ["7410-2/01", "Design", "23.01", "Serviços de programação e comunicação visual...", "S"],
    ["7410-2/01", "Design", "39.01", "Serviços de ourivesaria e lapidação.", "N"],
    ["7410-2/02", "Decoração de interiores", "07.11", "Decoração e jardinagem, inclusive corte e poda de árvores.", "S"],
    ["7420-0/01", "Atividades de produção de fotografias, exceto aérea e submarina", "13.03", "Fotografia e cinematografia, inclusive revelação.", "S"],
    ["7420-0/02", "Atividades de produção de fotografias aéreas e submarinas", "13.03", "Fotografia e cinematografia, inclusive revelação.", "S"],
    ["7420-0/03", "Laboratórios fotográficos", "13.03", "Fotografia e cinematografia, inclusive revelação.", "S"],
    ["7420-0/04", "Filmagem de festas e eventos", "13.03", "Fotografia e cinematografia, inclusive revelação.", "S"],
    ["7420-0/05", "Serviços de microfilmagem", "13.04", "Reprografia, Microfilmagem E Digitalização.", "S"],
    ["7490-1/01", "Serviços de tradução, interpretação e similares", "17.02", "Datilografia, Digitação, Secretaria Em Geral.", "S"],
    ["7490-1/02", "Escafandria e mergulho", "07.21", "Pesquisa, perfuração, cimentação, mergulho, perfilagem...", "S"],
    ["7490-1/02", "Escafandria e mergulho", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "N"],
    ["7490-1/03", "Serviços de agronomia e de consultoria às atividades agrícolas e pecuárias", "05.01", "Medicina Veterinária E Zootecnia.", "S"],
    ["7490-1/03", "Serviços de agronomia e de consultoria às atividades agrícolas e pecuárias", "17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "N"],
    ["7490-1/04", "Atividades de intermediação e agenciamento de serviços e negócios em geral, exceto imobiliários", "10.02", "Corretagem De Títulos E Valores Mobiliários.", "S"],
    ["7490-1/04", "Atividades de intermediação e agenciamento de serviços e negócios em geral, exceto imobiliários", "10.04", "Agenciamento, corretagem ou intermediação de contratos de arrendamento...", "N"],
    ["7490-1/04", "Atividades de intermediação e agenciamento de serviços e negócios em geral, exceto imobiliários", "10.08", "Agenciamento De Publicidade E Propaganda.", "N"],
    ["7490-1/05", "Agenciamento de profissionais para atividades esportivas, culturais e artísticas", "10.02", "Corretagem De Títulos E Valores Mobiliários.", "S"],
    ["7490-1/05", "Agenciamento de profissionais para atividades esportivas, culturais e artísticas", "10.03", "Agenciamento, corretagem ou intermediação de direitos da propriedade...", "N"],
    ["7490-1/05", "Agenciamento de profissionais para atividades esportivas, culturais e artísticas", "37.01", "Serviços de artistas, atletas...", "N"],
    ["7490-1/99", "Outras atividades profissionais, científicas e técnicas não especificadas anteriormente", "07.22", "Nucleação e bombardeamento de nuvens e congêneres.", "N"],
    ["7490-1/99", "Outras atividades profissionais, científicas e técnicas não especificadas anteriormente", "17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "N"],
    ["7490-1/99", "Outras atividades profissionais, científicas e técnicas não especificadas anteriormente", "17.02", "Datilografia, Digitação, Secretaria Em Geral.", "N"],
    ["7490-1/99", "Outras atividades profissionais, científicas e técnicas não especificadas anteriormente", "17.21", "Estatística.", "S"],
    ["7490-1/99", "Outras atividades profissionais, científicas e técnicas não especificadas anteriormente", "23.01", "Serviços de programação e comunicação visual...", "N"],
    ["7490-1/99", "Outras atividades profissionais, científicas e técnicas não especificadas anteriormente", "28.01", "Serviços de avaliação de bens...", "N"],
    ["7490-1/99", "Outras atividades profissionais, científicas e técnicas não especificadas anteriormente", "36.01", "Serviços de meteorologia.", "N"],
    ["7500-1/00", "Atividades veterinárias", "05.01", "Medicina Veterinária E Zootecnia.", "S"],
    ["7500-1/00", "Atividades veterinárias", "05.02", "Hospitais E Clínicas Veterinárias", "N"],
    ["7500-1/00", "Atividades veterinárias", "05.03", "Laboratórios de análise na área veterinária.", "N"],
    ["7500-1/00", "Atividades veterinárias", "05.05", "Bancos de sangue e de órgãos e congêneres (veterinária).", "N"],
    ["7500-1/00", "Atividades veterinárias", "05.06", "Coleta de sangue, leite, tecidos, sêmen, órgãos e materiais biológicos (veterinária).", "N"],
    ["7500-1/00", "Atividades veterinárias", "05.07", "Unidade de atendimento, assistência ou tratamento móvel (veterinária).", "N"],
    ["7732-2/02", "Aluguel de andaimes", "03.05", "Cessão De Andaimes, Palcos, Coberturas.", "S"],
    ["7739-0/03", "Aluguel de palcos, coberturas e outras estruturas de uso temporário, exceto andaimes", "03.05", "Cessão De Andaimes, Palcos, Coberturas.", "S"],
    ["7740-3/00", "Gestão de ativos intangíveis não-financeiros", "03.02", "Cessão De Direito De Uso De Marcas.", "S"],
    ["7740-3/00", "Gestão de ativos intangíveis não-financeiros", "17.08", "Franquia (franchising).", "N"],
    ["7740-3/00", "Gestão de ativos intangíveis não-financeiros", "17.12-G", "Administração Em Geral, Inclusive De Bens E Negócios De Terceiros — Gestão de Negócios/Hospitalar (sem bem imóvel)", "N"],
    ["7810-8/00", "Seleção e agenciamento de mão-de-obra", "17.04", "Recrutamento, agenciamento...", "S"],
    ["7820-5/00", "Locação de mão-de-obra temporária", "17.05", "Fornecimento E Locação De Mão-De-Obra.", "S"],
    ["7830-2/00", "Fornecimento e gestão de recursos humanos para terceiros", "17.05", "Fornecimento E Locação De Mão-De-Obra.", "S"],
    ["7911-2/00", "Agências de viagens", "09.02", "Agenciamento De Viagens E Turismo.", "S"],
    ["7912-1/00", "Operadores turísticos", "09.02", "Agenciamento De Viagens E Turismo.", "S"],
    ["7912-1/00", "Operadores turísticos", "09.03", "Guias de turismo.", "N"],
    ["7990-2/00", "Serviços de reservas e outros serviços de turismo não especificados anteriormente", "09.02", "Agenciamento De Viagens E Turismo.", "S"],
    ["8011-1/01", "Atividades de vigilância e segurança privada", "11.02", "Vigilância, Segurança Ou Monitoramento.", "S"],
    ["8011-1/02", "Serviços de adestramento de cães de guarda", "05.08", "Guarda, tratamento, amestramento, embelezamento, alojamento (animais).", "S"],
    ["8012-9/00", "Atividades de transporte de valores", "26.01", "Atividades de transporte de valores...", "S"],
    ["8020-0/00", "Atividades de monitoramento de sistemas de segurança", "11.02", "Vigilância, Segurança Ou Monitoramento.", "S"],
    ["8030-7/00", "Atividades de investigação particular", "34.01", "Serviços de investigações particulares...", "S"],
    ["8111-7/00", "Serviços combinados para apoio a edifícios, exceto condomínios prediais", "17.05", "Fornecimento E Locação De Mão-De-Obra.", "S"],
    ["8121-4/00", "Limpeza em prédios e em domicílios", "07.10", "Limpeza, Manutenção E Conservação De Imóveis.", "S"],
    ["8122-2/00", "Imunização e controle de pragas urbanas", "07.13", "Dedetização, desinfecção, desinsetização, imunização...", "S"],
    ["8129-0/00", "Atividades de limpeza não especificadas anteriormente", "07.09", "Varrição, Coleta E Remoção De Lixo.", "S"],
    ["8129-0/00", "Atividades de limpeza não especificadas anteriormente", "07.10", "Limpeza, Manutenção E Conservação De Imóveis.", "N"],
    ["8130-3/00", "Atividades paisagísticas", "07.11", "Decoração e jardinagem, inclusive corte e poda de árvores.", "S"],
    ["8211-3/00", "Serviços combinados de escritório e apoio administrativo", "03.03", "Exploração De Salões De Festas E Eventos.", "S"],
    ["8211-3/00", "Serviços combinados de escritório e apoio administrativo", "17.02", "Datilografia, Digitação, Secretaria Em Geral.", "N"],
    ["8211-3/00", "Serviços combinados de escritório e apoio administrativo", "17.03", "Planejamento E Organização Técnica/Administrativa.", "N"],
    ["8219-9/01", "Fotocópias", "13.04", "Reprografia, Microfilmagem E Digitalização.", "S"],
    ["8219-9/99", "Preparação de documentos e serviços especializados de apoio administrativo não especificados anteriormente", "17.02", "Datilografia, Digitação, Secretaria Em Geral.", "S"],
    ["8220-2/00", "Atividades de teleatendimento", "17.02", "Datilografia, Digitação, Secretaria Em Geral.", "S"],
    ["8230-0/01", "Serviços de organização de feiras, congressos, exposições e festas", "12.08", "Feiras, exposições, congressos e congêneres.", "S"],
    ["8230-0/01", "Serviços de organização de feiras, congressos, exposições e festas", "17.10", "Planejamento, organização de feiras...", "N"],
    ["8230-0/02", "Casas de festas e eventos", "03.03", "Exploração De Salões De Festas E Eventos.", "S"],
    ["8291-1/00", "Atividades de cobrança e informações cadastrais", "17.22", "Cobrança em geral.", "S"],
    ["8292-0/00", "Envasamento e empacotamento sob contrato", "14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "S"],
    ["8299-7/01", "Medição de consumo de energia elétrica, gás e água", "17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "S"],
    ["8299-7/02", "Emissão de vales-alimentação, vales-transporte e similares", "10.05", "Corretagem De Bens Móveis Ou Imóveis (Intermediação).", "S"],
    ["8299-7/03", "Serviços de gravação de carimbos, exceto confecção", "24.01", "Serviços de chaveiros, confecção de carimbos...", "S"],
    ["8299-7/04", "Leiloeiros independentes", "17.13", "Leilão e congêneres.", "S"],
    ["8299-7/05", "Serviços de levantamento de fundos sob contrato", "10.02", "Corretagem De Títulos E Valores Mobiliários.", "S"],
    ["8299-7/06", "Casas lotéricas", "19.01", "Serviços de distribuição e venda de bilhetes...", "S"],
    ["8299-7/99", "Outras atividades de serviços prestados principalmente às empresas não especificadas anteriormente", "17.02", "Datilografia, Digitação, Secretaria Em Geral.", "S"],
    ["8511-2/00", "Educação infantil – creche", "08.01", "Ensino Regular Pré-Escolar, Fundamental, Médio E Superior.", "S"],
    ["8512-1/00", "Educação infantil - pré-escola", "08.01", "Ensino Regular Pré-Escolar, Fundamental, Médio E Superior.", "S"],
    ["8513-9/00", "Ensino fundamental", "08.01", "Ensino Regular Pré-Escolar, Fundamental, Médio E Superior.", "S"],
    ["8520-1/00", "Ensino médio", "08.01", "Ensino Regular Pré-Escolar, Fundamental, Médio E Superior.", "S"],
    ["8531-7/00", "Educação superior – graduação", "08.01", "Ensino Regular Pré-Escolar, Fundamental, Médio E Superior.", "S"],
    ["8532-5/00", "Educação superior - graduação e pós- graduação", "08.01", "Ensino Regular Pré-Escolar, Fundamental, Médio E Superior.", "S"],
    ["8533-3/00", "Educação superior - pós-graduação e extensão", "08.01", "Ensino Regular Pré-Escolar, Fundamental, Médio E Superior.", "S"],
    ["8541-4/00", "Educação profissional de nível técnico", "08.01", "Ensino Regular Pré-Escolar, Fundamental, Médio E Superior.", "S"],
    ["8542-2/00", "Educação profissional de nível tecnológico", "08.01", "Ensino Regular Pré-Escolar, Fundamental, Médio E Superior.", "S"],
    ["8550-3/02", "Atividades de apoio à educação, exceto caixas escolares", "08.02", "Instrução, Treinamento, Orientação Pedagógica.", "S"],
    ["8591-1/00", "Ensino de esportes", "06.04", "Ginástica, dança, esportes, natação, artes marciais e demais atividades físicas.", "S"],
    ["8592-9/01", "Ensino de dança", "06.04", "Ginástica, dança, esportes, natação, artes marciais e demais atividades físicas.", "S"],
    ["8592-9/02", "Ensino de artes cênicas, exceto dança", "08.02", "Instrução, Treinamento, Orientação Pedagógica.", "S"],
    ["8592-9/03", "Ensino de música", "08.02", "Instrução, Treinamento, Orientação Pedagógica.", "S"],
    ["8592-9/99", "Ensino de arte e cultura não especificado anteriormente", "08.02", "Instrução, Treinamento, Orientação Pedagógica.", "S"],
    ["8593-7/00", "Ensino de idiomas", "08.02", "Instrução, Treinamento, Orientação Pedagógica.", "S"],
    ["8599-6/01", "Formação de condutores", "08.02", "Instrução, Treinamento, Orientação Pedagógica.", "S"],
    ["8599-6/02", "Cursos de pilotagem", "08.02", "Instrução, Treinamento, Orientação Pedagógica.", "S"],
    ["8599-6/03", "Treinamento em informática", "08.02", "Instrução, Treinamento, Orientação Pedagógica.", "S"],
    ["8599-6/04", "Treinamento em desenvolvimento profissional e gerencial", "08.02", "Instrução, Treinamento, Orientação Pedagógica.", "S"],
    ["8599-6/05", "Cursos preparatórios para concursos", "08.02", "Instrução, Treinamento, Orientação Pedagógica.", "S"],
    ["8599-6/99", "Outras atividades de ensino não especificadas anteriormente", "08.02", "Instrução, Treinamento, Orientação Pedagógica.", "S"],
    ["8599-6/99", "Outras atividades de ensino não especificadas anteriormente", "17.24", "Apresentação De Palestras E Conferências.", "N"],
    ["8610-1/01", "Atividades de atendimento hospitalar, exceto pronto-socorro e unidades para atendimento a urgências", "04.03", "Hospitais, Clínicas, Laboratórios E Prontos-Socorros.", "S"],
    ["8610-1/02", "Atividades de atendimento em pronto-socorro e unidades hospitalares para atendimento a urgências", "04.03", "Hospitais, Clínicas, Laboratórios E Prontos-Socorros.", "S"],
    ["8621-6/01", "UTI móvel", "04.21", "Unidade de atendimento, assistência ou tratamento móvel (humano).", "S"],
    ["8621-6/02", "Serviços móveis de atendimento a urgências, exceto por UTI móvel", "04.21", "Unidade de atendimento, assistência ou tratamento móvel (humano).", "S"],
    ["8622-4/00", "Serviços de remoção de pacientes, exceto os serviços móveis de atendimento a urgências", "04.21", "Unidade de atendimento, assistência ou tratamento móvel (humano).", "S"],
    ["8630-5/01", "Atividade médica ambulatorial com recursos para realização de procedimentos cirúrgicos", "04.03", "Hospitais, Clínicas, Laboratórios E Prontos-Socorros.", "S"],
    ["8630-5/02", "Atividade médica ambulatorial com recursos para realização de exames complementares", "04.01", "Medicina E Biomedicina.", "S"],
    ["8630-5/02", "Atividade médica ambulatorial com recursos para realização de exames complementares", "04.03", "Hospitais, Clínicas, Laboratórios E Prontos-Socorros.", "N"],
    ["8630-5/03", "Atividade médica ambulatorial restrita a consultas", "04.01", "Medicina E Biomedicina.", "S"],
    ["8630-5/04", "Atividade odontológica", "04.12", "Odontologia.", "S"],
    ["8630-5/06", "Serviços de vacinação e imunização humana", "04.03", "Hospitais, Clínicas, Laboratórios E Prontos-Socorros.", "S"],
    ["8630-5/07", "Atividades de reprodução humana assistida", "04.18", "Inseminação artificial, fertilização in vitro e congêneres.", "S"],
    ["8630-5/07", "Atividades de reprodução humana assistida", "04.19", "Bancos De Sangue, Leite, Órgãos.", "N"],
    ["8630-5/99", "Atividades de atenção ambulatorial não especificadas anteriormente", "04.01", "Medicina E Biomedicina.", "S"],
    ["8640-2/01", "Laboratórios de anatomia patológica e citológica", "04.02", "Análises Clínicas, Patologia E Exames.", "S"],
    ["8640-2/01", "Laboratórios de anatomia patológica e citológica", "04.03", "Hospitais, Clínicas, Laboratórios E Prontos-Socorros.", "N"],
    ["8640-2/02", "Laboratórios clínicos", "04.02", "Análises Clínicas, Patologia E Exames.", "S"],
    ["8640-2/02", "Laboratórios clínicos", "04.03", "Hospitais, Clínicas, Laboratórios E Prontos-Socorros.", "N"],
    ["8640-2/02", "Laboratórios clínicos", "04.20", "Coleta de sangue, leite, tecidos, sêmen, órgãos e materiais biológicos (humano).", "N"],
    ["8640-2/02", "Laboratórios clínicos", "30.01", "Serviços de biologia, biotecnologia e química.", "N"],
    ["8640-2/03", "Serviços de diálise e nefrologia", "04.03", "Hospitais, Clínicas, Laboratórios E Prontos-Socorros.", "S"],
    ["8640-2/04", "Serviços de tomografia", "04.02", "Análises Clínicas, Patologia E Exames.", "S"],
    ["8640-2/05", "Serviços de diagnóstico por imagem com uso de radiação ionizante, exceto tomografia", "04.02", "Análises Clínicas, Patologia E Exames.", "S"],
    ["8640-2/06", "Serviços de ressonância magnética", "04.02", "Análises Clínicas, Patologia E Exames.", "S"],
    ["8640-2/07", "Serviços de diagnóstico por imagem sem uso de radiação ionizante, exceto ressonância magnética", "04.02", "Análises Clínicas, Patologia E Exames.", "S"],
    ["8640-2/08", "Serviços de diagnóstico por registro gráfico - ECG, EEG e outros exames análogos", "04.02", "Análises Clínicas, Patologia E Exames.", "S"],
    ["8640-2/09", "Serviços de diagnóstico por métodos ópticos - endoscopia e outros exames análogos", "04.02", "Análises Clínicas, Patologia E Exames.", "S"],
    ["8640-2/10", "Serviços de quimioterapia", "04.02", "Análises Clínicas, Patologia E Exames.", "S"],
    ["8640-2/11", "Serviços de radioterapia", "04.02", "Análises Clínicas, Patologia E Exames.", "S"],
    ["8640-2/12", "Serviços de hemoterapia", "04.09", "Terapias Físicas, Orgânicas E Mentais.", "S"],
    ["8640-2/12", "Serviços de hemoterapia", "04.19", "Bancos De Sangue, Leite, Órgãos.", "N"],
    ["8640-2/13", "Serviços de litotripsia", "04.03", "Hospitais, Clínicas, Laboratórios E Prontos-Socorros.", "S"],
    ["8640-2/14", "Serviços de bancos de células e tecidos humanos", "04.19", "Bancos De Sangue, Leite, Órgãos.", "S"],
    ["8640-2/99", "Atividades de serviços de complementação diagnóstica e terapêutica não especificadas anteriormente", "04.02", "Análises Clínicas, Patologia E Exames.", "S"],
    ["8640-2/99", "Atividades de serviços de complementação diagnóstica e terapêutica não especificadas anteriormente", "04.09", "Terapias Físicas, Orgânicas E Mentais.", "N"],
    ["8650-0/01", "Atividades de enfermagem", "04.06", "Enfermagem, Inclusive Serviços Auxiliares.", "S"],
    ["8650-0/02", "Atividades de profissionais da nutrição", "04.10", "Nutrição.", "S"],
    ["8650-0/03", "Atividades de psicologia e psicanálise", "04.15", "Psicanálise.", "S"],
    ["8650-0/03", "Atividades de psicologia e psicanálise", "04.16", "Psicologia.", "N"],
    ["8650-0/04", "Atividades de fisioterapia", "04.08", "Terapia Ocupacional, Fisioterapia E Fonoaudiologia.", "S"],
    ["8650-0/05", "Atividades de terapia ocupacional", "04.08", "Terapia Ocupacional, Fisioterapia E Fonoaudiologia.", "S"],
    ["8650-0/06", "Atividades de fonoaudiologia", "04.08", "Terapia Ocupacional, Fisioterapia E Fonoaudiologia.", "S"],
    ["8650-0/07", "Atividades de terapia de nutrição enteral e parenteral", "04.09", "Terapias Físicas, Orgânicas E Mentais.", "S"],
    ["8650-0/99", "Atividades de profissionais da área de saúde não especificadas anteriormente", "04.04", "Instrumentação Cirúrgica.", "S"],
    ["8650-0/99", "Atividades de profissionais da área de saúde não especificadas anteriormente", "04.13", "Ortóptica.", "N"],
    ["8660-7/00", "Atividades de apoio à gestão de saúde", "17.12-G", "Administração Em Geral, Inclusive De Bens E Negócios De Terceiros — Gestão de Negócios/Hospitalar (sem bem imóvel)", "S"],
    ["8690-9/01", "Atividades de práticas integrativas e complementares em saúde humana", "04.05", "Acupuntura.", "S"],
    ["8690-9/01", "Atividades de práticas integrativas e complementares em saúde humana", "04.09", "Terapias Físicas, Orgânicas E Mentais.", "N"],
    ["8690-9/02", "Atividades de bancos de leite humano", "04.19", "Bancos De Sangue, Leite, Órgãos.", "S"],
    ["8690-9/03", "Atividades de acumputura", "04.05", "Acupuntura.", "S"],
    ["8690-9/04", "Atividades de podologia", "06.01", "Barbearia, Cabeleireiros, Manicuros.", "S"],
    ["8690-9/99", "Outras atividades de atenção à saúde humana não especificadas anteriormente", "04.09", "Terapias Físicas, Orgânicas E Mentais.", "S"],
    ["8690-9/99", "Outras atividades de atenção à saúde humana não especificadas anteriormente", "04.11", "Obstetrícia.", "N"],
    ["8690-9/99", "Outras atividades de atenção à saúde humana não especificadas anteriormente", "04.19", "Bancos De Sangue, Leite, Órgãos.", "N"],
    ["8711-5/01", "Clínicas e residências geriátricas", "04.17", "Casas De Repouso, Creches E Asilos.", "S"],
    ["8711-5/02", "Instituições de longa permanência para idosos", "04.17", "Casas De Repouso, Creches E Asilos.", "S"],
    ["8711-5/03", "Atividades de assistência a deficientes físicos, imunodeprimidos e convalescentes", "04.17", "Casas De Repouso, Creches E Asilos.", "S"],
    ["8711-5/04", "Centros de apoio a pacientes com câncer e com AIDS", "04.17", "Casas De Repouso, Creches E Asilos.", "S"],
    ["8711-5/05", "Condomínios residenciais para idosos", "04.17", "Casas De Repouso, Creches E Asilos.", "S"],
    ["8712-3/00", "Atividades de fornecimento de infra-estrutura de apoio e assistência a paciente no domicílio", "04.21", "Unidade de atendimento, assistência ou tratamento móvel (humano).", "S"],
    ["8720-4/01", "Atividades de centros de assistência psicossocial", "04.17", "Casas De Repouso, Creches E Asilos.", "S"],
    ["8720-4/99", "Atividades de assistência psicossocial e à saúde a portadores de distúrbios psíquicos, deficiência mental e dependência química não especificadas anteriormente", "04.17", "Casas De Repouso, Creches E Asilos.", "S"],
    ["8730-1/01", "Orfanatos", "04.17", "Casas De Repouso, Creches E Asilos.", "S"],
    ["8730-1/02", "Albergues assistencias", "04.17", "Casas De Repouso, Creches E Asilos.", "S"],
    ["8730-1/99", "Atividades de assistência social prestadas em residências coletivas e particulares não especificadas anteriormente", "04.17", "Casas De Repouso, Creches E Asilos.", "S"],
    ["8800-6/00", "Serviços de assistência social sem alojamento", "27.01", "Serviços de assistência social.", "S"],
    ["9001-9/01", "Produção teatral", "12.01", "Espetáculos teatrais.", "S"],
    ["9001-9/01", "Produção teatral", "12.13", "Produção, mediante ou sem encomenda prévia, de eventos.", "N"],
    ["9001-9/02", "Produção musical", "12.07", "Shows, ballet, danças, desfiles, bailes.", "S"],
    ["9001-9/02", "Produção musical", "12.12", "Execução de música.", "N"],
    ["9001-9/02", "Produção musical", "12.13", "Produção, mediante ou sem encomenda prévia, de eventos.", "N"],
    ["9001-9/02", "Produção musical", "12.14", "Fornecimento de música para ambientes fechados ou não.", "N"],
    ["9001-9/02", "Produção musical", "12.15", "Desfiles de blocos carnavalescos ou folclóricos.", "N"],
    ["9001-9/02", "Produção musical", "12.16", "Exibição de filmes, entrevistas, musicais.", "N"],
    ["9001-9/03", "Produção de espetáculos de dança", "12.07", "Shows, ballet, danças, desfiles, bailes.", "S"],
    ["9001-9/03", "Produção de espetáculos de dança", "12.13", "Produção, mediante ou sem encomenda prévia, de eventos.", "N"],
    ["9001-9/03", "Produção de espetáculos de dança", "12.15", "Desfiles de blocos carnavalescos ou folclóricos.", "N"],
    ["9001-9/04", "Produção de espetáculos circenses, de marionetes e similares", "12.03", "Espetáculos circenses.", "S"],
    ["9001-9/04", "Produção de espetáculos circenses, de marionetes e similares", "12.13", "Produção, mediante ou sem encomenda prévia, de eventos.", "N"],
    ["9001-9/05", "Produção de espetáculos de rodeios, vaquejadas e similares", "12.10", "Corridas e competições de animais.", "S"],
    ["9001-9/06", "Atividades de sonorização e de iluminação", "12.14", "Fornecimento de música para ambientes fechados ou não.", "S"],
    ["9001-9/99", "Artes cênicas, espetáculos e atividades complementares não especificados anteriormente", "12.01", "Espetáculos teatrais.", "S"],
    ["9001-9/99", "Artes cênicas, espetáculos e atividades complementares não especificados anteriormente", "12.03", "Espetáculos circenses.", "N"],
    ["9001-9/99", "Artes cênicas, espetáculos e atividades complementares não especificados anteriormente", "12.04", "Programas de auditório.", "N"],
    ["9001-9/99", "Artes cênicas, espetáculos e atividades complementares não especificados anteriormente", "12.05", "Parques de diversões, centros de lazer e congêneres.", "N"],
    ["9002-7/01", "Atividades de artistas plásticos, jornalistas independentes e escritores", "35.01", "Serviços de reportagem, assessoria de imprensa...", "S"],
    ["9002-7/01", "Atividades de artistas plásticos, jornalistas independentes e escritores", "40.01", "Obras de arte sob encomenda.", "N"],
    ["9002-7/02", "Restauração de obras de arte", "14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "S"],
    ["9003-5/00", "Gestão de espaços para artes cênicas, espetáculos e outras atividades artísticas", "03.03", "Exploração De Salões De Festas E Eventos.", "S"],
    ["9101-5/00", "Atividades de bibliotecas e arquivos", "29.01", "Serviços de biblioteconomia.", "S"],
    ["9102-3/01", "Atividades de museus e de exploração de lugares e prédios históricos e atrações similares", "38.01", "Serviços de museologia.", "S"],
    ["9102-3/02", "Restauração e conservação de lugares e prédios históricos", "07.05", "Reforma E Manutenção De Edifícios.", "S"],
    ["9103-1/00", "Atividades de jardins botânicos, zoológicos, parques nacionais, reservas ecológicas e áreas de proteção ambiental", "12.05", "Parques de diversões, centros de lazer e congêneres.", "S"],
    ["9200-3/01", "Casas de bingo", "19.01", "Serviços de distribuição e venda de bilhetes...", "S"],
    ["9200-3/02", "Exploração de apostas em corridas de cavalos", "12.10", "Corridas e competições de animais.", "S"],
    ["9200-3/99", "Exploração de jogos de azar e apostas não especificados anteriormente", "12.09", "Bilhares, boliches e diversões eletrônicas ou não.", "S"],
    ["9200-3/99", "Exploração de jogos de azar e apostas não especificados anteriormente", "19.01", "Serviços de distribuição e venda de bilhetes...", "N"],
    ["9311-5/00", "Gestão de instalações de esportes", "03.03", "Exploração De Salões De Festas E Eventos.", "S"],
    ["9312-3/00", "CLUBES SOCIAIS, ESPORTIVOS E SIMILARES", "08.02", "Instrução, Treinamento, Orientação Pedagógica.", "S"],
    ["9313-1/00", "Atividades de condicionamento físico", "06.04", "Ginástica, dança, esportes, natação, artes marciais e demais atividades físicas.", "S"],
    ["9319-1/01", "Produção e promoção de eventos esportivos", "12.11", "Competições esportivas ou de destreza física ou intelectual.", "S"],
    ["9319-1/99", "Outras atividades esportivas não especificadas anteriormente", "12.11", "Competições esportivas ou de destreza física ou intelectual.", "S"],
    ["9321-2/00", "Parques de diversão e parques temáticos", "12.05", "Parques de diversões, centros de lazer e congêneres.", "S"],
    ["9329-8/01", "Discotecas, danceterias, salões de dança e similares", "12.06", "Boates, taxi dancing e congêneres.", "S"],
    ["9329-8/02", "Exploração de boliches", "12.09", "Bilhares, boliches e diversões eletrônicas ou não.", "S"],
    ["9329-8/03", "Exploração de jogos de sinuca, bilhar e similares", "12.09", "Bilhares, boliches e diversões eletrônicas ou não.", "S"],
    ["9329-8/04", "Exploração de jogos eletrônicos recreativos", "12.09", "Bilhares, boliches e diversões eletrônicas ou não.", "S"],
    ["9329-8/99", "Outras atividades de recreação e lazer não especificadas anteriormente", "11.01", "Guarda E Estacionamento De Veículos.", "S"],
    ["9329-8/99", "Outras atividades de recreação e lazer não especificadas anteriormente", "12.17", "Recreação e animação, inclusive em festas e eventos.", "N"],
    ["9430-8/00", "Atividades de associação de defesa de direitos sociais", "17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "S"],
    ["9493-6/00", "Atividades de organizações associativas ligadas à cultura e à arte", "12.15", "Desfiles de blocos carnavalescos ou folclóricos.", "S"],
    ["9511-8/00", "Reparação e manutenção de computadores e de equipamentos periféricos", "14.02", "Assistência Técnica.", "S"],
    ["9512-6/00", "Reparação e manutenção de equipamentos de comunicação", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["9512-6/00", "Reparação e manutenção de equipamentos de comunicação", "14.02", "Assistência Técnica.", "N"],
    ["9521-5/00", "Reparação e manutenção de equipamentos eletroeletrônicos de uso pessoal e doméstico", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["9529-1/01", "Reparação de calçados, bolsas e artigos de viagem", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["9529-1/02", "Chaveiros", "24.01", "Serviços de chaveiros, confecção de carimbos...", "S"],
    ["9529-1/03", "Reparação de relógios", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["9529-1/04", "Reparação de bicicletas, triciclos e outros veículos não-motorizados", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["9529-1/05", "Reparação de artigos do mobiliário", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["9529-1/05", "Reparação de artigos do mobiliário", "14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "N"],
    ["9529-1/05", "Reparação de artigos do mobiliário", "14.11", "Tapeçaria e reforma de estofamentos em geral.", "N"],
    ["9529-1/06", "Reparação de jóias", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["9529-1/99", "Reparação e manutenção de outros objetos e equipamentos pessoais e domésticos não especificados anteriormente", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "S"],
    ["9529-1/99", "Reparação e manutenção de outros objetos e equipamentos pessoais e domésticos não especificados anteriormente", "14.09", "Alfaiataria e costura, quando o material for fornecido pelo usuário final...", "N"],
    ["9601-7/01", "Lavanderias", "14.10", "Tinturaria e lavanderia.", "S"],
    ["9601-7/02", "Tinturarias", "14.10", "Tinturaria e lavanderia.", "S"],
    ["9601-7/03", "Toalheiros", "14.10", "Tinturaria e lavanderia.", "S"],
    ["9602-5/01", "Cabeleireiros", "06.01", "Barbearia, Cabeleireiros, Manicuros.", "S"],
    ["9602-5/02", "Atividades de estética e outros serviços de cuidados com a beleza", "06.01", "Barbearia, Cabeleireiros, Manicuros.", "S"],
    ["9602-5/02", "Atividades de estética e outros serviços de cuidados com a beleza", "06.02", "Esteticistas, Tratamento De Pele.", "N"],
    ["9603-3/01", "Gestão e manutenção de cemitérios", "25.04", "Manutenção e conservação de jazigos e cemitérios.", "S"],
    ["9603-3/02", "Serviços de cremação", "25.02", "Cremação de corpos...", "S"],
    ["9603-3/03", "Serviços de sepultamento", "25.01", "Funerais...", "S"],
    ["9603-3/04", "Serviços de funerárias", "25.01", "Funerais...", "S"],
    ["9603-3/05", "Serviços de somatoconservação", "25.01", "Funerais...", "S"],
    ["9603-3/99", "Atividades funerárias e serviços relacionados não especificados anteriormente", "25.01", "Funerais...", "S"],
    ["9609-2/01", "Clínicas de estética e similares", "06.02", "Esteticistas, Tratamento De Pele.", "S"],
    ["9609-2/01", "Clínicas de estética e similares", "06.03", "Banhos, duchas, sauna, massagens e congêneres.", "N"],
    ["9609-2/01", "Clínicas de estética e similares", "06.05", "Centros de emagrecimento, spa e congêneres.", "N"],
    ["9609-2/02", "Agências matrimoniais", "10.02", "Corretagem De Títulos E Valores Mobiliários.", "S"],
    ["9609-2/03", "Alojamento, higiene e embelezamento de animais", "05.08", "Guarda, tratamento, amestramento, embelezamento, alojamento (animais).", "S"],
    ["9609-2/04", "Exploração de máquinas de serviços pessoais acionados po moeda", "13.03", "Fotografia e cinematografia, inclusive revelação.", "S"],
    ["9609-2/05", "Atividades de sauna e banhos", "06.03", "Banhos, duchas, sauna, massagens e congêneres.", "S"],
    ["9609-2/06", "Serviços de tatuagem e colocação de piercing", "06.02", "Esteticistas, Tratamento De Pele.", "S"],
    ["9609-2/99", "Outras atividades de serviços pessoais não especificadas anteriormente", "06.02", "Esteticistas, Tratamento De Pele.", "S"],
    ["9609-2/99", "Outras atividades de serviços pessoais não especificadas anteriormente", "14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "N"],
    ["9609-2/99", "Outras atividades de serviços pessoais não especificadas anteriormente", "14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "N"],
    ["9609-2/99", "Outras atividades de serviços pessoais não especificadas anteriormente", "17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "N"],
    ["9609-2/99", "Outras atividades de serviços pessoais não especificadas anteriormente", "17.12-G", "Administração Em Geral, Inclusive De Bens E Negócios De Terceiros — Gestão de Negócios/Hospitalar (sem bem imóvel)", "N"]
];

// Banco de Dados Item da Lista x NBS x Redução — 198 itens. BASE ÚNICA:
// substitui a antiga aba "Página4", descontinuada.
// Item | Descrição | NBS | Redução | Fundamento legal | cClassTrib | Auditoria
// Inclui as correções auditadas contra o cClassTrib do Anexo VIII
// (17.21, 27.01, 29.01 e 30.01 -> 30%; 09.03 -> 40%).
// ATENÇÃO ao item 17.12: no Anexo VIII ele tem duas famílias de NBS com tratamentos
// opostos — 1.1001.11.00/12.90 (cClassTrib 200046, bens imóveis, COM redução) e
// 1.1401.21.00/22.00 (cClassTrib 000001, tributação integral, SEM redução). Por isso
// a chave "17.12" ficou com a família imobiliária e "17.12-G" com a de gestão.
const DADOS_NBS_BASE = [
    ["01.01", "Análise E Desenvolvimento De Sistemas.", "1.1502.10.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — sujeita à alíquota padrão (cheia) de IBS/CBS (art. 156-A da CF/88; regra geral da LC 214/2025).", "000001, 200043, 200044", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento à administração pública dos; Operações e prestações de serviços de se). O 0% vale para as NBS de tributação integral."],
    ["01.02", "Programação.", "1.1502.10.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — sujeita à alíquota padrão (cheia) de IBS/CBS (art. 156-A da CF/88; regra geral da LC 214/2025).", "000001, 200043, 200044", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento à administração pública dos; Operações e prestações de serviços de se). O 0% vale para as NBS de tributação integral."],
    ["01.03", "Processamento, Armazenamento Ou Hospedagem De Dados.", "1.1506.10.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — sujeita à alíquota padrão (cheia) de IBS/CBS (art. 156-A da CF/88; regra geral da LC 214/2025).", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["01.04", "Elaboração De Programas De Computadores e Jogos.", "1.1502.10.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — sujeita à alíquota padrão (cheia) de IBS/CBS (art. 156-A da CF/88; regra geral da LC 214/2025).", "000001, 200043, 200044", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento à administração pública dos; Operações e prestações de serviços de se). O 0% vale para as NBS de tributação integral."],
    ["01.05", "Licenciamento Ou Cessão De Direito De Uso De Programas.", "1.1103.21.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — sujeita à alíquota padrão (cheia) de IBS/CBS (art. 156-A da CF/88; regra geral da LC 214/2025).", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["01.06", "Assessoria E Consultoria Em Informática.", "1.1501.10.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — sujeita à alíquota padrão (cheia) de IBS/CBS (art. 156-A da CF/88; regra geral da LC 214/2025).", "000001, 200043, 200044", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento à administração pública dos; Operações e prestações de serviços de se). O 0% vale para as NBS de tributação integral."],
    ["01.07", "Suporte Técnico Em Informática.", "1.1501.30.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — sujeita à alíquota padrão (cheia) de IBS/CBS (art. 156-A da CF/88; regra geral da LC 214/2025).", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["01.08", "Planejamento e Manutenção De Páginas Eletrônicas.", "1.1502.30.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — sujeita à alíquota padrão (cheia) de IBS/CBS (art. 156-A da CF/88; regra geral da LC 214/2025).", "000001, 200040", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento de serviços de comunicação ). O 0% vale para as NBS de tributação integral."],
    ["02.01", "Serviços De Pesquisas E Desenvolvimento.", "1.1201.11.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — sujeita à alíquota padrão (cheia) de IBS/CBS (art. 156-A da CF/88; regra geral da LC 214/2025).", "000001, 200016", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Prestação de serviços de pesquisa e dese). O 0% vale para as NBS de tributação integral."],
    ["03.02", "Cessão De Direito De Uso De Marcas.", "1.1103.33.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — sujeita à alíquota padrão (cheia) de IBS/CBS (art. 156-A da CF/88; regra geral da LC 214/2025).", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["03.03", "Exploração De Salões De Festas E Eventos.", "1.1805.31.00", 0.7, "Exploração de espaço (bem imóvel) para eventos, equiparada a cessão/locação de imóvel — cClassTrib 200027, art. 261 da LC 214/2025 (Regime Específico de Bens Imóveis): redução de 70%. Verificado o Anexo X completo (produções de eventos/artísticas, 60%) — o NBS 1.1805.31.00 não consta nele; tributa-se a cessão do espaço (imóvel), não a produção do evento.", "200027", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["03.04", "Locação e Arrendamento de Bens.", "1.1001.12.10", 0.7, "Locação, cessão onerosa ou direito de passagem sobre bem imóvel (ferrovia, postes, cabos, dutos) — cClassTrib 200027, art. 261 da LC 214/2025 (Regime Específico de Bens Imóveis): redução de 70%.", "200027", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["03.05", "Cessão De Andaimes, Palcos, Coberturas.", "1.0105.70.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — sujeita à alíquota padrão (cheia) de IBS/CBS (art. 156-A da CF/88; regra geral da LC 214/2025).", "000001, 200039", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento dos serviços e o licenciame). O 0% vale para as NBS de tributação integral."],
    ["04.01", "Medicina E Biomedicina.", "1.2301.22.00", 0.6, "Serviços médicos especializados — Anexo III da LC 214/2025, item 8 (NBS 1.2301.22.00): redução de 60% no IBS/CBS.", "200029", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["04.02", "Análises Clínicas, Patologia E Exames.", "1.2301.93.00", 0.6, "Serviços laboratoriais — Anexo III da LC 214/2025, item 12 (NBS 1.2301.93.00): redução de 60%.", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.03", "Hospitais, Clínicas, Laboratórios E Prontos-Socorros.", "1.2301.11.00", 0.6, "Serviços cirúrgicos — Anexo III da LC 214/2025, item 1 (NBS 1.2301.11.00): redução de 60%.", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.04", "Instrumentação Cirúrgica.", "1.2301.11.00", 0.6, "Serviços cirúrgicos (instrumentação) — Anexo III da LC 214/2025, item 1 (NBS 1.2301.11.00): redução de 60%.", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.05", "Acupuntura.", "1.2301.99.00", 0.6, "O Anexo III da LC 214/2025 não nomeia \"acupuntura\" expressamente, mas a NBS 1.2301.99.00 é o código residual \"serviços de saúde não classificados em subposição própria\", usado no próprio Anexo III para epidemiologia, vacinação, fonoaudiologia, nutrição, optometria, instrumentação cirúrgica, biomedicina e farmacêuticos (itens 18 a 26). Acupuntura, como prática de saúde reconhecida (Resolução CFM), enquadra-se no mesmo código residual — redução de 60%.", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.06", "Enfermagem, Inclusive Serviços Auxiliares.", "1.2301.91.00", 0.6, "Serviços de enfermagem — Anexo III da LC 214/2025, item 10 (NBS 1.2301.91.00): redução de 60%.", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.07", "Serviços farmacêuticos", "1.2301.99.00", 0.6, "Serviços farmacêuticos — Anexo III da LC 214/2025, item 26 (NBS 1.2301.99.00): redução de 60%.", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.08", "Terapia Ocupacional, Fisioterapia E Fonoaudiologia.", "1.2301.92.00", 0.6, "Serviços de fisioterapia — Anexo III da LC 214/2025, item 11 (NBS 1.2301.92.00): redução de 60%. O item 4.08 (terapia ocupacional/fisioterapia/fonoaudiologia) foi mapeado ao NBS de fisioterapia; fonoaudiologia tem NBS própria (1.2301.99.00, item 21), também no Anexo III.", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.09", "Terapias Físicas, Orgânicas E Mentais.", "1.2301.99.00", 0.6, "Código residual de saúde do Anexo III da LC 214/2025 (itens 18 a 26, NBS 1.2301.99.00): redução de 60%.", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.10", "Nutrição.", "1.2301.99.00", 0.6, "Serviços de nutrição — Anexo III da LC 214/2025, item 22 (NBS 1.2301.99.00): redução de 60%.", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.11", "Obstetrícia.", "1.2301.12.00", 0.6, "Serviços ginecológicos e obstétricos — Anexo III da LC 214/2025, item 2 (NBS 1.2301.12.00): redução de 60%.", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.12", "Odontologia.", "1.2301.23.00", 0.6, "Serviços odontológicos — Anexo III da LC 214/2025, item 9 (NBS 1.2301.23.00): redução de 60%.", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.13", "Ortóptica.", "", 0.6, "Serviços de saúde humana — Anexo III LC 214/2025 (NBS 1.2301.99.00), mesmo fundamento de 04.01/04.02", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.14", "Próteses Sob Encomenda.", "1.2301.99.00", 0.6, "Código residual de saúde do Anexo III da LC 214/2025 (NBS 1.2301.99.00): redução de 60%. Próteses sob encomenda como serviço de saúde; dispositivos médicos como bem têm regime próprio no Anexo IV.", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.15", "Psicanálise.", "1.2301.22.00", 0.6, "Serviços médicos especializados — Anexo III da LC 214/2025, item 8 (NBS 1.2301.22.00): redução de 60%.", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.16", "Psicologia.", "1.2301.98.00", 0.6, "Serviços de psicologia — Anexo III da LC 214/2025, item 17 (NBS 1.2301.98.00): redução de 60%.", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.17", "Casas De Repouso, Creches E Asilos.", "1.2201.11.00", 0.6, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — sujeita à alíquota padrão (cheia) de IBS/CBS (art. 156-A da CF/88; regra geral da LC 214/2025).", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.18", "Inseminação artificial, fertilização in vitro e congêneres.", "", 0.6, "Serviços de saúde humana — Anexo III LC 214/2025 (NBS 1.2301.21.00)", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.19", "Bancos De Sangue, Leite, Órgãos.", "1.2301.95.00", 0.6, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — sujeita à alíquota padrão (cheia) de IBS/CBS (art. 156-A da CF/88; regra geral da LC 214/2025).", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.20", "Coleta de sangue, leite, tecidos, sêmen, órgãos e materiais biológicos (humano).", "", 0.6, "Serviços de saúde humana — Anexo III LC 214/2025 (NBS 1.2301.95.00)", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.21", "Unidade de atendimento, assistência ou tratamento móvel (humano).", "", 0.6, "Serviços de saúde humana — Anexo III LC 214/2025 (NBS 1.2301.96.00, ambulância)", "", "ℹ️ NBS não consta nesta versão do Anexo VIII — redução vem do Anexo da LC 214/2025, não auditável por este arquivo."],
    ["04.22", "Planos De Saúde E Convênios Médicos.", "1.0910.10.00", 0.6, "Operadora de plano de assistência à saúde — art. 130 da LC 214/2025, cClassTrib 011002: redução de 60%. Nota: nenhum cliente está mapeado a este item na aba Correlação CNAEs — item presente apenas como referência da lista completa (Banco_Dados).", "011002", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["04.23", "Outros planos de saúde com terceiros contratados/credenciados.", "", 0.6, "Regime específico planos de saúde — arts. 234-243 LC 214/2025, redução de 60% sobre base por margem", "011002", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["05.01", "Medicina Veterinária E Zootecnia.", "1.1405.12.00", 0.3, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — sujeita à alíquota padrão (cheia) de IBS/CBS (art. 156-A da CF/88; regra geral da LC 214/2025).", "200038, 200052", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["05.02", "Hospitais E Clínicas Veterinárias", "1.1405.11.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — sujeita à alíquota padrão (cheia) de IBS/CBS (art. 156-A da CF/88; regra geral da LC 214/2025).", "000001, 200038", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento dos insumos agropecuários e). O 0% vale para as NBS de tributação integral."],
    ["05.03", "Laboratórios de análise na área veterinária.", "", 0.3, "Profissão intelectual regulamentada (CRMV) — mesmo fundamento de 05.01, art. 127 LC 214/2025 — validar", "000001", "⚠️ CONFERIR: no Anexo VIII todas as NBS deste item são de tributação integral (000001), mas a base aplica 30% de redução."],
    ["05.04", "Inseminação artificial, fertilização in vitro e congêneres (veterinária).", "", 0.3, "Profissão intelectual regulamentada (CRMV) — mesmo fundamento de 05.01 — validar", "000001", "⚠️ CONFERIR: no Anexo VIII todas as NBS deste item são de tributação integral (000001), mas a base aplica 30% de redução."],
    ["05.05", "Bancos de sangue e de órgãos e congêneres (veterinária).", "", 0.0, "NBS 1.1405.40.00 mapeia unicamente para cClassTrib 000001 (tributação integral)", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["05.06", "Coleta de sangue, leite, tecidos, sêmen, órgãos e materiais biológicos (veterinária).", "", 0.0, "NBS 1.1405.40.00, cClassTrib 000001 (tributação integral)", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["05.07", "Unidade de atendimento, assistência ou tratamento móvel (veterinária).", "", 0.0, "Classificação ambígua entre profissão regulamentada (30%) e tributação integral conforme NBS — requer validação manual", "000001, 200038", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento dos insumos agropecuários e). O 0% vale para as NBS de tributação integral."],
    ["05.08", "Guarda, tratamento, amestramento, embelezamento, alojamento (animais).", "", 0.0, "NBS 1.1405.60.00, cClassTrib 000001 (tributação integral)", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["05.09", "Planos de atendimento e assistência médico-veterinária.", "", 0.3, "Regime específico de planos de saúde animal — art. 243 c/c arts. 234-242 LC 214/2025", "011005", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["06.01", "Barbearia, Cabeleireiros, Manicuros.", "1.2602.10.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — cClassTrib 000001: sujeita à alíquota padrão (cheia) de IBS/CBS.", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["06.02", "Esteticistas, Tratamento De Pele.", "1.2602.20.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025 — cClassTrib 000001: sujeita à alíquota padrão (cheia) de IBS/CBS.", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["06.03", "Banhos, duchas, sauna, massagens e congêneres.", "", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico da LC 214/2025 — alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["06.04", "Ginástica, dança, esportes, natação, artes marciais e demais atividades físicas.", "", 0.0, "Possível enquadramento em Atividades Desportivas (art. 141, I) se caracterizado como aula/instrução — requer validação manual conforme modelo de negócio", "000001, 200041", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento de serviço de educação desp). O 0% vale para as NBS de tributação integral."],
    ["06.05", "Centros de emagrecimento, spa e congêneres.", "", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico da LC 214/2025 — alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.01", "Engenharia, Agronomia, Arquitetura, Urbanismo.", "1.1402.11.00", 0.3, "Profissão intelectual regulamentada (engenharia/agronomia/arquitetura/urbanismo) — cClassTrib 200052 (Prestação de serviços de profissões intelectuais): redução de 30%, mesmo fundamento de 05.01/07.14/17.19/17.20 (condicionado a exercício por profissional habilitado, com registro no conselho de classe).", "000001, 200038, 200052", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.02", "Execução De Obras De Construção Civil.", "1.0101.11.00", 0.5, "Execução de obras de construção civil — Regime Específico de Bens Imóveis, art. 261, caput, da LC 214/2025, cClassTrib 200046 (Operações com bens imóveis): redução de 50%. (Reabilitação urbana de zonas históricas, cClassTrib 200045, teria 60% — caso específico, não o padrão).", "200038, 200045, 200046", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.03", "Elaboração De Projetos De Engenharia.", "1.1402.11.00", 0.3, "Elaboração de planos/projetos de engenharia (sem execução da obra) — cClassTrib 000001: sujeita à alíquota padrão. Diferente de 07.02 (execução), que tem redução de 50%.", "000001, 200045", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.04", "Demolição.", "1.0103.10.00", 0.5, "Demolição integra o processo de execução de obra — mesmo regime de 07.02/07.05 (Regime Específico de Bens Imóveis, art. 261 caput da LC 214/2025, cClassTrib 200046): redução de 50% — validar", "200045, 200046", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.05", "Reforma E Manutenção De Edifícios.", "1.0101.11.00", 0.5, "Reforma e manutenção de edifícios — mesmo regime de 07.02 (Regime Específico de Bens Imóveis, art. 261 caput, cClassTrib 200046): redução de 50%.", "200038, 200045, 200046", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.06", "Colocação e instalação de tapetes, carpetes, assoalhos, cortinas...", "1.0106.50.00, 1.0107.10.00, 1.0107.20.00, 1.0107.40.00", 0.5, "Acabamento de obra/edificação — mesmo regime de 07.02/07.05 (Regime Específico de Bens Imóveis, art. 261 caput, cClassTrib 200046): redução de 50% — validar", "200045, 200046", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.07", "Recuperação, raspagem, polimento e lustração de pisos e congêneres.", "1.0107.40.00", 0.5, "Reforma/acabamento de edificação — mesmo regime de 07.05 (Regime Específico de Bens Imóveis, art. 261 caput, cClassTrib 200046): redução de 50% — validar", "200045, 200046", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.08", "Calafetação.", "1.0107.90.00", 0.5, "Reforma/manutenção de edificação — mesmo regime de 07.05 (Regime Específico de Bens Imóveis, art. 261 caput, cClassTrib 200046): redução de 50% — validar", "200045, 200046", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.09", "Varrição, Coleta E Remoção De Lixo.", "1.2406.10.00", 0.0, "Varrição, coleta e remoção de lixo — cClassTrib 000001: sujeita à alíquota padrão (não é serviço ambiental de conservação/recuperação de vegetação nativa, que teria 60% via cClassTrib 200037).", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.10", "Limpeza, Manutenção E Conservação De Imóveis.", "1.1803.10.00", 0.0, "Limpeza e conservação de vias/imóveis — cClassTrib 000001: sujeita à alíquota padrão.", "000001, 200045", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Operações relacionadas a projetos de rea). O 0% vale para as NBS de tributação integral."],
    ["07.11", "Decoração e jardinagem, inclusive corte e poda de árvores.", "1.1409.11.00, 1.1409.12.00, 1.1806.70.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico da LC 214/2025 — não caracteriza obra em bem imóvel de terceiro; alíquota padrão — requer validação", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.12", "Controle e tratamento de efluentes de qualquer natureza...", "1.2404.21.00, 1.2404.22.00, 1.2404.31.00, 1.2404.32.00, 1.2404.39.00, 1.2405.11.00, 1.2405.12.00, 1.2405.13.00, 1.2405.20.00, 1.2405.90.00", 0.0, "Possível serviço de saneamento básico, sem regime específico localizado com certeza na LC 214/2025 — alíquota padrão — requer validação manual", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.13", "Dedetização, desinfecção, desinsetização, imunização...", "1.1803.21.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico da LC 214/2025 — alíquota padrão", "000001, 200038", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento dos insumos agropecuários e). O 0% vale para as NBS de tributação integral."],
    ["07.16", "Florestamento, reflorestamento, semeadura, adubação e congêneres.", "1.1105.41.00, 1.1901.10.00, 1.1901.30.00, 1.0602.31.00", 0.0, "Serviço, não insumo agropecuário — não se enquadra na redução de bens da cesta agropecuária; alíquota padrão — requer validação", "000001, 200037, 200038", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento de serviços ambientais de c; Fornecimento dos insumos agropecuários e). O 0% vale para as NBS de tributação integral."],
    ["07.17", "Escoramento, contenção de encostas e serviços congêneres.", "1.0105.11.00", 0.5, "Obra de engenharia civil/geotecnia — mesmo regime de 07.02 (Regime Específico de Bens Imóveis, art. 261 caput, cClassTrib 200046): redução de 50% — validar", "200045, 200046", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.18", "Limpeza e dragagem de rios, portos, canais, baías, lagos...", "1.2406.90.00", 0.0, "Serviço de infraestrutura/dragagem, sem regime específico localizado com certeza — alíquota padrão — requer validação manual", "000001, 200045", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Operações relacionadas a projetos de rea). O 0% vale para as NBS de tributação integral."],
    ["07.19", "Acompanhamento e fiscalização da execução de obras de engenharia...", "1.1402.15.00, 1.1403.21.10, 1.1403.21.20, 1.1403.30.00", 0.3, "Profissão intelectual regulamentada (engenharia) — mesmo fundamento de 07.01/07.03, art. 127 LC 214/2025, cClassTrib 200052: redução de 30% — validar habilitação profissional", "200045, 200052", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.20", "Aerofotogrametria (inclusive interpretação), cartografia...", "1.1404.21.00, 1.1404.22.00, 1.1404.19.00", 0.3, "Profissão intelectual regulamentada (engenharia/agrimensura) — mesmo fundamento de 07.01, art. 127 LC 214/2025, cClassTrib 200052: redução de 30% — validar", "000001, 200045", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.21", "Pesquisa, perfuração, cimentação, mergulho, perfilagem...", "1.1404.19.00, 1.1902.10.00, 1.1902.90.00", 0.0, "Atividade técnica especializada sem enquadramento claro em profissão regulamentada do art. 127 — alíquota padrão — requer validação manual", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["07.22", "Nucleação e bombardeamento de nuvens e congêneres.", "1.1901.10.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico da LC 214/2025 — alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["08.01", "Ensino Regular Pré-Escolar, Fundamental, Médio E Superior.", "1.2201.11.00", 0.6, "Ensino regular pré-escolar/fundamental/médio/superior — Anexo II da LC 214/2025, cClassTrib 200028 (Fornecimento dos serviços de educação): redução de 60%.", "200025, 200028", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["08.02", "Instrução, Treinamento, Orientação Pedagógica.", "1.2205.11.00", 0.0, "Instrução/treinamento não regular — cClassTrib 000001 na maioria das NBS (ex.: 1.2205.19.00, \"treinamento não classificado\"). ATENÇÃO: a NBS 1.2205.13.00 (línguas estrangeiras/sinais) aparece tanto em 000001 quanto em 200028 (Anexo II, 60%) na tabela oficial, sem critério de CNAE que distinga — mantido 0% (lado conservador). 161 clientes mapeados neste item em Correlação CNAEs; recomenda-se revisão manual para os que sejam escolas de idiomas formalmente credenciadas.", "000001, 200028", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento dos serviços de educação (A). O 0% vale para as NBS de tributação integral."],
    ["09.01", "Hospedagem Em Hotéis, Pousadas E Similares.", "1.0303.11.00", 0.4, "CORREÇÃO: Hospedagem — Regime Específico de Bares, Restaurantes, Hotelaria e Turismo (Capítulo VII da LC 214/2025, arts. 277 a 283, especificamente art. 281): redução de 40%, e não 0%. Ajustar coluna D de 0% para 40%. Contrapartida: vedação de crédito ao adquirente pessoa jurídica (custo tributário definitivo).", "200048", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["09.02", "Agenciamento De Viagens E Turismo.", "1.1805.24.00 / 1.1805.40.00", 0.4, "CORREÇÃO: Agenciamento de viagens e turismo — cClassTrib 200051 (Agências de Turismo): redução de 40%. NBS da coluna C corrigida de 1.0401.17.10 (cClassTrib 000001, transporte turístico/sightseeing, sem redução) para 1.1805.24.00 / 1.1805.40.00 (serviços de reservas de pacotes turísticos / operadoras de turismo, cClassTrib 200051), refletindo corretamente a atividade de agenciamento (24 clientes mapeados em Correlação CNAEs). Distinto do transporte turístico em si (NBS 1.0401.xx), tributado integralmente (0% redução). Fonte: anexoviii-correlacaoitemnbsindopcclasstrib_ibscbs (Receita Federal/gov.br).", "000001, 200051", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["09.03", "Guias de turismo.", "1.1805.50.00", 0.4, "Possível profissão regulamentada (Guia de Turismo, Lei 8.623/1993), não constante expressamente do art. 127 da LC 214/2025 — alíquota padrão — requer validação manual [ajustado por auditoria: cClassTrib 200051 (Agências de Turismo), alinhado ao item 09.02 — redução de 40%.]", "200051", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["10.01", "Agenciamento, Corretagem De Seguros E Planos De Saúde.", "1.0906.11.00", 0.0, "Corretagem de câmbio/seguros/cartão de crédito/previdência — cClassTrib 000001: sujeita à alíquota padrão. Exceção: intermediação especificamente de planos de saúde tem cClassTrib 011003 (60%) — não coberta por este NBS.", "000001, 011003", "ℹ️ Regime específico (Intermediação de planos de assistência à saúd) — tributação por margem/spread, não comparável a uma redução percentual. Tratar em separado."],
    ["10.02", "Corretagem De Títulos E Valores Mobiliários.", "1.0607.00.00", 0.0, "CORREÇÃO: Corretagem/intermediação de títulos e valores mobiliários — a NBS 1.0607.00.00 tem cClassTrib 000001 na tabela oficial (não 200046/50%, exclusivo de bens imóveis). Ajustada coluna D de 50% para 0% (25 clientes impactados em Correlação CNAEs).", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["10.03", "Agenciamento, corretagem ou intermediação de direitos da propriedade...", "1.2501.40.00, 1.0905.11.00", 0.0, "Agenciamento/intermediação genérica — mesmo regime de 10.08/10.09, cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["10.04", "Agenciamento, corretagem ou intermediação de contratos de arrendamento...", "1.0905.90.00", 0.0, "Agenciamento/intermediação genérica — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["10.05", "Corretagem De Bens Móveis Ou Imóveis (Intermediação).", "1.1001.21.00", 0.5, "Corretagem/intermediação de bens imóveis — cClassTrib 200046 (Operações com bens imóveis), art. 261 caput da LC 214/2025: redução de 50%. Mesmo fundamento do item 17.12 (administração de imóveis de terceiros).", "000001, 200046", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["10.06", "Agenciamento marítimo.", "1.0502.29.00, 1.0607.00.00", 0.0, "Agenciamento genérico — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["10.07", "Agenciamento de notícias.", "1.1704.10.00, 1.1704.20.00", 0.0, "Agenciamento genérico — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["10.08", "Agenciamento De Publicidade E Propaganda.", "1.1406.20.00", 0.0, "Agenciamento de publicidade e propaganda — cClassTrib 000001: sujeita à alíquota padrão.", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["10.09", "Representação Comercial.", "1.0201.00.00", 0.0, "CORREÇÃO: Representação comercial — a NBS 1.0201.00.00 tem cClassTrib 000001 na tabela oficial (sem previsão de redução). Ajustada coluna D de 50% para 0% (56 clientes impactados em Correlação CNAEs — maior correção de volume encontrada nesta revisão).", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["10.10", "Distribuição de bens de terceiros", "1.0201.00.00", 0.0, "Distribuição/logística genérica — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["11.01", "Guarda E Estacionamento De Veículos.", "1.0604.30.00", 0.0, "Guarda e estacionamento de veículos — cClassTrib 000001: sujeita à alíquota padrão.", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["11.02", "Vigilância, Segurança Ou Monitoramento.", "1.1802.50.00", 0.0, "Vigilância, segurança e monitoramento — cClassTrib 000001: sujeita à alíquota padrão.", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["11.03", "Escolta, inclusive de veículos e cargas.", "1.1802.50.00", 0.0, "Mesmo regime de 11.01/11.02 (segurança/vigilância) — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["11.04", "Armazenamento, depósito, carga, descarga...", "1.0601.10.00, 1.0601.90.00, 1.0602.10.00, 1.0602.21.00, 1.0602.22.00, 1.0602.23.00, 1.0602.29.00, 1.0602.31.00, 1.0602.32.00, 1.0602.33.00, 1.0602.90.00, 1.0608.20.00, 1.0608.30.00", 0.0, "Logística geral — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["12.01", "Espetáculos teatrais.", "", 0.6, "Produções Nacionais Artísticas/Culturais — art. 139, I LC 214/2025", "000001, 200039", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["12.02", "Exibições cinematográficas.", "", 0.0, "Redução condicionada a produção audiovisual nacional (art. 139, VII e §2º) — exibição de obra estrangeira não se enquadra — validar por título", "000001, 200039", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento dos serviços e o licenciame). O 0% vale para as NBS de tributação integral."],
    ["12.03", "Espetáculos circenses.", "", 0.6, "Art. 139, I LC 214/2025 — espetáculos teatrais, circenses e de dança", "000001, 200039", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["12.04", "Programas de auditório.", "", 0.6, "Art. 139, VII LC 214/2025", "000001, 200039", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["12.05", "Parques de diversões, centros de lazer e congêneres.", "", 0.4, "Regime Específico de Hotelaria e Parques de Diversão — arts. 277, 279, I e 281 LC 214/2025", "200048", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["12.06", "Boates, taxi dancing e congêneres.", "", 0.0, "Não se enquadra na definição de parque de diversão (art. 279) nem no Anexo X — alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["12.07", "Shows, ballet, danças, desfiles, bailes.", "", 0.6, "Art. 139, I/II/III LC 214/2025; \"bailes\" genéricos sem vínculo cultural podem não se enquadrar — validar", "000001, 200039", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["12.08", "Feiras, exposições, congressos e congêneres.", "", 0.6, "Art. 139, IV/V/VI e Anexo X item 22 LC 214/2025", "000001, 200039", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["12.09", "Bilhares, boliches e diversões eletrônicas ou não.", "", 0.0, "Não localizado enquadramento específico — requer validação manual", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["12.10", "Corridas e competições de animais.", "", 0.0, "Regime de Atividades Desportivas (art. 141) restrito a clubes/associações filiadas — não se enquadra", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["12.11", "Competições esportivas ou de destreza física ou intelectual.", "", 0.0, "Art. 141, II restrito a eventos de clubes filiados a órgão de coordenação de desportos; \"destreza intelectual\" foge do escopo — requer validação manual", "000001, 200042", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento de serviço de educação desp). O 0% vale para as NBS de tributação integral."],
    ["12.12", "Execução de música.", "", 0.6, "Anexo X itens 36-39 c/c art. 139 LC 214/2025 (atuação artística ao vivo)", "000001, 200039", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["12.13", "Produção, mediante ou sem encomenda prévia, de eventos.", "", 0.6, "Anexo X item 22 LC 214/2025 (organização de eventos)", "000001, 200039", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["12.14", "Fornecimento de música para ambientes fechados ou não.", "", 0.0, "Não localizado enquadramento específico — requer validação manual", "000001, 200039", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento dos serviços e o licenciame). O 0% vale para as NBS de tributação integral."],
    ["12.15", "Desfiles de blocos carnavalescos ou folclóricos.", "", 0.6, "Art. 139, III LC 214/2025 — desfiles carnavalescos/folclóricos", "000001, 200039", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["12.16", "Exibição de filmes, entrevistas, musicais.", "", 0.6, "Art. 139, VII LC 214/2025, condicionado a produção nacional", "000001, 200039", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["12.17", "Recreação e animação, inclusive em festas e eventos.", "", 0.0, "Não localizado enquadramento específico — requer validação manual", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["13.02", "Fonografia ou gravação de sons, inclusive trucagem.", "", 0.0, "Redução restrita a serviços vinculados diretamente a produções nacionais (Anexo X itens 23-24) — requer validação por caso", "000001, 200039", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento dos serviços e o licenciame). O 0% vale para as NBS de tributação integral."],
    ["13.03", "Fotografia e cinematografia, inclusive revelação.", "", 0.0, "Anexo X item 42 restringe a fotografias artísticas originais (obra de arte); fotografia comercial em geral não se enquadra", "000001, 200039", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento dos serviços e o licenciame). O 0% vale para as NBS de tributação integral."],
    ["13.04", "Reprografia, Microfilmagem E Digitalização.", "1.1806.51.00", 0.0, "Reprografia, microfilmagem e digitalização — cClassTrib 000001: sujeita à alíquota padrão.", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["13.05", "Composição gráfica, fotocomposição, clicheria.", "", 0.0, "Não localizado enquadramento específico — requer validação manual", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["14.01", "Manutenção E Reparação De Máquinas, Veículos E Equipamentos.", "1.2001.10.00", 0.0, "Manutenção e reparação de máquinas/veículos/equipamentos — cClassTrib 000001: sujeita à alíquota padrão.", "000001, 200044", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Operações e prestações de serviços de se). O 0% vale para as NBS de tributação integral."],
    ["14.02", "Assistência Técnica.", "1.2001.10.00", 0.0, "Assistência técnica — cClassTrib 000001: sujeita à alíquota padrão.", "000001, 200044", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Operações e prestações de serviços de se). O 0% vale para as NBS de tributação integral."],
    ["14.03", "Recondicionamento de motores (exceto peças e partes empregadas...", "1.2001.31.10", 0.0, "Mesmo regime de 14.01/14.02 (manutenção/reparo) — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["14.04", "Recauchutagem ou regeneração de pneus.", "1.2002.90.00", 0.0, "Mesmo regime de 14.01 — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["14.05", "Restauração, recondicionamento, acondicionamento, pintura...", "1.1804.00.00, 1.2002.90.00", 0.0, "Mesmo regime de 14.01 — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["14.06", "Instalação E Montagem De Aparelhos E Equipamentos.", "1.0106.12.00", 0.0, "Instalação e montagem de aparelhos e equipamentos — cClassTrib 000001: sujeita à alíquota padrão.", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["14.07", "Colocação de molduras e congêneres.", "1.2606.00.00", 0.0, "Serviço de reparo/acabamento genérico — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["14.08", "Encadernação, gravação e douração de livros, revistas e congêneres.", "1.2101.22.00", 0.0, "Serviço de acabamento gráfico, distinto da venda do livro (que pode ter tratamento diferenciado) — cClassTrib 000001: sujeita à alíquota padrão — validar", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["14.09", "Alfaiataria e costura, quando o material for fornecido pelo usuário final...", "1.2604.00.00, 1.2002.40.00", 0.0, "Mesmo regime de 14.01 — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["14.10", "Tinturaria e lavanderia.", "1.2601.10.00, 1.2601.20.00, 1.2601.30.00, 1.2601.40.00, 1.2601.90.00", 0.0, "Mesmo regime de 14.01 — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["14.11", "Tapeçaria e reforma de estofamentos em geral.", "1.2002.40.00", 0.0, "Mesmo regime de 14.01 — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["14.12", "Funilaria e lanternagem.", "1.2001.31.10", 0.0, "Mesmo regime de 14.01 (reparo de veículos) — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["14.13", "Carpintaria e serralheria.", "1.0107.50.00", 0.0, "Mesmo regime de 14.01 — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.01", "Administração de cartões de crédito...", "1.0901.40.00, 1.0905.21.00, 1.0905.22.00, 1.0905.23.00, 1.0905.40.00, 1.0906.40.00", 0.0, "Regime Específico de Operações Financeiras (Cap. IV, arts. 182 a 233 da LC 214/2025) — tributação por margem/spread, não comparável à redução percentual simples dos demais itens; requer tratamento diferenciado no motor de cálculo — validar com equipe fiscal", "010002", "ℹ️ Regime específico (Operações do serviço financeiro) — tributação por margem/spread, não comparável a uma redução percentual. Tratar em separado."],
    ["15.01", "Administração de fundos quaisquer, de consórcio...", "1.0901.40.00, 1.0905.21.00, 1.0905.22.00, 1.0905.23.00, 1.0905.40.00, 1.0906.40.00", 0.0, "Regime Específico de Operações Financeiras (Cap. IV, arts. 182 a 233 da LC 214/2025) — tributação por margem/spread; requer tratamento diferenciado no motor de cálculo — validar com equipe fiscal", "010002", "ℹ️ Regime específico (Operações do serviço financeiro) — tributação por margem/spread, não comparável a uma redução percentual. Tratar em separado."],
    ["15.02", "Abertura de contas em geral...", "1.0901.21.00, 1.0901.22.00, 1.0901.29.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread, não comparável à redução percentual simples; requer tratamento diferenciado no motor de cálculo — validar", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.03", "Locação e manutenção de cofres particulares...", "1.1101.90.00, 1.2001.89.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread; requer tratamento diferenciado — validar", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.04", "Fornecimento ou emissão de atestados em geral...", "1.1301.30.00, 1.1806.10.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread; requer tratamento diferenciado — validar", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.05", "Cadastro, elaboração de ficha cadastral...", "1.1806.10.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread; requer tratamento diferenciado — validar", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.06", "Emissão, reemissão e fornecimento de avisos...", "1.1301.30.00, 1.0702.00.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread; requer tratamento diferenciado — validar", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.07", "Acesso, movimentação, atendimento...", "1.0901.90.00, 1.1806.31.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread; requer tratamento diferenciado — validar", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.08", "Emissão, reemissão, alteração...", "1.0901.33.00, 1.0901.34.00, 1.0901.35.00, 1.0901.36.00, 1.0901.39.00, 1.0905.50.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread; requer tratamento diferenciado — validar", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.09", "Arrendamento mercantil...", "1.0901.51.11, 1.0901.51.12, 1.0901.51.13, 1.0901.51.14, 1.0901.51.15, 1.0901.51.16, 1.0901.51.17, 1.0901.51.21, 1.0901.51.22, 1.0901.51.23, 1.0901.51.24, 1.0901.51.25, 1.0901.51.29, 1.0901.52.10, 1.0901.52.20, 1.0901.52.30, 1.0901.52.40, 1.0901.52.50, 1.0901.52.90, 1.1101.11.00, 1.1101.12.00, 1.1101.13.00, 1.1101.14.00, 1.1101.15.00, 1.1101.16.00, 1.1101.17.00, 1.1101.20.00, 1.1101.30.00, 1.1101.40.00, 1.1101.50.00, 1.1101.60.00, 1.1101.90.00, 1.1102.10.00, 1.1102.20.00, 1.1102.30.00, 1.1102.40.00, 1.1102.50.00, 1.1102.60.00, 1.1102.90.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread (arrendamento mercantil/leasing); requer tratamento diferenciado — validar", "010002", "ℹ️ Regime específico (Operações do serviço financeiro) — tributação por margem/spread, não comparável a uma redução percentual. Tratar em separado."],
    ["15.10", "Serviços relacionados a cobranças...", "1.1806.20.00, 1.0901.90.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread; requer tratamento diferenciado — validar; possível sobreposição com 17.22", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.11", "Devolução de títulos, protesto...", "1.0901.90.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread; requer tratamento diferenciado — validar", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.12", "Custódia em geral...", "1.0905.30.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread; requer tratamento diferenciado — validar", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.13", "Serviços relacionados a operações de câmbio...", "1.0905.60.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread; requer tratamento diferenciado — validar", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.14", "Fornecimento, emissão, reemissão...", "1.0901.40.00, 1.0901.90.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread; requer tratamento diferenciado — validar", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.15", "Compensação de cheques...", "1.0901.21.00, 1.0901.22.00, 1.0901.29.00, 1.0905.13.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread; requer tratamento diferenciado — validar", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.16", "Emissão, reemissão, liquidação...", "1.0901.90.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread; requer tratamento diferenciado — validar", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.17", "Emissão, fornecimento, devolução...", "1.0901.90.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread; pode tangenciar Regime de Bens Imóveis (crédito imobiliário); requer tratamento diferenciado — validar sobreposição", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["15.18", "Serviços relacionados a crédito imobiliário...", "1.0901.31.00, 1.0901.32.00, 1.1001.30.00", 0.0, "Regime Específico de Operações Financeiras (arts. 182-233 LC 214/2025) — tributação por margem/spread; pode tangenciar Regime de Bens Imóveis (crédito imobiliário); requer tratamento diferenciado — validar sobreposição", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["16.01", "Serviços de transporte municipal...", "1.0401.11.19, 1.0401.16.10, 1.0401.16.20, 1.0401.16.90, 1.0401.21.10, 1.0401.21.90, 1.0401.30.00", 0.0, "Possível Regime Específico de Transporte Público Coletivo (política social/mobilidade urbana) — não localizado artigo específico com certeza — alíquota padrão — requer validação manual", "000001, 200021, 400001", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Serviços de transporte público coletivo ; Fornecimento de serviços de transporte p). O 0% vale para as NBS de tributação integral."],
    ["17.01", "Assessoria Ou Consultoria De Qualquer Natureza.", "1.0608.40.00", 0.0, "Assessoria ou consultoria de qualquer natureza (genérica, não financeira/não profissão regulamentada específica) — cClassTrib 000001: sujeita à alíquota padrão.", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.02", "Datilografia, Digitação, Secretaria Em Geral.", "1.1411.00.00", 0.0, "Datilografia, digitação e secretaria — cClassTrib 000001: sujeita à alíquota padrão.", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.03", "Planejamento E Organização Técnica/Administrativa.", "1.1401.29.00", 0.0, "Planejamento e organização técnica/administrativa — cClassTrib 000001: sujeita à alíquota padrão.", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.04", "Recrutamento, agenciamento...", "1.1801.11.00, 1.1801.12.00", 0.0, "Mesmo regime de 17.05 (fornecimento/locação de mão de obra) — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.05", "Fornecimento E Locação De Mão-De-Obra.", "1.1801.21.00", 0.0, "Fornecimento e locação de mão de obra — cClassTrib 000001: sujeita à alíquota padrão.", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.06", "Propaganda E Publicidade.", "1.1406.11.00", 0.0, "Propaganda e publicidade — cClassTrib 000001: sujeita à alíquota padrão.", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.08", "Franquia (franchising).", "1.1110.00.00", 0.0, "Cessão de direitos comerciais, não é profissão regulamentada nem bem imóvel — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.09", "Perícias, Laudos, Exames Técnicos.", "1.1404.41.00", 0.0, "Perícias, laudos e exames técnicos — cClassTrib 000001: sujeita à alíquota padrão.", "000001, 200038", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento dos insumos agropecuários e). O 0% vale para as NBS de tributação integral."],
    ["17.10", "Planejamento, organização de feiras...", "1.1806.61.00, 1.1806.62.00, 1.1806.63.00", 0.0, "Evento comercial genérico, sem produção cultural nacional caracterizada — cClassTrib 000001: sujeita à alíquota padrão — validar", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.11", "Organização de festas e recepções...", "1.1806.63.00, 1.0301.10.00, 1.0301.31.00, 1.0301.39.00", 0.0, "Serviço de organização de evento (buffet/produção), distinto da locação do espaço (ver 03.03, 70%) — cClassTrib 000001: sujeita à alíquota padrão — requer validação quanto a eventual sobreposição", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.12", "Administração Em Geral, Inclusive De Bens E Negócios De Terceiros — Administração de Imóveis de Terceiros", "1.1001.11.00 / 1.1001.12.90", 0.5, "Administração/locação de imóveis de terceiros (residenciais e não residenciais) — art. 261, caput, da LC 214/2025 (Regime Específico de Bens Imóveis), cClassTrib 200046 (Operações com bens imóveis): redução de 50%. Distinto da corretagem/intermediação imobiliária (item 10.05, NBS 1.1001.21/22, mesma redução de 50%) e da locação/cessão/arrendamento direto do imóvel (item 03.04, cClassTrib 200027, 70%, exceção do art. 261). Fonte: anexoviii-correlacaoitemnbsindopcclasstrib_ibscbs (Receita Federal/gov.br).", "200046", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.12-G", "Administração Em Geral, Inclusive De Bens E Negócios De Terceiros — Gestão de Negócios/Hospitalar (sem bem imóvel)", "1.1401.21.00 / 1.1401.22.00", 0.0, "Gestão em processos de negócios / gestão hospitalar de terceiros, sem vínculo com bem imóvel — cClassTrib 000001 (tributação integral): atividade não constante de nenhum Anexo/Regime Específico de redução da LC 214/2025, sujeita à alíquota padrão (cheia) de IBS/CBS. Ex.: administração de fundos de investimento (CNAE 6630-4/00). Fonte: anexoviii-correlacaoitemnbsindopcclasstrib_ibscbs (Receita Federal/gov.br).", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.13", "Leilão e congêneres.", "1.1806.90.00", 0.0, "Agenciamento/intermediação genérica — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.14", "Advocacia.", "1.1301.10.00", 0.3, "Advocacia — profissão intelectual regulamentada (OAB), art. 127 da LC 214/2025, cClassTrib 200052: redução de 30%.", "200052", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.15", "Arbitragem de qualquer espécie...", "1.1301.40.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico da LC 214/2025 — alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.16", "Auditoria.", "1.1302.11.00, 1.1302.19.00", 0.3, "Mesmo fundamento de 17.19 (profissão contábil regulamentada), art. 127 LC 214/2025, cClassTrib 200052: redução de 30%, condicionada a exercício por profissional habilitado (CRC) — validar", "000001, 200052", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.17", "Análise de Organização e Métodos.", "1.1806.90.00", 0.0, "Consultoria administrativa genérica — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.18", "Atuária e cálculos técnicos de qualquer natureza.", "1.0906.30.00", 0.0, "Possível profissão regulamentada (Atuário/IBA), não constante expressamente do art. 127 da LC 214/2025 — alíquota padrão — requer validação manual", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.19", "Contabilidade E Serviços Técnicos Auxiliares.", "1.1302.21.00", 0.3, "Contabilidade — o art. 127 da LC 214/2025 inclui expressamente \"contabilistas\" entre as profissões intelectuais regulamentadas, cClassTrib 200052: redução de 30%, condicionada a sócios habilitados (CRC) e sem PJ no quadro.", "200052", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.20", "Consultoria E Assessoria Financeira.", "1.0905.50.00", 0.3, "CORREÇÃO: Consultoria e assessoria financeira/econômica — a NBS 1.0905.50.00 tem cClassTrib 200052 (profissões intelectuais) na tabela oficial: redução de 30% (mesmo fundamento de 07.01/17.14/17.19), condicionada a exercício por profissional habilitado (economista/CORECON). Ajustada coluna D de 0% para 30%. Sem impacto em clientes reais hoje (0 mapeados neste item em Correlação CNAEs).", "200052", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.21", "Estatística.", "1.1415.00.00", 0.3, "Atividade não constante de nenhum Anexo/Regime Específico da LC 214/2025 — alíquota padrão [ajustado por auditoria: cClassTrib 200052 (profissões intelectuais) — redução de 30%.]", "200052", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.22", "Cobrança em geral.", "1.1806.20.00", 0.0, "Cobrança fora do setor financeiro — cClassTrib 000001: sujeita à alíquota padrão — validar eventual sobreposição com 15.10", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.23", "Assessoria, análise, avaliação, atendimento...", "1.0908.00.00", 0.0, "Descrição genérica de assessoria — cClassTrib 000001: sujeita à alíquota padrão — requer validação (possível relação com regulação de sinistros, ver 18.01)", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["17.24", "Apresentação De Palestras E Conferências.", "1.2205.14.00", 0.0, "Apresentação de palestras e conferências — cClassTrib 000001: sujeita à alíquota padrão.", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["18.01", "Serviços de regulação de sinistros...", "1.0906.20.00", 0.0, "Regime Específico de Operações de Seguros (LC 214/2025) — tributação diferenciada, não comparável à redução percentual simples; requer tratamento específico no motor de cálculo — validar com equipe fiscal", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["19.01", "Serviços de distribuição e venda de bilhetes...", "1.0905.11.00", 0.0, "Possível Regime Específico de Loterias/Apostas (LC 214/2025) — requer validação manual; alíquota padrão como placeholder", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["20.01", "Serviços portuários...", "1.0401.21.20, 1.0601.10.00, 1.0601.90.00, 1.0605.10.00, 1.0605.20.00, 1.0605.30.00, 1.0605.40.00, 1.0605.90.00, 1.0602.10.00, 1.0602.21.00, 1.0602.22.00, 1.0602.23.00, 1.0602.29.00, 1.0602.31.00, 1.0602.32.00, 1.0602.33.00, 1.0602.90.00", 0.0, "Infraestrutura de transporte/concessão pública — não localizado regime redutor específico — alíquota padrão — requer validação", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["20.02", "Serviços aeroportuários...", "1.0601.90.00, 1.0602.90.00, 1.0606.11.00, 1.0606.12.00, 1.0606.19.00, 1.0606.20.00", 0.0, "Infraestrutura de transporte/concessão pública — não localizado regime redutor específico — alíquota padrão — requer validação", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["20.03", "Serviços de Terminais rodoviários...", "1.0601.90.00, 1.0603.00.00, 1.0604.10.00, 1.0604.90.00", 0.0, "Infraestrutura de transporte/concessão pública — não localizado regime redutor específico — alíquota padrão — requer validação", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["21.01", "Serviços de registros públicos...", "1.1304.00.00", 0.0, "Atividade notarial/registral (delegação de serviço público) — possível regime tributário peculiar não mapeado neste levantamento — alíquota padrão — requer validação manual", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["22.01", "Serviços de exploração de rodovia...", "1.0604.21.00, 1.0604.22.00", 0.0, "Concessão de infraestrutura rodoviária — não localizado regime redutor específico — alíquota padrão — requer validação", "000002", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["23.01", "Serviços de programação e comunicação visual...", "1.1409.21.00, 1.1409.22.00, 1.1409.23.00, 1.1409.24.00, 1.1409.25.00, 1.1409.29.00, 1.1409.30.00, 1.1409.90.00", 0.0, "Serviço de design/publicidade genérico — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["24.01", "Serviços de chaveiros, confecção de carimbos...", "1.2606.00.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico da LC 214/2025 — alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["25.01", "Funerais...", "1.1405.30.00, 1.2603.00.00", 0.0, "Não localizado regime específico para serviços funerários na LC 214/2025 — alíquota padrão", "000001, 200029", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento dos serviços de saúde human). O 0% vale para as NBS de tributação integral."],
    ["25.02", "Cremação de corpos...", "1.1405.30.00, 1.2603.00.00", 0.0, "Não localizado regime específico para serviços funerários — alíquota padrão", "000001, 200029", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento dos serviços de saúde human). O 0% vale para as NBS de tributação integral."],
    ["25.03", "Planos ou convênio funerários.", "1.2603.00.00", 0.0, "Não localizado regime específico para serviços funerários — alíquota padrão — validar eventual analogia a planos de saúde (não é saúde humana)", "011001", "ℹ️ Regime específico (Planos de assistência funerária.) — tributação por margem/spread, não comparável a uma redução percentual. Tratar em separado."],
    ["25.04", "Manutenção e conservação de jazigos e cemitérios.", "1.2603.00.00", 0.0, "Serviço de manutenção, não é locação de bem imóvel — não localizado regime específico — alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["26.01", "Atividades de transporte de valores...", "1.0501.15.00, 1.0608.10.00, 1.0701.00.00, 1.0702.00.00, 1.0703.00.00, 1.1802.40.00", 0.0, "Logística/segurança genérica — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["26.01", "Serviços de coleta, remessa ou entrega...", "1.0501.15.00, 1.0608.10.00, 1.0701.00.00, 1.0702.00.00, 1.0703.00.00, 1.1802.40.00", 0.0, "Logística genérica — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["26.01", "Serviços de entrega rápida...", "1.0501.15.00, 1.0608.10.00, 1.0701.00.00, 1.0702.00.00, 1.0703.00.00, 1.1802.40.00", 0.0, "Logística genérica — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["26.01", "Serviços de malote...", "1.0501.15.00, 1.0608.10.00, 1.0701.00.00, 1.0702.00.00, 1.0703.00.00, 1.1802.40.00", 0.0, "Logística genérica — cClassTrib 000001: sujeita à alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["27.01", "Serviços de assistência social.", "1.2304.11.00, 1.2304.12.00, 1.2304.19.00, 1.2304.20.00, 1.2304.90.00", 0.3, "Atividade pode gozar de imunidade se prestada por entidade beneficente certificada (CEBAS) — depende do prestador, não do item; regra geral: alíquota padrão — validar por CNPJ do cliente [ajustado por auditoria: cClassTrib 200052 (profissões intelectuais) — redução de 30%.]", "200052", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["28.01", "Serviços de avaliação de bens...", "1.1404.14.00, 1.1001.30.00, 1.0902.10.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico da LC 214/2025 — alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["29.01", "Serviços de biblioteconomia.", "1.1705.10.00, 1.1705.20.00", 0.3, "Serviço técnico-administrativo, não caracteriza educação regular nem produção cultural — alíquota padrão [ajustado por auditoria: cClassTrib 200052 (profissões intelectuais) — redução de 30%.]", "200052", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["30.01", "Serviços de biologia, biotecnologia e química.", "1.1415.00.00", 0.3, "Possível profissão regulamentada (biólogo/químico), não constante expressamente do art. 127 da LC 214/2025 — alíquota padrão — requer validação manual [ajustado por auditoria: cClassTrib 200052 (profissões intelectuais) — redução de 30%.]", "200052", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["31.01", "Serviços técnicos em edificações...", "1.1415.00.00", 0.3, "Possível mesmo fundamento de 07.01 (engenharia), art. 127 LC 214/2025, cClassTrib 200052: redução de 30% — requer validação", "200052", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["32.01", "Serviços de desenhos técnicos.", "1.1409.90.00", 0.0, "Desenho técnico/CAD pode ser exercido por técnico não necessariamente regulamentado — alíquota padrão — validar possível enquadramento em profissão regulamentada (engenharia/arquitetura) se vinculado", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["33.01", "Serviços de desembaraço aduaneiro...", "1.0204.00.00, 1.2606.00.00", 0.0, "Possível profissão regulamentada (despachante aduaneiro, regulamentação federal) — alíquota padrão como placeholder — requer validação manual", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["34.01", "Serviços de investigações particulares...", "1.1802.10.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico da LC 214/2025 — alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["35.01", "Serviços de reportagem, assessoria de imprensa...", "1.1401.31.00, 1.1401.32.00, 1.1704.10.00, 1.1704.20.00", 0.0, "Jornalismo não constante do rol de profissões regulamentadas do art. 127 — alíquota padrão", "000001, 200040, 200052", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento de serviços de comunicação ; Prestação de serviços de profissões inte). O 0% vale para as NBS de tributação integral."],
    ["36.01", "Serviços de meteorologia.", "1.1404.30.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico da LC 214/2025 — alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["37.01", "Serviços de artistas, atletas...", "1.1806.81.00, 1.1806.82.00, 1.1806.83.00, 1.2506.00.00, 1.2503.10.00", 0.0, "Possível enquadramento em produção cultural/artística (art. 139) se caracterizado como espetáculo, análogo a 12.01/12.03 — alíquota padrão como placeholder — requer validação manual", "000001, 200039", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento dos serviços e o licenciame). O 0% vale para as NBS de tributação integral."],
    ["38.01", "Serviços de museologia.", "1.2504.11.00, 1.2504.12.00", 0.0, "Atividade museológica não constante expressamente do art. 139 — alíquota padrão — requer validação quanto a possível enquadramento cultural", "000001, 200039", "ℹ️ Conferir pela NBS: parte das NBS deste item tem cClassTrib de regime/redução (Fornecimento dos serviços e o licenciame). O 0% vale para as NBS de tributação integral."],
    ["39.01", "Serviços de ourivesaria e lapidação.", "1.2002.20.00", 0.0, "Atividade não constante de nenhum Anexo/Regime Específico da LC 214/2025 — alíquota padrão", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."],
    ["40.01", "Obras de arte sob encomenda.", "1.1109.90.00, 1.2503.20.00", 0.0, "Possível enquadramento em produção artística (art. 139) se caracterizada como obra de arte original, análogo a 12.01 — alíquota padrão como placeholder — requer validação manual", "000001", "✅ Coerente com o cClassTrib do Anexo VIII."]
];

// =============================================================================
// SEGMENTOS DAS EMPRESAS — define QUAL MODELO DE COMUNICADO cada uma recebe
// -----------------------------------------------------------------------------
// Fonte: planilha "Empresas - Reforma Tributária - Reuniões" (abas Saúde e
// Engenharia), entregue pelo escritório. 333 CNPJs.
//   ENGENHARIA e SAUDE -> ID_MODELO_COMUNICADO_ENG_SAUDE
//   qualquer outro      -> ID_MODELO_COMUNICADO_PADRAO
// Quem não está nesta lista é classificado pelo CNAE principal
// (segmentoPorCnae_) e, no que sobrar, fica DEMAIS.
// CNPJ | Segmento | Razão Social de referência
// =============================================================================
// DADOS_SEGMENTOS fica no arquivo DadosSegmentos.gs (carteira real de clientes, não versionado). Modelo: DadosSegmentos.exemplo.gs

function setupPlanilhaEInjetarBase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- aba principal
  let abaPrincipal = ss.getSheetByName("Simples Nacional");
  if (!abaPrincipal) abaPrincipal = ss.insertSheet("Simples Nacional");
  abaPrincipal.getRange(1, 1, 1, HEADERS_SN_2027.length).setValues([HEADERS_SN_2027])
    .setFontWeight("bold").setBackground(VERDE_ESCURO).setFontColor("#ffffff").setWrap(true);
  abaPrincipal.setFrozenRows(1);
  abaPrincipal.getRange("A:A").setNumberFormat("@");

  // --- correlação
  let abaCorrelacao = ss.getSheetByName("Correlação CNAEs");
  if (!abaCorrelacao) abaCorrelacao = ss.insertSheet("Correlação CNAEs");
  abaCorrelacao.getRange(1, 1, 1, HEADERS_CORRELACAO.length).setValues([HEADERS_CORRELACAO])
    .setFontWeight("bold").setBackground("#b45f06").setFontColor("#ffffff").setWrap(true);
  abaCorrelacao.setFrozenRows(1);
  abaCorrelacao.getRange("E:G").setNumberFormat("@");
  abaCorrelacao.getRange("H:H").setNumberFormat("0.00%");
  abaCorrelacao.getRange(COR_COL_RED_ORIG + ":" + COR_COL_RED_ORIG).setNumberFormat("0.00%");

  // --- base CNAE × Item
  let abaCnae = ss.getSheetByName("Base_CNAE_Item");
  if (!abaCnae) abaCnae = ss.insertSheet("Base_CNAE_Item");
  abaCnae.getRange("A1:E1")
    .setValues([["CNAE", "Descrição do CNAE (2.1)", "Item da Lista",
                 "Descrição do Item (LC 116/2003)", "Item predominante do CNAE (S/N)"]])
    .setFontWeight("bold").setBackground("#1155cc").setFontColor("#ffffff").setWrap(true);
  abaCnae.setFrozenRows(1);
  abaCnae.getRange("A:A").setNumberFormat("@");
  abaCnae.getRange("C:C").setNumberFormat("@");

  // --- banco de dados Item × NBS × Redução
  let abaBanco = ss.getSheetByName("Banco_Dados");
  if (!abaBanco) abaBanco = ss.insertSheet("Banco_Dados");
  abaBanco.getRange("A1:G1")
    .setValues([["Item da Lista", "Descrição do Item (LC 116/2003)", "NBS",
                 "Redução Reforma (%)", "Fundamento legal da redução (LC 214/2025)",
                 "cClassTrib (Anexo VIII)", "Auditoria cClassTrib × Redução"]])
    .setFontWeight("bold").setBackground("#1155cc").setFontColor("#ffffff");
  abaBanco.setFrozenRows(1);
  abaBanco.getRange("A:C").setNumberFormat("@");
  abaBanco.getRange("D:D").setNumberFormat("0.00%");

  const abaPadrao = ss.getSheetByName("Página 1");
  if (abaPadrao && ss.getSheets().length > 1) ss.deleteSheet(abaPadrao);

  // --- injeção (só quando a aba está vazia)
  let msgCnae, msgBanco;
  if (abaCnae.getLastRow() > 1) {
    msgCnae = "Base_CNAE_Item já tem " + (abaCnae.getLastRow() - 1) + " linha(s) — injeção pulada.";
  } else {
    abaCnae.getRange(2, 1, DADOS_CNAE_BASE.length, 5).setValues(DADOS_CNAE_BASE);
    msgCnae = "Base_CNAE_Item: " + DADOS_CNAE_BASE.length + " linha(s) injetada(s).";
  }
  if (abaBanco.getLastRow() > 1) {
    msgBanco = "Banco_Dados já tem " + (abaBanco.getLastRow() - 1) + " linha(s) — injeção pulada.";
  } else {
    abaBanco.getRange(2, 1, DADOS_NBS_BASE.length, 7).setValues(DADOS_NBS_BASE);
    msgBanco = "Banco_Dados: " + DADOS_NBS_BASE.length + " linha(s) injetada(s).";
  }

  criarAbaParametros_(ss);
  const nSeg = atualizarAbaSegmentos_(ss);

  exibirAlerta("✅ Setup concluído.\n" + msgCnae + "\n" + msgBanco +
               "\nAba 'Segmentos': " + (nSeg === null ? "não criada (sem aba Simples Nacional)" :
                 (nSeg + " empresa(s) de ENGENHARIA/SAÚDE")) +
               " — é ela que define qual modelo de Comunicado cada empresa recebe." +
               "\nAba 'Parâmetros' com a tabela oficial dos Anexos I a V." +
               "\nO Banco_Dados é a base única de Item × NBS × Redução (a antiga aba 'Página4' foi descontinuada)." +
               "\nPróximo passo: 1️⃣ Importar PJ.");
}

// =============================================================================
// ABA PARÂMETROS — alíquotas editáveis + tabela oficial dos Anexos I a V
// =============================================================================
function criarAbaParametros_(ss) {
  let sh = ss.getSheetByName("Parâmetros");
  const novo = !sh;
  if (novo) sh = ss.insertSheet("Parâmetros");

  sh.getRange("A1").setValue("PARÂMETROS DA SIMULAÇÃO — REFORMA TRIBUTÁRIA 2027")
    .setFontWeight("bold").setFontSize(12).setFontColor(VERDE_ESCURO);
  sh.getRange("A2").setValue("CBS - alíquota cheia 2027");
  sh.getRange("A3").setValue("IBS - alíquota de teste 2027/2028");
  sh.getRange("A4").setValue("ISS fora do DAS - 6ª faixa (Anexos III, IV e V)");
  sh.getRange("C4").setValue("Art. 18, §§ 16 e 17 da LC 123/2006: na 6ª faixa (RBT12 acima de R$ 3.600.000,00) o ISS sai do DAS e é recolhido direto ao Município. Teto legal de 5% (art. 8º-A da LC 116/2003). Ajuste aqui se a alíquota municipal for menor.");
  sh.getRange("C2").setValue("Art. 347 da LC 214/2025 permite 8,7% em 2027-2028 (redução de 0,1 p.p.). Troque aqui para recalcular tudo.");
  sh.getRange("C3").setValue("Art. 344 da LC 214/2025: 0,1% (0,05% estadual + 0,05% municipal), com a mesma redução setorial da CBS.");
  sh.getRange("A5").setValue("Carga total = Alíquota Efetiva do DAS (ajustada pela imunidade de exportação) + ISS fora do DAS (6ª faixa) − %PIS no DAS − %COFINS no DAS + 8,8% × (100% − redução) × (100% − % de exportação)" +
    (INCLUIR_IBS_NO_HIBRIDO ? " + IBS" : "   [IBS de teste não somado — ver INCLUIR_IBS_NO_HIBRIDO no script]"));
  sh.getRange("A6").setValue("Redução da Atividade (%) = redução do ITEM PREDOMINANTE do CNAE PRINCIPAL (1º CNAE do cadastro). Não é média das atividades. O item predominante é marcado com \"S\" na Base_CNAE_Item; a Correlação repete a chave CNPJ|CNAE só nessa linha (coluna M).");
  sh.getRange("A7").setValue("RBT12 do enquadramento = RBT12 Proporcionalizada (RBT12p) quando o extrato do PGDAS-D a imprimir (empresa com menos de 12 meses de atividade); senão, RBT12 normal.");
  sh.getRange("A5:A7").setFontStyle("italic").setFontColor("#666666");

  if (novo || sh.getRange("B2").getValue() === "") sh.getRange("B2").setValue(0.088);
  if (novo || sh.getRange("B3").getValue() === "") sh.getRange("B3").setValue(0.001);
  if (novo || sh.getRange("B4").getValue() === "") sh.getRange("B4").setValue(0.05);
  sh.getRange("B2:B4").setNumberFormat("0.000%").setBackground("#ddebf7").setFontWeight("bold");

  // --- tabela oficial (linhas 8 a 39)
  // 10 colunas agora (A..J) — coluna J nova (01/09/2026): % de ICMS na
  // alíquota cheia, só preenchida nos Anexos I e II (usada quando a empresa
  // tem imunidade/isenção permanente de ICMS — coluna "Imunidade de ICMS").
  // 11 colunas (A..K) — coluna K nova (03/09/2026): % de PIS+COFINS na partilha,
  // usada quando a empresa não tem DAS no período.
  sh.getRange(8, 1, 32, 11).clearContent();
  sh.getRange("A8").setValue("TABELA OFICIAL SIMPLES NACIONAL — LC 123/2006 c/ LC 155/2016 (Anexos I a V) — " +
    "base da Alíquota Efetiva Cheia (coluna W) e da Alíquota de ISS destacada (coluna AB)")
    .setFontWeight("bold").setFontSize(11).setFontColor(VERDE_ESCURO);

  sh.getRange(9, 1, 1, 11).setValues([[
    "Anexo", "Faixa", "Até RBT12 (R$)", "Alíquota Nominal", "Valor a Deduzir", "Chave",
    "% ISS repartido no DAS", "% do DAS imune na exportação", "Observação",
    "% ICMS na Alíquota Cheia (Anexos I/II)", "% PIS+COFINS na Partilha (LC 123/2006)"
  ]]).setFontWeight("bold").setFontColor("#ffffff").setBackground(VERDE_MEDIO)
     .setHorizontalAlignment("center").setWrap(true);

  const linhas = [];
  ORDEM_ANEXOS_.forEach(function (romano) {
    const tab = TABELAS_SN_["Anexo " + romano];
    tab.forEach(function (f, i) {
      let obs;
      if (romano === "I" || romano === "II") obs = "Sem ISS (comércio/indústria)";
      else if (f.iss === 0)                  obs = "6ª faixa: ISS recolhido fora do DAS (não destacado)";
      else                                   obs = "ISS destacado na NF = Alíq. Efetiva × % repartição (teto 5%)";
      linhas.push([romano, i + 1, f.max, f.nom, f.ded, romano + "-" + (i + 1), f.iss,
                   percImuneExportacao_(romano, i + 1), obs, percIcmsPartilha_(romano, i + 1),
                   percPisCofinsPartilha_(romano, i + 1)]);
    });
  });
  sh.getRange(PAR_TAB_INI, 1, linhas.length, 11).setValues(linhas);
  sh.getRange(PAR_TAB_INI, 3, linhas.length, 1).setNumberFormat("R$ #,##0.00");
  sh.getRange(PAR_TAB_INI, 4, linhas.length, 1).setNumberFormat("0.0000%");
  sh.getRange(PAR_TAB_INI, 5, linhas.length, 1).setNumberFormat("R$ #,##0.00");
  sh.getRange(PAR_TAB_INI, 7, linhas.length, 2).setNumberFormat("0.00%");
  sh.getRange(PAR_TAB_INI, 9, linhas.length, 1).setFontSize(9).setFontStyle("italic").setFontColor("#555555");
  sh.getRange(PAR_TAB_INI, 10, linhas.length, 1).setNumberFormat("0.00%");
  sh.getRange(PAR_TAB_INI, 11, linhas.length, 1).setNumberFormat("0.00%");
  sh.getRange(PAR_TAB_INI, 1, linhas.length, 2).setHorizontalAlignment("center");
  sh.getRange(PAR_TAB_INI, 6, linhas.length, 1).setHorizontalAlignment("center");

  // --- base legal
  const notas = [
    ["Fórmula legal da alíquota efetiva", "Alíquota Efetiva = ((RBT12 × Alíquota Nominal) − Parcela a Deduzir) ÷ RBT12 — art. 18, §1º-A da LC 123/2006 (LC 155/2016)."],
    ["RBT12 proporcionalizada (RBT12p)", "Empresa com menos de 12 meses de atividade usa a RBT12p impressa pela Receita Federal no extrato do PGDAS-D (art. 18, §§ 2º a 4º da LC 123/2006). A coluna Y recebe esse valor e a coluna AA escolhe qual base entra no cálculo."],
    ["Teto do ISS no Simples", "A parcela de ISS dentro do DAS não pode exceder 5% da receita — art. 18, §§ 16 e 16-A da LC 123/2006. Aplicado na coluna AB."],
    ["6ª faixa dos Anexos III, IV e V", "RBT12 acima de R$ 3.600.000,00: o ISS deixa de ser recolhido no DAS e passa a ser devido diretamente ao Município (art. 18, §§ 16 e 17 da LC 123/2006). A coluna AB marca \"NÃO DESTACADO\" e a coluna AE soma esse ISS por fora, porque ele continua compondo a carga tributária total (alíquota em B4; teto de 5% pelo art. 8º-A da LC 116/2003)."],
    ["Limite de R$ 4.800.000,00", "Acima desse RBT12 a empresa fica excluída do Simples Nacional — art. 3º, II e §9º da LC 123/2006. As colunas V e W retornam \"EXCEDEU LIMITE\"."],
    ["Receita de EXPORTAÇÃO (colunas AG a AM)", "O extrato do PGDAS-D separa a receita em Mercado Interno e Mercado Externo. Na exportação são IMUNES: PIS/COFINS (CF art. 149, § 2º, I), IPI (CF art. 153, § 3º, III), ICMS (CF art. 155, § 2º, X, \"a\") e ISS (LC 116/2003, art. 2º, I; LC 123/2006, art. 18, § 14) — por isso vêm ZERADOS no DAS, e isso NÃO é falha de leitura do extrato. Continuam devidos IRPJ, CSLL e CPP. A coluna AL traz o % imune pela tabela de partilha do anexo/faixa e a coluna AM aplica esse desconto sobre a alíquota cheia. Cada mercado tem RBT12 e limite de R$ 4,8 mi próprios (art. 3º, § 14 da LC 123/2006): a coluna AA usa a RBT12 do mercado onde a receita foi auferida."],
    ["Exportação na Reforma (CBS/IBS)", "As exportações são imunes a CBS e IBS (CF art. 156-A, § 1º, III e art. 195, § 16; LC 214/2025, arts. 79 a 82), com manutenção dos créditos. Logo, sobre a parcela exportada NÃO incide a CBS de 8,8%: as colunas J, K e T multiplicam o valor por (100% − % de exportação). Para a empresa 100% exportadora, a carga híbrida 2027 é igual à carga atual."],
    ["Art. 127 — profissões intelectuais (colunas AN a AQ)", "A redução de 30% das profissões intelectuais (engenharia, arquitetura, agronomia, advocacia, contabilidade, medicina veterinária, economia, estatística, biologia/química, biblioteconomia, assistência social) é condicionada a REQUISITOS CUMULATIVOS do art. 127 da LC 214/2025. Um deles: a sociedade não pode exercer atividade DIVERSA da habilitação profissional dos sócios. Basta UM CNAE fora da habilitação para a redução cair a ZERO. A aferição é feita pelos itens da Lista de Serviços vinculados a cada CNAE: p.ex. 7119-7/03 (desenho técnico, item 32.01), 7020-4/00 (consultoria em gestão), 8219-9/99 (apoio administrativo) e 8599-6/04 (treinamento) NÃO são engenharia. As linhas zeradas ficam marcadas de AMARELO na aba \"Correlação CNAEs\", com a redução original na coluna P e o CNAE que descumpre na coluna R. Outro requisito — não ter pessoa jurídica no quadro societário — não é aferível pelo CNAE e precisa de conferência no contrato social."],
    ["Modelo do Comunicado (coluna AR)", "Empresas de ENGENHARIA e SAÚDE recebem o Comunicado Técnico de um modelo próprio; as demais, o modelo padrão. A classificação vem da aba \"Segmentos\" (lista oficial da planilha de reuniões) e, para quem não está na lista, do CNAE principal."],
    ["Redução da atividade (coluna S)", "Redução setorial de CBS/IBS conforme o item/NBS vinculado ao CNAE — arts. 344 a 348 da LC 214/2025. Vem do item predominante do CNAE PRINCIPAL (1º CNAE do cadastro), não da média das atividades."]
  ];
  const rIni = PAR_TAB_FIM + 2;
  sh.getRange(rIni, 1).setValue("BASE LEGAL DOS CÁLCULOS")
    .setFontWeight("bold").setFontSize(11).setFontColor(VERDE_ESCURO);
  sh.getRange(rIni + 1, 1, notas.length, 2).setValues(notas);
  sh.getRange(rIni + 1, 1, notas.length, 1).setFontWeight("bold").setFontSize(10).setFontColor(VERDE_MEDIO);
  sh.getRange(rIni + 1, 2, notas.length, 1).setFontSize(9).setWrap(true).setVerticalAlignment("top");

  const larguras = [260, 60, 130, 120, 120, 80, 110, 130, 430, 150];
  for (let i = 0; i < larguras.length; i++) sh.setColumnWidth(i + 1, larguras[i]);
  return sh;
}

// =============================================================================
// FÓRMULAS DA ABA "SIMPLES NACIONAL"
// Planilha em localidade Brasil: separador de argumentos é ";".
// =============================================================================

// Fórmulas do cenário híbrido (valores em R$ e percentuais derivados).
function formulasHibrido_(row, ix) {
  const c = function (i) { return getColunaLetra(i + 1) + row; };
  const das = c(ix.valorDas), fat = c(ix.faturamento), pis = c(ix.pis), cof = c(ix.cofins);
  const red = c(ix.reducao),  cbs = c(ix.cbsFora),     ibs = c(ix.ibsFora);
  const hib = c(ix.dasHibrido), cnpj = c(ix.cnpj), cheia = c(ix.aliqCheia);
  const cnaeP  = c(ix.cnaePrincipal);
  // Partilha oficial do anexo/faixa (aba "Parâmetros"): chave e % de PIS+COFINS.
  // Só entram na fórmula quando as três colunas existem na aba; sem elas as
  // fórmulas voltam a ser IDÊNTICAS às de antes (nenhuma linha muda de valor).
  const temPart = (ix.percPisCofins > -1 && ix.anexoApurado > -1 && ix.faixaRbt12 > -1);
  const pc      = temPart ? c(ix.percPisCofins) : "0";
  const acH     = temPart ? c(ix.anexoApurado)  : "";
  const vH      = temPart ? c(ix.faixaRbt12)    : "";
  const CHV_H   = "'Parâmetros'!$F$" + PAR_TAB_INI + ":$F$" + PAR_TAB_FIM;
  const PC_H    = "'Parâmetros'!$K$" + PAR_TAB_INI + ":$K$" + PAR_TAB_FIM;
  const temExportH = (ix.percExport > -1 && ix.aliqAjustada > -1);
  const exp = temExportH ? c(ix.percExport) : "0";
  const ajust = temExportH ? c(ix.aliqAjustada) : cheia;
  // Exportação é imune a CBS e IBS (CF art. 156-A, § 1º, III; LC 214/2025 arts. 79 a 82):
  // a nova contribuição só incide sobre a parcela NÃO exportada.
  const naoExp = "(1-" + exp + ")";
  const somaIbs = INCLUIR_IBS_NO_HIBRIDO ? ("+" + ibs) : "";
  return {
    // Redução = APENAS o CNAE principal, pelo seu item predominante.
    // Não é mais a média das atividades: a chave da coluna M da Correlação
    // ("CNPJ|7 dígitos do CNAE") só existe na linha do item predominante.
    reducao:       "=IFERROR(INDEX('Correlação CNAEs'!$" + COR_COL_REDUCAO + ":$" + COR_COL_REDUCAO + ";" +
                   "MATCH(" + cnpj + '&"|"&' + cnaeP + ";'Correlação CNAEs'!$" +
                   COR_COL_CHAVE_PRED_PESQ + ":$" + COR_COL_CHAVE_PRED_PESQ + ";0));" +
                   "IFERROR(INDEX('Correlação CNAEs'!$" + COR_COL_REDUCAO + ":$" + COR_COL_REDUCAO + ";" +
                   "MATCH(" + cnpj + '&"|"&' + cnaeP + ";'Correlação CNAEs'!$" +
                   COR_COL_CHAVE_PRED + ":$" + COR_COL_CHAVE_PRED + ";0));0))",
    dasLiquido:    "=IFERROR(MAX(" + das + "-" + pis + "-" + cof + ";0);0)",
    cbs:           "=IFERROR(" + fat + "*'Parâmetros'!$B$2*(1-" + red + ")*" + naoExp + ";0)",
    ibs:           "=IFERROR(" + fat + "*'Parâmetros'!$B$3*(1-" + red + ")*" + naoExp + ";0)",
    // base = alíquota efetiva AJUSTADA pela imunidade de exportação (coluna AM),
    // que é igual à alíquota cheia quando não há receita no mercado externo.
    dasHibrido:    "=IFERROR(" + ajust + "*" + fat + "-" + pis + "-" + cof + "+" + cbs + somaIbs + ";0)",
    // Sem faturamento no período não há DAS de onde extrair a alíquota praticada:
    // cai na alíquota efetiva da tabela (1ª faixa quando a RBT12 é 0), que é o
    // mesmo critério do diagnóstico "Sem faturamento" da coluna Status.
    aliqAtual:     "=IFERROR(IF(" + fat + ">0;" + das + "/" + fat + ";IF(" + ajust + '="";0;' + ajust + "));0)",
    // carga total híbrida = DAS híbrido / faturamento + ISS recolhido por fora
    // Sem faturamento o cenário híbrido não pode sair de valores em R$ (divisão
    // por zero): a carga é montada POR ALÍQUOTA — efetiva ajustada menos o
    // PIS/COFINS da partilha, mais a CBS reduzida (mais o IBS, se ligado).
    aliqHibrida:   temPart
                   ? ("=IFERROR(IF(" + fat + ">0;" + hib + "/" + fat + ";" +
                      "IF(" + ajust + '="";0;' + ajust + "*(1-" + pc + ")+'Parâmetros'!$B$2*(1-" + red + ")*" + naoExp +
                      (INCLUIR_IBS_NO_HIBRIDO ? ("+'Parâmetros'!$B$3*(1-" + red + ")*" + naoExp) : "") +
                      "))+" + c(ix.issFora) + ";0)")
                   : ("=IFERROR(" + hib + "/" + fat + "+" + c(ix.issFora) + ";0)"),
    // Sem DAS no período o % de PIS+COFINS vem da PARTILHA oficial do anexo/faixa
    // (coluna K da aba "Parâmetros"), e não do extrato.
    percPisCofins: temPart
                   ? ("=IFERROR(IF(" + das + ">0;(" + pis + "+" + cof + ")/" + das + ";" +
                      "IFERROR(INDEX(" + PC_H + ";MATCH(" + acH + '&"-"&' + vH + ";" + CHV_H + ";0));0));0)")
                   : ("=IFERROR((" + pis + "+" + cof + ")/" + das + ";0)"),
    diferenca:     "=IFERROR(" + hib + "-" + das + ";0)"
  };
}

// INDEX/MATCH na linha PREDOMINANTE da Correlação (chave CNPJ|7 dígitos do CNAE
// principal, coluna M — que só é preenchida na linha do item predominante).
function predCorrelacao_(refCnpj, refCnaePrinc, colunaOrigem) {
  // 01/09/2026: tenta primeiro a chave da PESQUISA MANUAL (empresas "VÁRIOS" cujo
  // item real faturado diverge do item do CNAE principal — ver
  // aplicarItensPesquisadosVarios()); sem override, cai na chave automática de sempre.
  // Nenhuma empresa sem override muda de valor (coluna S fica vazia).
  const chave = refCnpj + '&"|"&' + refCnaePrinc;
  const busca = function (colChave) {
    return "INDEX('Correlação CNAEs'!$" + colunaOrigem + ":$" + colunaOrigem + ";" +
           "MATCH(" + chave + ";'Correlação CNAEs'!$" + colChave + ":$" + colChave + ";0))";
  };
  return "=IFERROR(" + busca(COR_COL_CHAVE_PRED_PESQ) + ";IFERROR(" + busca(COR_COL_CHAVE_PRED) + ';""))';
}

// Fórmulas das colunas calculadas pela tabela oficial (V, W, X, AA, AB, AC).
// Ficam como FÓRMULA (e não valor) para que o fiscal veja a conta e para que
// digitar o RBT12p na coluna Y recalcule tudo sozinho.
function formulasCalculadas_(row, ix) {
  const c = function (i) { return "$" + getColunaLetra(i + 1) + row; };
  const C = c(ix.cnaes), D = c(ix.anexo), E = c(ix.rbt12), I = c(ix.faturamento), H = c(ix.valorDas);
  const V = c(ix.faixaRbt12), W = c(ix.aliqCheia), Y = c(ix.rbt12p);
  const AA = c(ix.rbt12Base), AB = c(ix.aliqISS), AC = c(ix.anexoApurado), AE = c(ix.issFora);
  // Fator R (coluna F) — 03/09/2026: passa a decidir o anexo quando o cadastro traz
  // "III/V (Fator R)". "com" (folha de salários >= 28% da receita, art. 18, §§ 5º-J
  // e 5º-M da LC 123/2006) -> Anexo III; "sem" -> Anexo V. Em branco (pendente) ou
  // "não é sujeito", NADA muda: continua valendo a regra antiga (anexo declarado no
  // extrato e, na falta dele, o de maior alíquota entre os listados).
  const temFatorR = (ix.fatorR > -1);
  const F = temFatorR ? c(ix.fatorR) : "";
  // Anexo declarado no extrato (coluna opcional — 02/09/2026): sem ela,
  // temAnexoExtrato fica false e a fórmula cai direto no critério de maior alíquota.
  const temAnexoExtrato = (ix.anexoExtrato > -1);
  const AW = temAnexoExtrato ? c(ix.anexoExtrato) : "";
  // colunas de exportação (AG a AM). Numa aba ainda não migrada elas não
  // existem: temExport fica false e as fórmulas voltam ao comportamento antigo.
  const temExport = (ix.recInterna > -1 && ix.recExterna > -1 && ix.percExport > -1 &&
                     ix.rbt12Interno > -1 && ix.rbt12Externo > -1 &&
                     ix.percImune > -1 && ix.aliqAjustada > -1);
  const AG = c(ix.recInterna), AH = c(ix.recExterna), AI = temExport ? c(ix.percExport) : "0";
  const AJ = c(ix.rbt12Interno), AK = c(ix.rbt12Externo);
  const AL = temExport ? c(ix.percImune) : "0";
  const AM = temExport ? c(ix.aliqAjustada) : W;
  const A  = c(ix.cnpj), AD = c(ix.cnaePrincipal);
  const NOM = "'Parâmetros'!$D$" + PAR_TAB_INI + ":$D$" + PAR_TAB_FIM;
  const DED = "'Parâmetros'!$E$" + PAR_TAB_INI + ":$E$" + PAR_TAB_FIM;
  const CHV = "'Parâmetros'!$F$" + PAR_TAB_INI + ":$F$" + PAR_TAB_FIM;
  const ISS = "'Parâmetros'!$G$" + PAR_TAB_INI + ":$G$" + PAR_TAB_FIM;
  const IMU = "'Parâmetros'!$H$" + PAR_TAB_INI + ":$H$" + PAR_TAB_FIM;
  // Imunidade de ICMS (coluna opcional — 01/09/2026): só entra na fórmula
  // quando a aba já tem a coluna "Imunidade de ICMS" (ix.icmsImune > -1).
  // Sem a coluna, temIcms fica false e a fórmula da AM volta a ser IDÊNTICA
  // à de antes — nenhuma empresa sem a coluna nova muda de valor.
  const temIcms = ix.icmsImune > -1;
  const AU = temIcms ? c(ix.icmsImune) : "";
  const ICM = "'Parâmetros'!$J$" + PAR_TAB_INI + ":$J$" + PAR_TAB_FIM;
  const MATCH_CHAVE = "MATCH(" + AC + '&"-"&' + V + ";" + CHV + ";0)";
  return {
    // 7 dígitos do 1º CNAE do cadastro — só funções padrão, para sobreviver ao xlsx
    cnaePrincipal: "=IF(" + C + '="";"";LEFT(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(' +
                   "IFERROR(LEFT(" + C + ';FIND(",";' + C + ")-1);" + C + ');".";"");"-";"");"/";"")&"0000000";7))',
    // Anexo usado no cálculo (reescrito em 02/09/2026).
    // Antes pegava o PRIMEIRO anexo antes da "/" na coluna D — ou seja, dependia
    // da ORDEM dos CNAEs no cadastro, que é arbitrária. Agora, para cadastro com
    // mais de um anexo (as "VÁRIOS"):
    //   1) o anexo que o PRÓPRIO EXTRATO declara ("tributados pelo Anexo III"),
    //      predominante por Receita Bruta Informada (coluna "Anexo no Extrato");
    //   2) não havendo, o de MAIOR alíquota efetiva entre os anexos listados na
    //      coluna D, na faixa da RBT12 Base. Pela tabela da LC 123/2006 isso é
    //      sempre o V, salvo RBT12 acima de R$ 4.320.000, quando o III passa o V
    //      na 6ª faixa (33% - 648.000 contra 30,5% - 540.000); entre I e II o
    //      maior é sempre o II; e o IV só ganha quando não há III nem V na lista.
    // Cadastro com um anexo só (inclusive quando o item pesquisado da aba VÁRIOS
    // já resolveu a coluna D) continua sendo respeitado como está.
    anexoApurado: "=IF(" + D + '="";"";' +
                  'IF(NOT(ISNUMBER(FIND("/";' + D + ")));TRIM(" + D + ");" +
                  (temAnexoExtrato ? ("IF(" + AW + '<>"";TRIM(' + AW + ");") : "") +
                  (temFatorR ? ('IF(AND(' + F + '="com";REGEXMATCH(' + D + ';"(^|/)III(/|$|\\s)"));"III";' +
                                'IF(AND(' + F + '="sem";REGEXMATCH(' + D + ';"(^|/)V(/|$|\\s)"));"V";') : "") +
                  'IF(AND(REGEXMATCH(' + D + ';"(^|/)V(/|$|\\s)");' +
                  'OR(NOT(REGEXMATCH(' + D + ';"(^|/)III(/|$|\\s)"));' + AA + '<=4320000));"V";' +
                  'IF(REGEXMATCH(' + D + ';"(^|/)III(/|$|\\s)");"III";' +
                  'IF(REGEXMATCH(' + D + ';"(^|/)IV(/|$|\\s)");"IV";' +
                  'IF(REGEXMATCH(' + D + ';"(^|/)II(/|$|\\s)");"II";"I"))))' +
                  (temFatorR ? "))" : "") + (temAnexoExtrato ? ")" : "") + "))",
    // RBT12 base: 1) RBT12p, se o extrato a imprimir; 2) RBT12 do MERCADO onde a
    // receita do período foi auferida (interno x externo têm RBT12 e limite de
    // R$ 4,8 mi próprios — art. 3º, § 14 da LC 123/2006); 3) RBT12 total.
    rbt12Base:    temExport
                  // 02/09/2026: se a média ponderada por mercado der 0 (extrato em que
                  // o interno veio zerado e a receita toda caiu no externo), volta para
                  // a RBT12 normal — senão a base fica 0 e a Faixa, a Alíquota Cheia e a
                  // Alíquota Efetiva Total Atual saem em branco.
                  ? ("=IF(AND(ISNUMBER(" + Y + ");" + Y + ">0);" + Y + ";" +
                     "IFERROR(IF(AND(" + AJ + "+" + AK + ">0;" + AG + "+" + AH + ">0;" +
                     "(" + AG + "*" + AJ + "+" + AH + "*" + AK + ")>0);" +
                     "(" + AG + "*" + AJ + "+" + AH + "*" + AK + ")/(" + AG + "+" + AH + ");" + E + ");" + E + "))")
                  : ("=IF(AND(ISNUMBER(" + Y + ");" + Y + ">0);" + Y + ";" + E + ")"),
    // % de exportação do período (receita externa / receita total do PA)
    percExport:   "=IFERROR(IF(" + AG + "+" + AH + "=0;0;" + AH + "/(" + AG + "+" + AH + "));0)",
    // % do DAS composto por tributos imunes na exportação (tabela de partilha)
    percImune:    "=IF(OR(" + V + '="";' + V + '="EXCEDEU LIMITE");0;' +
                  "IFERROR(INDEX(" + IMU + ";" + MATCH_CHAVE + ");0))",
    // alíquota efetiva realmente devida: retira da alíquota cheia a parcela
    // imune proporcional à receita exportada
    // Alíquota efetiva realmente devida: retira a parcela imune por
    // exportação e, quando a empresa tem imunidade/isenção permanente de ICMS
    // (coluna "Imunidade de ICMS" = "SIM"), também retira a parcela de ICMS da
    // alíquota cheia (tabela de partilha, coluna J de Parâmetros). Sem a
    // coluna nova (temIcms=false) ou sem imunidade marcada, o termo extra
    // desaparece e a fórmula fica igual à de antes.
    aliqAjustada: "=IF(" + W + "=\"\";\"\";IFERROR(" + W + "*(1-" + AI + "*" + AL + ")" +
                  (temIcms
                    ? ("-IF(" + AU + '="SIM";' + W + "*IFERROR(INDEX(" + ICM + ";" + MATCH_CHAVE + ");0);0)")
                    : "") +
                  ";\"\"))",
    faixa:        "=IF(OR(" + AC + '="I";' + AC + '="II";' + AC + '="III";' + AC + '="IV";' + AC + '="V");' +
                  "IF(OR(" + AA + '="";NOT(ISNUMBER(' + AA + ')));"";' +
                  "IF(" + AA + "<=180000;1;IF(" + AA + "<=360000;2;IF(" + AA + "<=720000;3;" +
                  "IF(" + AA + "<=1800000;4;IF(" + AA + "<=3600000;5;" +
                  "IF(" + AA + '<=4800000;6;"EXCEDEU LIMITE")))))));"")',
    // RBT12 zerada (empresa sem faturamento): a efetiva da 1ª faixa é a própria
    // alíquota NOMINAL — o valor a deduzir é zero e a conta padrão
    // ((base × nominal) − dedução) ÷ base cairia em divisão por zero.
    aliqCheia:    "=IF(OR(" + V + '="";' + V + '="EXCEDEU LIMITE");"";' +
                  "IF(" + AA + "=0;IFERROR(INDEX(" + NOM + ";" + MATCH_CHAVE + ');"");' +
                  "IFERROR((" + AA + "*INDEX(" + NOM + ";" + MATCH_CHAVE + ")" +
                  "-INDEX(" + DED + ";" + MATCH_CHAVE + "))/" + AA + ';"")))',
    aliqISS:      "=IF(OR(" + V + '="";' + V + '="EXCEDEU LIMITE");"";' +
                  "IF(OR(" + AC + '="I";' + AC + '="II");"NÃO POSSUI";' +
                  "IFERROR(IF(INDEX(" + ISS + ";" + MATCH_CHAVE + ')=0;"NÃO DESTACADO";' +
                  "MIN(" + W + "*INDEX(" + ISS + ";" + MATCH_CHAVE + ");" + (TETO_ISS * 100) + '%));"")))',
    issReais:     "=IFERROR(IF(ISNUMBER(" + W + ");MAX(" + W + "*" + I + "-" + H + ";0);0);0)",
    // 6ª faixa: o ISS sai do DAS (a coluna AB devolve "NÃO DESTACADO") e passa a
    // ser recolhido direto ao Município — continua compondo a carga total.
    issFora:      "=IF(" + AB + '="NÃO DESTACADO";' + "'Parâmetros'!$B$4*(1-" + AI + ");0)",
    aliqTotal:    "=IFERROR(IF(" + AM + '="";"";' + AM + "+" + AE + ');"")',
    // --- art. 127: espelham a linha do item predominante do CNAE principal
    //     (chave da coluna M da Correlação, que só existe nessa linha)
    habilitacao:  predCorrelacao_(A, AD, COR_COL_HABIL),
    redOriginal:  predCorrelacao_(A, AD, COR_COL_RED_ORIG),
    requisito127: predCorrelacao_(A, AD, COR_COL_REQ127),
    foraHabilit:  predCorrelacao_(A, AD, COR_COL_FORA127),
    // --- segmento: define o modelo do Comunicado
    segmento:     "=IFERROR(INDEX(Segmentos!$C:$C;MATCH(" + A + ";Segmentos!$A:$A;0));\"DEMAIS\")"
  };
}

function escreverFormulasHibrido_(sheet, row, ix) {
  const f = formulasHibrido_(row, ix);
  const MOEDA = "R$ #,##0.00", PCT = "0.00%";
  sheet.getRange(row, ix.reducao + 1).setFormula(f.reducao).setNumberFormat(PCT);
  sheet.getRange(row, ix.dasLiquido + 1).setFormula(f.dasLiquido).setNumberFormat(MOEDA);
  sheet.getRange(row, ix.cbsFora + 1).setFormula(f.cbs).setNumberFormat(MOEDA);
  sheet.getRange(row, ix.ibsFora + 1).setFormula(f.ibs).setNumberFormat(MOEDA);
  sheet.getRange(row, ix.dasHibrido + 1).setFormula(f.dasHibrido).setNumberFormat(MOEDA);
  sheet.getRange(row, ix.aliqEfetiva + 1).setFormula(f.aliqAtual).setNumberFormat(PCT);
  sheet.getRange(row, ix.aliqHibrida + 1).setFormula(f.aliqHibrida).setNumberFormat(PCT);
  if (ix.percPisCofins > -1) sheet.getRange(row, ix.percPisCofins + 1).setFormula(f.percPisCofins).setNumberFormat(PCT);
  if (ix.diferenca > -1)     sheet.getRange(row, ix.diferenca + 1).setFormula(f.diferenca).setNumberFormat(MOEDA);
}

function escreverFormulasCalculadas_(sheet, row, ix) {
  const f = formulasCalculadas_(row, ix);
  if (ix.cnaePrincipal > -1) sheet.getRange(row, ix.cnaePrincipal + 1).setFormula(f.cnaePrincipal).setNumberFormat("@");
  if (ix.anexoApurado > -1) sheet.getRange(row, ix.anexoApurado + 1).setFormula(f.anexoApurado);
  if (ix.rbt12Base > -1)    sheet.getRange(row, ix.rbt12Base + 1).setFormula(f.rbt12Base).setNumberFormat("R$ #,##0.00");
  if (ix.faixaRbt12 > -1)   sheet.getRange(row, ix.faixaRbt12 + 1).setFormula(f.faixa);
  if (ix.aliqCheia > -1)    sheet.getRange(row, ix.aliqCheia + 1).setFormula(f.aliqCheia).setNumberFormat("0.0000%");
  if (ix.aliqISS > -1)      sheet.getRange(row, ix.aliqISS + 1).setFormula(f.aliqISS).setNumberFormat("0.0000%");
  if (ix.issReais > -1)     sheet.getRange(row, ix.issReais + 1).setFormula(f.issReais).setNumberFormat("R$ #,##0.00");
  if (ix.percExport > -1)   sheet.getRange(row, ix.percExport + 1).setFormula(f.percExport).setNumberFormat("0.00%");
  if (ix.percImune > -1)    sheet.getRange(row, ix.percImune + 1).setFormula(f.percImune).setNumberFormat("0.00%");
  if (ix.aliqAjustada > -1) sheet.getRange(row, ix.aliqAjustada + 1).setFormula(f.aliqAjustada).setNumberFormat("0.0000%");
  if (ix.issFora > -1)      sheet.getRange(row, ix.issFora + 1).setFormula(f.issFora).setNumberFormat("0.0000%");
  if (ix.aliqTotal > -1)    sheet.getRange(row, ix.aliqTotal + 1).setFormula(f.aliqTotal).setNumberFormat("0.0000%");
  if (ix.habilitacao > -1)  sheet.getRange(row, ix.habilitacao + 1).setFormula(f.habilitacao);
  if (ix.redOriginal > -1)  sheet.getRange(row, ix.redOriginal + 1).setFormula(f.redOriginal).setNumberFormat("0.00%");
  if (ix.requisito127 > -1) sheet.getRange(row, ix.requisito127 + 1).setFormula(f.requisito127);
  if (ix.foraHabilit > -1)  sheet.getRange(row, ix.foraHabilit + 1).setFormula(f.foraHabilit);
  if (ix.segmento > -1)     sheet.getRange(row, ix.segmento + 1).setFormula(f.segmento).setHorizontalAlignment("center");
}

// =============================================================================
// FORMATAÇÃO CONDICIONAL DA COLUNA "Redução da Atividade (%)"
// -----------------------------------------------------------------------------
// A coluna S é uma das poucas visíveis na aba "Simples Nacional". Quando a
// redução foi ZERADA pelo art. 127, a célula fica AMARELA — assim o corte
// aparece na carteira sem precisar abrir colunas de apoio. O teste olha a coluna
// AP (Requisito do art. 127), que fica oculta.
// =============================================================================
function formatarColunaReducao_(sheet, ix) {
  if (!ix || ix.reducao < 0 || ix.requisito127 < 0) return;
  const colReq = getColunaLetra(ix.requisito127 + 1);
  const nLin = Math.max(sheet.getMaxRows() - 1, 1);
  const faixa = sheet.getRange(2, ix.reducao + 1, nLin, 1);
  const regra = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=ISNUMBER(SEARCH("' + TOKEN_127_ZERADA + '";$' + colReq + '2))')
    .setBackground(AMARELO_CEL_127)
    .setFontColor(AMARELO_TXT_127)
    .setRanges([faixa])
    .build();
  // preserva regras de outras colunas e substitui a nossa
  let antigas = [];
  try { antigas = sheet.getConditionalFormatRules() || []; } catch (e) { antigas = []; }
  const mantidas = antigas.filter(function (r) {
    try {
      return (r.getRanges() || []).every(function (rg) {
        return rg.getColumn() !== (ix.reducao + 1);
      });
    } catch (e) { return true; }
  });
  try { sheet.setConditionalFormatRules(mantidas.concat([regra])); } catch (e) { }
}

// =============================================================================
// 2b. RESTAURAR FÓRMULAS CALCULADAS (V, W, X, AA, AB, AC) EM TODAS AS LINHAS
// Use depois de colar dados por cima, ou para reparar o histórico já importado.
// Não relê nenhum PDF: as fórmulas recalculam sozinhas a partir de D, E e Y.
// =============================================================================
function restaurarFormulasCalculadas(silencioso) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // A tabela de partilha da aba "Parâmetros" ganhou a coluna K (% PIS+COFINS na
  // partilha) em 03/09/2026. Garantimos que ela exista ANTES de escrever as
  // fórmulas que a leem — criarAbaParametros_ preserva B2/B3/B4 já preenchidos.
  criarAbaParametros_(ss);
  const sheet = ss.getSheetByName("Simples Nacional");
  if (!sheet) { exibirAlerta("❌ Aba 'Simples Nacional' não encontrada."); return; }
  const ix = mapearColunas_SN_(sheet);
  try {
    validarIndicesColunas({
      "Anexo do Simples": ix.anexo, "RBT12": ix.rbt12, "Faixa RBT12": ix.faixaRbt12,
      "Alíquota Efetiva Cheia": ix.aliqCheia, "RBT12p": ix.rbt12p,
      "RBT12 Base": ix.rbt12Base, "Alíquota ISS destacada": ix.aliqISS,
      "Anexo Apurado": ix.anexoApurado, "CNAE Principal": ix.cnaePrincipal,
      "ISS fora do DAS": ix.issFora, "Alíquota Efetiva Total Atual": ix.aliqTotal
    });
  } catch (e) {
    exibirAlerta("❌ " + e.message + "\n\nRode antes: ⚙️ Automação 2027 > 🔧 Migrar Layout 2027.");
    return;
  }

  const nLinhas = sheet.getLastRow() - 1;
  if (nLinhas < 1) { exibirAlerta("ℹ️ Sem linhas para recalcular."); return; }
  const cnpjs = sheet.getRange(2, ix.cnpj + 1, nLinhas, 1).getValues();

  const cols = { cnaePrincipal: [], anexoApurado: [], rbt12Base: [], faixa: [],
                 aliqCheia: [], aliqISS: [], issReais: [], percExport: [], percImune: [],
                 aliqAjustada: [], issFora: [], aliqTotal: [],
                 habilitacao: [], redOriginal: [], requisito127: [], foraHabilit: [], segmento: [] };
  let ok = 0;
  for (let i = 0; i < nLinhas; i++) {
    const row = i + 2;
    const temCnpj = String(cnpjs[i][0]).trim() !== "";
    const f = temCnpj ? formulasCalculadas_(row, ix) : null;
    Object.keys(cols).forEach(function (k) { cols[k].push([f ? f[k] : ""]); });
    if (temCnpj) ok++;
  }
  sheet.getRange(2, ix.cnaePrincipal + 1, nLinhas, 1).setFormulas(cols.cnaePrincipal).setNumberFormat("@");
  sheet.getRange(2, ix.anexoApurado + 1, nLinhas, 1).setFormulas(cols.anexoApurado);
  sheet.getRange(2, ix.rbt12Base + 1, nLinhas, 1).setFormulas(cols.rbt12Base).setNumberFormat("R$ #,##0.00");
  sheet.getRange(2, ix.faixaRbt12 + 1, nLinhas, 1).setFormulas(cols.faixa);
  sheet.getRange(2, ix.aliqCheia + 1, nLinhas, 1).setFormulas(cols.aliqCheia).setNumberFormat("0.0000%");
  sheet.getRange(2, ix.aliqISS + 1, nLinhas, 1).setFormulas(cols.aliqISS).setNumberFormat("0.0000%");
  if (ix.issReais > -1) sheet.getRange(2, ix.issReais + 1, nLinhas, 1).setFormulas(cols.issReais).setNumberFormat("R$ #,##0.00");
  if (ix.percExport > -1)   sheet.getRange(2, ix.percExport + 1, nLinhas, 1).setFormulas(cols.percExport).setNumberFormat("0.00%");
  if (ix.percImune > -1)    sheet.getRange(2, ix.percImune + 1, nLinhas, 1).setFormulas(cols.percImune).setNumberFormat("0.00%");
  if (ix.aliqAjustada > -1) sheet.getRange(2, ix.aliqAjustada + 1, nLinhas, 1).setFormulas(cols.aliqAjustada).setNumberFormat("0.0000%");
  sheet.getRange(2, ix.issFora + 1, nLinhas, 1).setFormulas(cols.issFora).setNumberFormat("0.0000%");
  sheet.getRange(2, ix.aliqTotal + 1, nLinhas, 1).setFormulas(cols.aliqTotal).setNumberFormat("0.0000%");
  if (ix.habilitacao > -1)  sheet.getRange(2, ix.habilitacao + 1, nLinhas, 1).setFormulas(cols.habilitacao);
  if (ix.redOriginal > -1)  sheet.getRange(2, ix.redOriginal + 1, nLinhas, 1).setFormulas(cols.redOriginal).setNumberFormat("0.00%");
  if (ix.requisito127 > -1) sheet.getRange(2, ix.requisito127 + 1, nLinhas, 1).setFormulas(cols.requisito127);
  if (ix.foraHabilit > -1)  sheet.getRange(2, ix.foraHabilit + 1, nLinhas, 1).setFormulas(cols.foraHabilit);
  if (ix.segmento > -1)     sheet.getRange(2, ix.segmento + 1, nLinhas, 1).setFormulas(cols.segmento).setHorizontalAlignment("center");

  // 03/09/2026 — o recálculo passa a reescrever também as duas fórmulas do cenário
  // híbrido que dependem da tabela: a Alíquota Efetiva Híbrida 2027 e o % de
  // PIS+COFINS. Ambas ganharam o fallback por alíquota (empresa sem faturamento no
  // período: não há DAS de onde tirar PIS/COFINS em R$, então o % vem da partilha).
  // A "Alíquota Efetiva Atual" NÃO é reescrita aqui de propósito, para não apagar o
  // valor já diagnosticado nas linhas sem extrato.
  const hib = { aliqHibrida: [], percPisCofins: [] };
  for (let i = 0; i < nLinhas; i++) {
    const row = i + 2;
    const g = String(cnpjs[i][0]).trim() !== "" ? formulasHibrido_(row, ix) : null;
    hib.aliqHibrida.push([g ? g.aliqHibrida : ""]);
    hib.percPisCofins.push([g ? g.percPisCofins : ""]);
  }
  if (ix.aliqHibrida > -1)   sheet.getRange(2, ix.aliqHibrida + 1, nLinhas, 1).setFormulas(hib.aliqHibrida).setNumberFormat("0.00%");
  if (ix.percPisCofins > -1) sheet.getRange(2, ix.percPisCofins + 1, nLinhas, 1).setFormulas(hib.percPisCofins).setNumberFormat("0.00%");

  formatarColunaReducao_(sheet, ix);

  if (silencioso !== true) {
    exibirAlerta("✅ Fórmulas calculadas restauradas em " + ok + " linha(s).\n" +
      "Faixa RBT12, Alíquota Efetiva Cheia, ISS destacado, RBT12 base, Anexo apurado, CNAE principal, % de PIS+COFINS e Alíquota Efetiva Híbrida 2027 voltaram a se recalcular pela tabela oficial (LC 123/2006 c/ LC 155/2016).");
  }
  return ok;
}

// =============================================================================
// 1. IMPORTAÇÃO DAS PJ E CORRELAÇÃO CNAE × ITEM
// =============================================================================
function importarEmpresasPJ() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaSimulador = ss.getSheetByName("Simples Nacional");
  const abaCorrelacao = ss.getSheetByName("Correlação CNAEs");
  const abaBanco = ss.getSheetByName("Banco_Dados");
  const abaBaseCnae = ss.getSheetByName("Base_CNAE_Item");
  if (!abaSimulador || !abaCorrelacao || !abaBanco || !abaBaseCnae) {
    exibirAlerta("❌ Erro: abas não encontradas. Rode o Setup primeiro."); return;
  }

  try {
    // Item da Lista -> {NBS, redução}
    const dictNBS = lerBancoDados_(abaBanco);

    const dictCNAE = lerBaseCnaeItem_(abaBaseCnae);

    const planilhaPJ = comRetry_("abrir planilha de PJ", function () {
      return SpreadsheetApp.openById(ID_PLANILHA_PJ);
    });
    const dadosPJ = planilhaPJ.getSheets()[0].getDataRange().getValues();
    const headerPJ = dadosPJ[0];

    let idxCnpjPJ    = acharColuna(headerPJ, ["cnpj"]);
    let idxRazaoPJ   = acharColuna(headerPJ, ["razao", "nome"]);
    let idxMatrizPJ  = acharColuna(headerPJ, ["matriz"]);
    let idxTribPJ    = acharColuna(headerPJ, ["tributacao"]);
    let idxCnaePrinc = acharColuna(headerPJ, ["cnaeprincipal"]);
    let idxCnaeSec   = acharColuna(headerPJ, ["secundario"]);
    if (idxCnpjPJ === -1)    idxCnpjPJ = 3;
    if (idxRazaoPJ === -1)   idxRazaoPJ = 1;
    if (idxMatrizPJ === -1)  idxMatrizPJ = 9;
    if (idxTribPJ === -1)    idxTribPJ = 13;
    if (idxCnaePrinc === -1) idxCnaePrinc = 25;
    if (idxCnaeSec === -1)   idxCnaeSec = 26;

    const empresasParaSimulador = [];
    const cnaesParaCorrelacao = [];

    for (let i = 1; i < dadosPJ.length; i++) {
      const cnpj = String(dadosPJ[i][idxCnpjPJ] || "").trim();
      const razao = String(dadosPJ[i][idxRazaoPJ] || "").trim();
      const matrizFilial = String(dadosPJ[i][idxMatrizPJ] || "").trim().toUpperCase();
      const tributacao = String(dadosPJ[i][idxTribPJ] || "").trim().toUpperCase();
      if (cnpj === "" || cnpj.length <= 10 || matrizFilial !== "MATRIZ" || tributacao !== "S") continue;

      let todosCnaesStr = String(dadosPJ[i][idxCnaePrinc] || "").trim();
      if (dadosPJ[i][idxCnaeSec]) todosCnaesStr += "," + String(dadosPJ[i][idxCnaeSec] || "").trim();
      todosCnaesStr = todosCnaesStr.replace(/\n/g, ",").replace(/\s*,\s*/g, ",");

      empresasParaSimulador.push([cnpj, razao, todosCnaesStr]);

      const arrayCnaes = todosCnaesStr.split(",");
      for (let j = 0; j < arrayCnaes.length; j++) {
        const cnaeOriginal = arrayCnaes[j].trim();
        const digPJ = normalizar(cnaeOriginal);
        if (digPJ === "") continue;
        const dig7 = (digPJ + "0000000").substring(0, 7);
        const cnaeElegante = formatarCNAE(cnaeOriginal);
        const achado = itensDoCnae_(dictCNAE, dig7, dictNBS);
        montarLinhasCorrelacao_(cnaesParaCorrelacao, cnpj, razao, cnaeElegante,
                                achado.itens, dictNBS, dig7, achado.tipo);
      }
    }

    if (empresasParaSimulador.length === 0) { exibirAlerta("ℹ️ Nenhuma empresa elegível encontrada."); return; }

    const ultLinhaSimulador = abaSimulador.getLastRow() || 1;
    abaSimulador.getRange(ultLinhaSimulador + 1, 1, empresasParaSimulador.length, 3).setValues(empresasParaSimulador);
    const ix = mapearColunas_SN_(abaSimulador);
    abaSimulador.getRange(ultLinhaSimulador + 1, ix.selecionar + 1, empresasParaSimulador.length, 1).insertCheckboxes();

    // fórmulas das novas linhas
    for (let r = 0; r < empresasParaSimulador.length; r++) {
      const row = ultLinhaSimulador + 1 + r;
      escreverFormulasHibrido_(abaSimulador, row, ix);
      escreverFormulasCalculadas_(abaSimulador, row, ix);
    }

    gravarCorrelacao_(abaCorrelacao, cnaesParaCorrelacao);
    exibirAlerta("✅ Importação concluída.\n" + empresasParaSimulador.length +
      " empresa(s) adicionada(s) e " + cnaesParaCorrelacao.length +
      " linha(s) de correlação CNAE × Item (1 linha por item da Lista de Serviços).");
  } catch (e) {
    exibirAlerta("❌ Erro ao importar: " + e.message);
  }
}

// Lê a Base_CNAE_Item (A CNAE | B Descrição do CNAE | C Item | D Descrição do Item)
// e devolve raiz do CNAE (5 dígitos) -> lista de itens. Um CNAE pode ter vários
// itens da Lista de Serviços (110 dos 534 CNAEs têm: o 7020-4/00, por exemplo,
// tem 5 — 17.01, 17.03, 17.17, 17.20 e 35.01). Cada item gera a sua própria linha.
// Devolve DOIS índices: por subclasse (7 dígitos) e por raiz (5 dígitos).
// O casamento correto é pela SUBCLASSE; a raiz é só aproximação de última hora.
// Casar sempre pela raiz misturava subclasses irmãs com itens completamente
// diferentes — era isso que fazia o 7119-7/03 (desenho técnico, item 32.01)
// herdar o item 07.01 (Engenharia) do 7119-7/01 e ganhar 30% indevidos.
function lerBaseCnaeItem_(abaBaseCnae) {
  const dados = abaBaseCnae.getDataRange().getValues();
  const por7 = {}, por5 = {};
  for (let b = 1; b < dados.length; b++) {
    const dig = normalizar(dados[b][0]);
    if (dig === "") continue;
    const d7 = (dig + "0000000").substring(0, 7);
    const reg = {
      cnae:  String(dados[b][0]).trim(),
      dcnae: String(dados[b][1] || "").trim(),
      item:  String(dados[b][2] || "").trim(),
      ditem: String(dados[b][3] || "").trim(),
      pred:  String(dados[b][4] || "").trim().toUpperCase()
    };
    if (!por7[d7]) por7[d7] = [];
    por7[d7].push(reg);
    const raiz = d7.substring(0, 5);
    if (!por5[raiz]) por5[raiz] = [];
    por5[raiz].push(reg);
  }
  return { por7: por7, por5: por5 };
}

// Itens de um CNAE: subclasse exata primeiro; raiz só se a subclasse não existir.
// Quando vem da raiz, reelege UM predominante (as irmãs trazem cada uma o seu "S").
function itensDoCnae_(dictCNAE, dig7, dictNBS) {
  if (dictCNAE.por7 && dictCNAE.por7[dig7]) {
    return { itens: dictCNAE.por7[dig7], tipo: "exato (subclasse do CNAE)" };
  }
  const raiz = String(dig7).substring(0, 5);
  const lst = dictCNAE.por5 ? dictCNAE.por5[raiz] : null;
  if (!lst || lst.length === 0) return { itens: [], tipo: "" };
  let melhor = 0, melhorRed = -1;
  for (let k = 0; k < lst.length; k++) {
    const bd = dictNBS[chaveItem_(lst[k].item)];
    const rr = bd ? (Number(bd.reducao) || 0) : 0;
    if (rr > melhorRed) { melhorRed = rr; melhor = k; }
  }
  const out = [];
  for (let k = 0; k < lst.length; k++) {
    out.push({ cnae: lst[k].cnae, dcnae: lst[k].dcnae, item: lst[k].item,
               ditem: lst[k].ditem, pred: (k === melhor ? "S" : "N") });
  }
  return { itens: out, tipo: "por aproximação (raiz do CNAE)" };
}

// Lê o Banco_Dados (A Item | B Descrição | C NBS | D Redução | E Fundamento).
// Primeira ocorrência do item manda — mesma semântica do VLOOKUP.
function lerBancoDados_(abaBanco) {
  const dados = abaBanco.getDataRange().getValues();
  const dict = {};
  for (let i = 1; i < dados.length; i++) {
    const k = chaveItem_(dados[i][0]);
    if (k === "" || dict[k]) continue;
    dict[k] = {
      desc:      String(dados[i][1] || "").trim(),
      nbs:       String(dados[i][2] || "").trim(),
      reducao:   parseFloat(dados[i][3]) || 0,
      fundamento: String(dados[i][4] || "").trim()
    };
  }
  return dict;
}

// Monta as linhas da Correlação para um CNAE: uma linha por item da Lista.
function montarLinhasCorrelacao_(destino, cnpj, razao, cnaeElegante, itens, dictNBS, dig7, tipo) {
  // Uma linha por item, já no layout de 18 colunas. As posições do art. 127
  // (redOrig, req127, fora127, habil) entram vazias e são preenchidas depois por
  // aplicarArt127_ — assim a montagem não precisa conhecer a regra.
  const linha = function (item, dcnae, ditem, pred) {
    const bd = dictNBS[chaveItem_(item)];
    const l = new Array(18).fill("");
    l[COR_IX.cnpj]  = cnpj;
    l[COR_IX.razao] = razao;
    l[COR_IX.cnae]  = cnaeElegante;
    l[COR_IX.dcnae] = dcnae || "-";
    l[COR_IX.item]  = "'" + item;
    l[COR_IX.ditem] = (bd && bd.desc) ? bd.desc : (ditem || "-");
    l[COR_IX.nbs]   = bd ? bd.nbs : "Sem NBS";
    l[COR_IX.red]   = bd ? bd.reducao : 0;
    l[COR_IX.fund]  = bd ? bd.fundamento : "";
    l[COR_IX.dig]   = dig7;
    l[COR_IX.chave] = cnpj + "|" + cnaeElegante + "|" + item;
    l[COR_IX.pred]  = pred;
    l[COR_IX.chavePred] = pred === "S" ? (cnpj + "|" + dig7) : "";
    l[COR_IX.match] = tipo || "";
    return l;
  };
  if (itens && itens.length > 0) {
    for (let k = 0; k < itens.length; k++) {
      destino.push(linha(itens[k].item, itens[k].dcnae, itens[k].ditem,
                         itens[k].pred === "S" ? "S" : "N"));
    }
  } else {
    const l = linha("NS", "(CNAE sem item da Lista de Serviços)", "-", "S");
    l[COR_IX.item]  = "Não é Serviço";
    l[COR_IX.nbs]   = "-";
    l[COR_IX.red]   = 0;
    l[COR_IX.match] = "não consta da Base_CNAE_Item";
    destino.push(l);
  }
}

// Grava a Correlação inteira como VALORES — sem VLOOKUP do CNAE na coluna D.
// Era esse VLOOKUP que devolvia sempre o 1º item do CNAE e colapsava os CNAEs
// multi-item numa única linha. Descrições, NBS, redução e fundamento vêm do
// Banco_Dados na montagem, então cada linha traz o item correto.
function gravarCorrelacao_(abaCorrelacao, linhas) {
  const nCols = HEADERS_CORRELACAO.length;
  abaCorrelacao.getRange(1, 1, 1, nCols).setValues([HEADERS_CORRELACAO])
    .setFontWeight("bold").setBackground("#b45f06").setFontColor("#ffffff").setWrap(true);
  const ultLinha = abaCorrelacao.getLastRow();
  if (ultLinha > 1) abaCorrelacao.getRange(2, 1, ultLinha - 1, Math.max(abaCorrelacao.getLastColumn(), nCols)).clearContent();
  if (linhas.length === 0) return;

  // dedup pela chave CNPJ+CNAE+Item
  const vistos = {}, unicas = [];
  for (let i = 0; i < linhas.length; i++) {
    const k = linhas[i][COR_IX.chave];
    if (vistos[k]) continue;
    vistos[k] = true; unicas.push(linhas[i]);
  }
  // ART. 127: zera a redução das profissões intelectuais quando a empresa
  // exerce atividade diversa da habilitação e devolve as linhas a marcar.
  const art = aplicarArt127_(unicas);

  abaCorrelacao.getRange(2, 1, unicas.length, nCols).setValues(unicas);
  abaCorrelacao.getRange(2, COR_IX.red + 1, unicas.length, 2).setNumberFormat("0.00%");
  abaCorrelacao.getRange(2, COR_IX.item + 1, unicas.length, 1).setNumberFormat("@");
  abaCorrelacao.getRange(2, COR_IX.nbs + 1, unicas.length, 1).setNumberFormat("@");
  abaCorrelacao.getRange(2, COR_IX.pred + 1, unicas.length, 1).setHorizontalAlignment("center");
  // larguras: a leitura vai de A a L; o resto é chave/controle
  const larg = [150, 250, 90, 300, 80, 320, 160, 110, 130, 240, 200, 240, 400, 100, 220, 110, 200, 200];
  for (let c = 0; c < larg.length; c++) abaCorrelacao.setColumnWidth(c + 1, larg[c]);

  // --- AMARELO nas linhas cuja redução foi zerada pelo art. 127.
  // Uma única chamada com a matriz inteira: pintar linha a linha estouraria o
  // tempo de execução em 5.000+ linhas.
  const fundos = [], fontes = [];
  const marcada = {};
  for (let i = 0; i < art.amarelas.length; i++) marcada[art.amarelas[i]] = true;
  // colunas em amarelo FORTE: redução aplicada, redução original e o requisito
  const forteEm = {};
  forteEm[COR_IX.red] = true; forteEm[COR_IX.redOrig] = true; forteEm[COR_IX.req127] = true;
  for (let i = 0; i < unicas.length; i++) {
    const linhaFundo = [], linhaFonte = [];
    for (let c = 0; c < nCols; c++) {
      if (!marcada[i]) { linhaFundo.push(null); linhaFonte.push(null); continue; }
      linhaFundo.push(forteEm[c] ? AMARELO_CEL_127 : AMARELO_LINHA_127);
      linhaFonte.push(forteEm[c] ? AMARELO_TXT_127 : null);
    }
    fundos.push(linhaFundo); fontes.push(linhaFonte);
  }
  const alvo = abaCorrelacao.getRange(2, 1, unicas.length, nCols);
  alvo.setBackgrounds(fundos);
  alvo.setFontColors(fontes);
  abaCorrelacao.setFrozenRows(1);
  try { abaCorrelacao.setFrozenColumns(2); } catch (e) { }
  return art;
}

// =============================================================================
// 1b. RECONSTRUIR A CORRELAÇÃO A PARTIR DAS EMPRESAS JÁ IMPORTADAS
// Não toca na aba "Simples Nacional" — por isso não duplica empresas.
// =============================================================================
function reconstruirCorrelacaoCNAEs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaSimulador = ss.getSheetByName("Simples Nacional");
  const abaCorrelacao = ss.getSheetByName("Correlação CNAEs");
  const abaBaseCnae = ss.getSheetByName("Base_CNAE_Item");
  const abaBanco = ss.getSheetByName("Banco_Dados");
  if (!abaSimulador || !abaCorrelacao || !abaBaseCnae || !abaBanco) { exibirAlerta("❌ Erro: abas não encontradas."); return; }

  try {
    const dictNBS = lerBancoDados_(abaBanco);
    const ix = mapearColunas_SN_(abaSimulador);
    validarIndicesColunas({ CNPJ: ix.cnpj, "Razão Social": ix.empresa, "CNAEs (Todos)": ix.cnaes });

    const dictCNAE = lerBaseCnaeItem_(abaBaseCnae);

    const dadosSim = abaSimulador.getDataRange().getValues();
    // 01/09/2026: classificação automática ÚNICO/VÁRIOS (aprovado pela Vicky) —
    // substitui o preenchimento manual da coluna "CNAES", pela contagem real dos
    // CNAEs cadastrados em "CNAEs (Todos)". Coluna procurada por nome EXATO (não
    // pelo buscarIndiceColuna fuzzy, que colidiria com "CNAEs (Todos)"/"CNAEs fora
    // da habilitação..."). Se a coluna não existir na aba, colCnaesFlag = -1 e nada
    // é escrito (retrocompatível).
    const headersSim = dadosSim[0];
    const colCnaesFlag = headersSim.indexOf("CNAES");
    const flagsCnaes = [];
    let qtdUnico = 0, qtdVarios = 0;

    const linhas = [];
    for (let i = 1; i < dadosSim.length; i++) {
      const cnpj = String(dadosSim[i][ix.cnpj] || "").trim();
      const razao = String(dadosSim[i][ix.empresa] || "").trim();
      if (cnpj === "") { flagsCnaes.push(colCnaesFlag > -1 ? [dadosSim[i][colCnaesFlag]] : [""]); continue; }
      const todos = String(dadosSim[i][ix.cnaes] || "").trim().replace(/\n/g, ",").replace(/\s*,\s*/g, ",");
      const arrayCnaes = todos.split(",").filter(function (s) { return s.trim() !== ""; });

      if (arrayCnaes.length === 0) {
        flagsCnaes.push(["SEM CNAE"]);
      } else if (arrayCnaes.length === 1) {
        flagsCnaes.push(["ÚNICO"]); qtdUnico++;
      } else {
        flagsCnaes.push(["VÁRIOS"]); qtdVarios++;
      }

      for (let j = 0; j < arrayCnaes.length; j++) {
        const digPJ = normalizar(arrayCnaes[j].trim());
        if (digPJ === "") continue;
        const dig7 = (digPJ + "0000000").substring(0, 7);
        const cnaeElegante = formatarCNAE(arrayCnaes[j].trim());
        const achado = itensDoCnae_(dictCNAE, dig7, dictNBS);
        montarLinhasCorrelacao_(linhas, cnpj, razao, cnaeElegante,
                                achado.itens, dictNBS, dig7, achado.tipo);
      }
    }

    const art = gravarCorrelacao_(abaCorrelacao, linhas);

    if (colCnaesFlag > -1 && flagsCnaes.length > 0) {
      abaSimulador.getRange(2, colCnaesFlag + 1, flagsCnaes.length, 1).setValues(flagsCnaes);
    }

    atualizarAbaSegmentos_(ss);
    exibirAlerta("✅ Correlação CNAEs reconstruída: " + linhas.length + " linha(s) para " +
      (dadosSim.length - 1) + " empresa(s).\n" +
      "O CNAE é casado pela SUBCLASSE (7 dígitos); a raiz de 5 dígitos entra só como " +
      "aproximação, registrada na coluna " + COR_COL_MATCH + ".\n" +
      "A coluna 'Redução da Atividade' (S) vem do item predominante do CNAE principal.\n" +
      (colCnaesFlag > -1
        ? ("Coluna \"CNAES\" reclassificada automaticamente: " + qtdUnico + " ÚNICO / " + qtdVarios + " VÁRIOS.")
        : "") +
      (art && art.zerados > 0
        ? ("\n\n🟡 Art. 127 da LC 214/2025: " + art.zerados + " item(ns) de " + art.cnpjs +
           " empresa(s) com a redução de 30% ZERADA por atividade diversa da habilitação " +
           "profissional — linhas em AMARELO, com o CNAE que descumpre na coluna " +
           COR_COL_FORA127 + ".")
        : ""));
  } catch (e) {
    exibirAlerta("❌ Erro ao reconstruir: " + e.message);
  }
}

// =============================================================================
// 1c. ITEM DA LISTA PESQUISADO MANUALMENTE — EMPRESAS "VÁRIOS" (múltiplos CNAEs)
// -----------------------------------------------------------------------------
// Para empresa com 1 único CNAE, o item da Correlação já é o item real. Para
// empresa "VÁRIOS" (mais de um CNAE), o item que hoje entra no cálculo é o do
// CNAE PRINCIPAL (1º CNAE do cadastro) — mas o item de fato faturado pode ser
// outro. A Exemplo pesquisa manualmente (estagiários, nas notas fiscais) qual
// item cada empresa "VÁRIOS" realmente fatura; esta rotina lê essa pesquisa
// (aba "Itens Pesquisados VÁRIOS") e decide, por empresa:
//
//   • ITEM_UNICO_OK ................. pesquisa confirma o item já usado — nada muda.
//   • ITEM_UNICO_SOBRESCRITO ......... pesquisa aponta outro item, que já existe
//     como candidato de algum CNAE cadastrado da empresa -> sobrescreve, só para
//     ESTA empresa, a chave que o cálculo usa (coluna S, nova — NÃO mexe na
//     coluna P "item predominante do CNAE", que continua correta por CNAE).
//   • ITEM_UNICO_SEM_CANDIDATO ....... pesquisa aponta item que não é candidato
//     de nenhum CNAE cadastrado da empresa -> NÃO sobrescreve (evita inventar
//     CNAE/NBS), só marca para revisão manual.
//   • MULTIPLOS_ITENS_SEGREGACAO_PENDENTE  empresa fatura por mais de um item ->
//     não há segregação de receita por item hoje, então a redução não pode ser
//     calculada com segurança; marca em LARANJA (Correlação e Status da Simples
//     Nacional) para filtrar e não sobrescreve nada.
//   • SF_2026_SEM_FATURAMENTO / REVISAR_SF_SEM_ANO_ESPECIFICADO / PESQUISA_PENDENTE /
//     REVISAR_CODIGO_ITEM_INVALIDO ... apenas documentam, sem mexer no cálculo.
//
// Critérios confirmados com a Vicky (Exemplo) em 01/09/2026 antes de implementar
// (item pesquisado PREVALECE quando existe candidato; múltiplos itens SINALIZAM,
// não calculam; nova coluna fica na Correlação CNAEs; cor de marcação = laranja).
//
// Idempotente e re-executável — mas como "Reconstruir Correlação CNAEs" REGRAVA
// a aba inteira (limpa até a última coluna usada), rode esta função de novo
// sempre que rodar a 1️⃣b depois de importar/alterar empresas "VÁRIOS".
// =============================================================================
const ITEM_LISTA_REGEX_ = /^\d{1,2}\.\d{2}$/;

function colLetraParaIndice_(letra) { return letra.charCodeAt(0) - 64; } // só letras únicas A-Z

function classificarItemPesquisado_(itemBruto) {
  if (itemBruto === null || itemBruto === undefined || String(itemBruto).trim() === "") {
    return { status: "PESQUISA_PENDENTE", itens: [] };
  }
  const s = String(itemBruto).trim();
  const su = s.toUpperCase();
  if (su.indexOf("SF") !== -1) {
    return {
      status: (su.indexOf("2026") !== -1) ? "SF_2026_SEM_FATURAMENTO" : "REVISAR_SF_SEM_ANO_ESPECIFICADO",
      itens: []
    };
  }
  const partes = s.split(/[,\/;]/).map(function (p) { return p.trim(); }).filter(function (p) { return p !== ""; });
  const validos = partes.filter(function (p) { return ITEM_LISTA_REGEX_.test(p); });
  const invalidos = partes.filter(function (p) { return !ITEM_LISTA_REGEX_.test(p); });
  if (invalidos.length > 0) return { status: "REVISAR_CODIGO_ITEM_INVALIDO", itens: partes };
  if (validos.length > 1) return { status: "MULTIPLOS_ITENS_SEGREGACAO_PENDENTE", itens: validos };
  return { status: "ITEM_UNICO", itens: validos };
}

function aplicarItensPesquisadosVarios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaPesquisa = ss.getSheetByName(ABA_ITENS_PESQUISADOS);
  const abaCorrelacao = ss.getSheetByName("Correlação CNAEs");
  const abaSimulador = ss.getSheetByName("Simples Nacional");
  if (!abaPesquisa) {
    exibirAlerta("❌ Aba \"" + ABA_ITENS_PESQUISADOS + "\" não encontrada.\n\n" +
      "Cole ali a planilha de pesquisa dos estagiários, com as colunas:\n" +
      "CNPJ | Razão Social | CNAEs (Todos) | CNAES | Estagiário | Item da Lista\n\n" +
      "e rode esta opção de novo.");
    return;
  }
  if (!abaCorrelacao || !abaSimulador) { exibirAlerta("❌ Erro: abas do simulador não encontradas."); return; }

  try {
    // 1) lê a pesquisa (só nos interessam as empresas marcadas "VÁRIOS")
    const dadosPesq = abaPesquisa.getDataRange().getValues();
    const headerPesq = dadosPesq[0].map(function (h) { return String(h).trim(); });
    const iCnpjP = headerPesq.indexOf("CNPJ");
    const iCnaesFlagP = headerPesq.indexOf("CNAES");
    const iEstagiarioP = headerPesq.indexOf("Estagiário");
    const iItemP = headerPesq.indexOf("Item da Lista");
    if (iCnpjP < 0 || iCnaesFlagP < 0 || iItemP < 0) {
      exibirAlerta("❌ A aba \"" + ABA_ITENS_PESQUISADOS + "\" precisa ter as colunas CNPJ, CNAES e " +
        "\"Item da Lista\" (nomes exatos, iguais aos da planilha de pesquisa).");
      return;
    }
    const pesquisaPorCnpj = {};
    for (let i = 1; i < dadosPesq.length; i++) {
      const cnpjNorm = normalizar(dadosPesq[i][iCnpjP]);
      if (!cnpjNorm) continue;
      const flag = String(dadosPesq[i][iCnaesFlagP] || "").trim().toUpperCase();
      if (flag.indexOf("VÁRIOS") === -1 && flag.indexOf("VARIOS") === -1) continue;
      pesquisaPorCnpj[cnpjNorm] = {
        itemBruto: dadosPesq[i][iItemP],
        estagiario: iEstagiarioP >= 0 ? dadosPesq[i][iEstagiarioP] : ""
      };
    }
    if (Object.keys(pesquisaPorCnpj).length === 0) {
      exibirAlerta("⚠️ Nenhuma empresa \"VÁRIOS\" encontrada na aba de pesquisa.");
      return;
    }

    // 2) CNAE Principal de cada empresa (já calculado na Simples Nacional)
    const ixSN = mapearColunas_SN_(abaSimulador);
    validarIndicesColunas({ CNPJ: ixSN.cnpj, "CNAE Principal": ixSN.cnaePrincipal });
    const dadosSN = abaSimulador.getDataRange().getValues();
    const cnaePrincipalPorCnpj = {};
    for (let i = 1; i < dadosSN.length; i++) {
      const cnpjNorm = normalizar(dadosSN[i][ixSN.cnpj]);
      if (!cnpjNorm) continue;
      cnaePrincipalPorCnpj[cnpjNorm] = String(dadosSN[i][ixSN.cnaePrincipal] || "").trim();
    }

    // 3) lê a Correlação inteira em memória (inclui as colunas novas S:V, se já existirem)
    const idxV = colLetraParaIndice_(COR_COL_ESTAGIARIO_PESQ);
    const nColsAtual = Math.max(abaCorrelacao.getLastColumn(), idxV);
    const ultLinha = abaCorrelacao.getLastRow();
    const dadosCorr = abaCorrelacao.getRange(1, 1, ultLinha, nColsAtual).getValues();

    const idxS = colLetraParaIndice_(COR_COL_CHAVE_PRED_PESQ) - 1;
    const idxT = colLetraParaIndice_(COR_COL_ITEM_PESQUISADO) - 1;
    const idxU = colLetraParaIndice_(COR_COL_STATUS_PESQUISA) - 1;
    const idxVc = idxV - 1;
    dadosCorr[0][idxS] = "Chave Predominante — Pesquisa Manual (VÁRIOS)";
    dadosCorr[0][idxT] = "Item da Lista Pesquisado (VÁRIOS)";
    dadosCorr[0][idxU] = "Status da Pesquisa (VÁRIOS)";
    dadosCorr[0][idxVc] = "Estagiário Responsável (VÁRIOS)";

    const iCnpjC = 0, iCnaeDigC = COR_IX.dig, iItemC = COR_IX.item, iPredC = COR_IX.pred, iFundC = COR_IX.fund;

    const linhasPorCnpj = {};
    for (let r = 1; r < dadosCorr.length; r++) {
      const cnpjNorm = normalizar(dadosCorr[r][iCnpjC]);
      if (!cnpjNorm) continue;
      (linhasPorCnpj[cnpjNorm] = linhasPorCnpj[cnpjNorm] || []).push(r);
    }

    const contagem = {
      ITEM_UNICO_OK: 0, ITEM_UNICO_SOBRESCRITO: 0, ITEM_UNICO_SEM_CANDIDATO: 0,
      MULTIPLOS_ITENS_SEGREGACAO_PENDENTE: 0, SF_2026_SEM_FATURAMENTO: 0,
      REVISAR_SF_SEM_ANO_ESPECIFICADO: 0, REVISAR_CODIGO_ITEM_INVALIDO: 0,
      PESQUISA_PENDENTE: 0, SEM_CORRELACAO: 0
    };
    const linhasLaranja = {};
    const empresasMultiParaSN = {}; // cnpj -> true, para marcar a Status na Simples Nacional

    Object.keys(pesquisaPorCnpj).forEach(function (cnpj) {
      const linhasEmpresa = linhasPorCnpj[cnpj];
      const pesq = pesquisaPorCnpj[cnpj];
      if (!linhasEmpresa || linhasEmpresa.length === 0) { contagem.SEM_CORRELACAO++; return; }

      const cls = classificarItemPesquisado_(pesq.itemBruto);
      let statusFinal = cls.status;
      const itemTexto = String(pesq.itemBruto || "").trim();

      if (cls.status === "ITEM_UNICO") {
        const itemPesq = cls.itens[0];
        const cnaeP = cnaePrincipalPorCnpj[cnpj] || "";
        let linhaAtual = null;
        for (let k = 0; k < linhasEmpresa.length; k++) {
          const r = linhasEmpresa[k];
          if (String(dadosCorr[r][iCnaeDigC]) === cnaeP && dadosCorr[r][iPredC] === "S") { linhaAtual = r; break; }
        }
        const candidatas = linhasEmpresa.filter(function (r) { return String(dadosCorr[r][iItemC]) === itemPesq; });
        if (candidatas.length === 0) {
          statusFinal = "ITEM_UNICO_SEM_CANDIDATO";
          contagem.ITEM_UNICO_SEM_CANDIDATO++;
        } else if (linhaAtual !== null && String(dadosCorr[linhaAtual][iItemC]) === itemPesq) {
          statusFinal = "ITEM_UNICO_OK";
          contagem.ITEM_UNICO_OK++;
        } else {
          statusFinal = "ITEM_UNICO_SOBRESCRITO";
          contagem.ITEM_UNICO_SOBRESCRITO++;
          const predCand = candidatas.filter(function (r) { return dadosCorr[r][iPredC] === "S"; });
          const escolhida = predCand.length > 0 ? predCand[0] : candidatas[0];
          dadosCorr[escolhida][idxS] = dadosCorr[escolhida][iCnpjC] + "|" + cnaeP;
          dadosCorr[escolhida][iFundC] = String(dadosCorr[escolhida][iFundC] || "") +
            " | SOBRESCRITO por pesquisa manual da Exemplo em " + Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy") +
            " (item " + itemPesq + " é o realmente faturado; substitui a seleção automática pelo CNAE principal).";
          if (linhaAtual !== null) {
            dadosCorr[linhaAtual][iFundC] = String(dadosCorr[linhaAtual][iFundC] || "") +
              " | Deixou de valer no cálculo desta empresa: pesquisa manual identificou item " + itemPesq +
              " como o realmente faturado (ver linha marcada \"" + itemPesq + "\" na coluna " + COR_COL_ITEM_PESQUISADO + ").";
          }
        }
      } else if (cls.status === "MULTIPLOS_ITENS_SEGREGACAO_PENDENTE") {
        contagem.MULTIPLOS_ITENS_SEGREGACAO_PENDENTE++;
        linhasEmpresa.forEach(function (r) { linhasLaranja[r] = true; });
        empresasMultiParaSN[cnpj] = true;
      } else {
        contagem[cls.status] = (contagem[cls.status] || 0) + 1;
      }

      linhasEmpresa.forEach(function (r) {
        dadosCorr[r][idxT] = itemTexto;
        dadosCorr[r][idxU] = statusFinal;
        dadosCorr[r][idxVc] = pesq.estagiario || "";
      });
    });

    // 4) grava de volta (valores + laranja das MULTIPLOS_ITENS)
    abaCorrelacao.getRange(1, 1, dadosCorr.length, nColsAtual).setValues(dadosCorr);
    const fundos = [];
    for (let r = 1; r < dadosCorr.length; r++) {
      const linha = [];
      for (let c = 0; c < nColsAtual; c++) linha.push(linhasLaranja[r] ? LARANJA_MULTI_ITEM : null);
      fundos.push(linha);
    }
    if (fundos.length > 0) abaCorrelacao.getRange(2, 1, fundos.length, nColsAtual).setBackgrounds(fundos);

    // 5) marca em laranja a Status da Simples Nacional das empresas "múltiplos itens"
    //    (para dar pra filtrar direto no painel principal, como pedido)
    const cnpjsMulti = Object.keys(empresasMultiParaSN);
    if (cnpjsMulti.length > 0 && ixSN.status > -1) {
      for (let i = 1; i < dadosSN.length; i++) {
        const cnpjNorm = normalizar(dadosSN[i][ixSN.cnpj]);
        if (!empresasMultiParaSN[cnpjNorm]) continue;
        const linhaSheet = i + 1;
        const atual = String(dadosSN[i][ixSN.status] || "");
        if (atual.indexOf("MÚLTIPLOS ITENS DA LISTA") === -1) {
          const cel = abaSimulador.getRange(linhaSheet, ixSN.status + 1);
          cel.setValue("⚠️ MÚLTIPLOS ITENS DA LISTA — SEGREGAÇÃO PENDENTE | " + atual)
             .setBackground(LARANJA_MULTI_ITEM).setFontColor(LARANJA_MULTI_ITEM_TXT);
        }
      }
    }

    exibirAlerta("✅ Item pesquisado aplicado (empresas \"VÁRIOS\"):\n\n" +
      "• Já confirmado (nenhuma mudança): " + contagem.ITEM_UNICO_OK + "\n" +
      "• Sobrescrito pela pesquisa (item real diverge do CNAE principal): " + contagem.ITEM_UNICO_SOBRESCRITO + "\n" +
      "• Revisar — item pesquisado sem CNAE cadastrado correspondente: " + contagem.ITEM_UNICO_SEM_CANDIDATO + "\n" +
      "• Múltiplos itens — segregação pendente (marcadas em laranja): " + contagem.MULTIPLOS_ITENS_SEGREGACAO_PENDENTE + "\n" +
      "• SF em 2026 (sem faturamento): " + contagem.SF_2026_SEM_FATURAMENTO + "\n" +
      "• Revisar — \"SF\" sem ano especificado: " + contagem.REVISAR_SF_SEM_ANO_ESPECIFICADO + "\n" +
      "• Revisar — código de item inválido na pesquisa: " + contagem.REVISAR_CODIGO_ITEM_INVALIDO + "\n" +
      "• Pesquisa ainda pendente: " + contagem.PESQUISA_PENDENTE + "\n" +
      "• CNPJ sem linha na Correlação: " + contagem.SEM_CORRELACAO + "\n\n" +
      "Lembrete: rode esta opção de novo sempre que rodar \"1️⃣b Reconstruir Correlação CNAEs\" " +
      "depois desta — a reconstrução regrava a aba inteira e apaga estas colunas.");
  } catch (e) {
    exibirAlerta("❌ Erro ao aplicar item pesquisado: " + e.message);
  }
}

// =============================================================================
// 1d. ANEXO DO SIMPLES CORRIGIDO PELO ITEM PESQUISADO — EMPRESAS "VÁRIOS"
// -----------------------------------------------------------------------------
// Pedido da Vicky em 02/09/2026: para empresa "VÁRIOS", usar o Item da Lista
// pesquisado manualmente (mesma fonte da 1️⃣c) para achar o CNAE por onde a
// empresa REALMENTE fatura entre os cadastrados — e usar o Anexo DESSE CNAE
// (não o do CNAE principal) na coluna "Anexo do Simples Nacional". Reaproveita
// o mesmo casamento item→CNAE de aplicarItensPesquisadosVarios() (mesma
// "escolhida": item já bate no CNAE principal, ou no candidato marcado "S" na
// Correlação, ou no primeiro candidato).
//
// Fonte do Anexo por CNAE: ANEXO_POR_CNAE_RAIZ_ abaixo — raiz de 5 dígitos,
// pesquisada e cruzada em ≥2 fontes contábeis por código (Rodadas 6 e 8 da
// auditoria). Raiz sem entrada na tabela NÃO é tocada (nunca inventa Anexo).
// "III/V (Fator R)" = depende da folha de pagamento; nesses casos a coluna
// Fator R fica em branco (pendente) em vez de herdar um "com"/"sem" que não é
// mais confiável depois da troca de CNAE. Anexo fixo (sem "Fator R") grava
// Fator R = "não é sujeito", igual à correção da Rodada 7.
// =============================================================================
const ANEXO_POR_CNAE_RAIZ_ = {
  "01512": "I",
  "01610": "III",
  "01628": "III",
  "10911": "II",
  "18130": "II",
  "18229": "III",
  "25128": "II",
  "33112": "III",
  "33121": "III",
  "33147": "III",
  "33210": "III",
  "33295": "III",
  "41204": "IV",
  "42111": "IV",
  "42138": "IV",
  "42219": "IV",
  "42227": "IV",
  "42928": "IV",
  "42995": "IV",
  "43118": "IV",
  "43134": "IV",
  "43193": "IV",
  "43215": "IV",
  "43223": "IV",
  "43291": "III",
  "43304": "IV",
  "43916": "IV",
  "43991": "III/V (Fator R)",
  "45307": "III/V (Fator R)",
  "46133": "III/V (Fator R)",
  "46141": "III/V (Fator R)",
  "46150": "III/V (Fator R)",
  "46176": "III/V (Fator R)",
  "46184": "III/V (Fator R)",
  "46192": "III/V (Fator R)",
  "46231": "I",
  "46397": "I",
  "46451": "I",
  "46524": "I",
  "46648": "I",
  "46656": "I",
  "46737": "I",
  "47121": "I",
  "47211": "I",
  "47237": "I",
  "47296": "I",
  "47423": "I",
  "47440": "I",
  "47521": "I",
  "47539": "I",
  "47547": "I",
  "47555": "I",
  "47571": "I",
  "47598": "I",
  "47610": "I",
  "47636": "I",
  "47725": "I",
  "47814": "I",
  "47822": "I",
  "47890": "I",
  "49302": "III",
  "53105": "III",
  "55906": "III",
  "56112": "I",
  "59111": "III",
  "59120": "III",
  "59201": "III",
  "61108": "III",
  "61906": "III",
  "62015": "III/V (Fator R)",
  "62023": "III/V (Fator R)",
  "62031": "III/V (Fator R)",
  "62040": "III/V (Fator R)",
  "62091": "III/V (Fator R)",
  "63119": "III/V (Fator R)",
  "63194": "III/V (Fator R)",
  "63992": "III",
  "66223": "III",
  "68102": "I",
  "68218": "III/V (Fator R)",
  "68226": "III/V (Fator R)",
  "69117": "IV",
  "70204": "III/V (Fator R)",
  "71111": "III/V (Fator R)",
  "71120": "III/V (Fator R)",
  "71197": "III/V (Fator R)",
  "71201": "III/V (Fator R)",
  "72100": "III/V (Fator R)",
  "72207": "III/V (Fator R)",
  "73114": "III/V (Fator R)",
  "73122": "III",
  "73190": "III/V (Fator R)",
  "74102": "III/V (Fator R)",
  "74200": "III",
  "74901": "III/V (Fator R)",
  "77110": "III",
  "77195": "III",
  "77314": "III",
  "77322": "III",
  "77331": "III",
  "77390": "III",
  "79112": "III",
  "81117": "IV",
  "81214": "IV",
  "81290": "IV",
  "82113": "III",
  "82199": "III",
  "82202": "III",
  "82300": "III",
  "82911": "III",
  "82997": "III",
  "85414": "III",
  "85422": "III/V (Fator R)",
  "85503": "III/V (Fator R)",
  "85937": "III",
  "85996": "III",
  "86101": "III/V (Fator R)",
  "86305": "III/V (Fator R)",
  "86402": "III/V (Fator R)",
  "86500": "III/V (Fator R)",
  "86607": "III/V (Fator R)",
  "86909": "III/V (Fator R)",
  "87123": "III",
  "90019": "III",
  "90027": "III/V (Fator R)",
  "93131": "III/V (Fator R)",
  "93191": "III",
  "95118": "III",
  "95126": "III",
  "95215": "III",
  "96017": "III"
};

function corrigirAnexoPorItemPesquisado() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaPesquisa = ss.getSheetByName(ABA_ITENS_PESQUISADOS);
  const abaCorrelacao = ss.getSheetByName("Correlação CNAEs");
  const abaSimulador = ss.getSheetByName("Simples Nacional");
  if (!abaPesquisa) { exibirAlerta("❌ Aba \"" + ABA_ITENS_PESQUISADOS + "\" não encontrada."); return; }
  if (!abaCorrelacao || !abaSimulador) { exibirAlerta("❌ Erro: abas do simulador não encontradas."); return; }

  try {
    const ixSN = mapearColunas_SN_(abaSimulador);
    validarIndicesColunas({ CNPJ: ixSN.cnpj, "CNAE Principal": ixSN.cnaePrincipal,
                             "Anexo do Simples": ixSN.anexo, "Fator R": ixSN.fatorR });
    const dadosSN = abaSimulador.getDataRange().getValues();
    const headersSN = dadosSN[0];
    const colCnaesFlag = headersSN.indexOf("CNAES");
    if (colCnaesFlag < 0) {
      exibirAlerta("❌ Coluna \"CNAES\" não encontrada na Simples Nacional — rode 1️⃣b antes.");
      return;
    }

    // 1) empresas "VÁRIOS" — flag OFICIAL é a da própria Simples Nacional (a
    //    da aba de pesquisa pode estar desatualizada, ver nota abaixo).
    const cnaePrincipalPorCnpj = {}, rowPorCnpj = {}, variosSet = {};
    for (let i = 1; i < dadosSN.length; i++) {
      const cnpjNorm = normalizar(dadosSN[i][ixSN.cnpj]);
      if (!cnpjNorm) continue;
      rowPorCnpj[cnpjNorm] = i + 1;
      cnaePrincipalPorCnpj[cnpjNorm] = String(dadosSN[i][ixSN.cnaePrincipal] || "").trim();
      if (String(dadosSN[i][colCnaesFlag] || "").trim() === "VÁRIOS") variosSet[cnpjNorm] = true;
    }

    // 2) item pesquisado por CNPJ. IMPORTANTE: lido por CNPJ, ignorando a
    //    coluna "CNAES" da PRÓPRIA aba de pesquisa — ela só é atualizada
    //    manualmente pelos estagiários e fica desatualizada sempre que a 1️⃣b
    //    reclassifica ÚNICO/VÁRIOS direto na Simples Nacional (empresa que
    //    virou "VÁRIOS" depois da última pesquisa não pode ficar de fora só
    //    por causa de um texto antigo nessa coluna).
    const dadosPesq = abaPesquisa.getDataRange().getValues();
    const headerPesq = dadosPesq[0].map(function (h) { return String(h).trim(); });
    const iCnpjP = headerPesq.indexOf("CNPJ"), iItemP = headerPesq.indexOf("Item da Lista");
    if (iCnpjP < 0 || iItemP < 0) {
      exibirAlerta("❌ Aba \"" + ABA_ITENS_PESQUISADOS + "\" precisa ter as colunas CNPJ e \"Item da Lista\".");
      return;
    }
    const itemPorCnpj = {};
    for (let i = 1; i < dadosPesq.length; i++) {
      const cnpjNorm = normalizar(dadosPesq[i][iCnpjP]);
      if (!cnpjNorm || itemPorCnpj[cnpjNorm] !== undefined) continue;
      itemPorCnpj[cnpjNorm] = dadosPesq[i][iItemP];
    }

    // 3) Correlação inteira em memória
    const dadosCorr = abaCorrelacao.getDataRange().getValues();
    const linhasPorCnpj = {};
    for (let r = 1; r < dadosCorr.length; r++) {
      const cnpjNorm = normalizar(dadosCorr[r][COR_IX.cnpj]);
      if (!cnpjNorm) continue;
      (linhasPorCnpj[cnpjNorm] = linhasPorCnpj[cnpjNorm] || []).push(r);
    }

    const AZUL_ANEXO_ITEM = "#CFE2F3";
    const marcador = " | Anexo corrigido pelo item pesquisado (VÁRIOS) " +
                     Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy");
    let aplicados = 0, jaCorreto = 0, semCandidato = 0, semFonte = 0, outros = 0;

    Object.keys(variosSet).forEach(function (cnpj) {
      const linhasEmpresa = linhasPorCnpj[cnpj];
      if (!linhasEmpresa || linhasEmpresa.length === 0) { outros++; return; }

      const cls = classificarItemPesquisado_(itemPorCnpj[cnpj]);
      if (cls.status !== "ITEM_UNICO") { outros++; return; }
      const itemPesq = cls.itens[0];
      const cnaeP = cnaePrincipalPorCnpj[cnpj] || "";

      let linhaAtual = null;
      for (let k = 0; k < linhasEmpresa.length; k++) {
        const r = linhasEmpresa[k];
        if (String(dadosCorr[r][COR_IX.dig]) === cnaeP && dadosCorr[r][COR_IX.pred] === "S") { linhaAtual = r; break; }
      }
      const candidatas = linhasEmpresa.filter(function (r) { return String(dadosCorr[r][COR_IX.item]) === itemPesq; });
      if (candidatas.length === 0) { semCandidato++; return; }

      const jaBateComPrincipal = (linhaAtual !== null && String(dadosCorr[linhaAtual][COR_IX.item]) === itemPesq);
      const predCand = candidatas.filter(function (r) { return dadosCorr[r][COR_IX.pred] === "S"; });
      const escolhida = jaBateComPrincipal ? linhaAtual : (predCand.length > 0 ? predCand[0] : candidatas[0]);

      const digEscolhida = String(dadosCorr[escolhida][COR_IX.dig] || "");
      const raiz = digEscolhida.substring(0, 5);
      const novoAnexo = ANEXO_POR_CNAE_RAIZ_[raiz];
      if (!novoAnexo) { semFonte++; return; }

      const row = rowPorCnpj[cnpj];
      const atual = String(dadosSN[row - 1][ixSN.anexo] || "").trim();
      if (atual === novoAnexo) { jaCorreto++; return; }

      abaSimulador.getRange(row, ixSN.anexo + 1).setValue(novoAnexo).setBackground(AZUL_ANEXO_ITEM);
      if (novoAnexo.indexOf("Fator R") > -1) {
        abaSimulador.getRange(row, ixSN.fatorR + 1).setValue("").setBackground(AZUL_ANEXO_ITEM);
      } else {
        abaSimulador.getRange(row, ixSN.fatorR + 1).setValue("não é sujeito").setBackground(AZUL_ANEXO_ITEM);
      }
      if (ixSN.status > -1) {
        const statusAtual = String(dadosSN[row - 1][ixSN.status] || "");
        if (statusAtual.indexOf("Anexo corrigido pelo item pesquisado") === -1) {
          abaSimulador.getRange(row, ixSN.status + 1).setValue(statusAtual + marcador);
        }
      }
      aplicados++;
    });

    exibirAlerta("✅ Anexo corrigido pelo item pesquisado (empresas \"VÁRIOS\"):\n\n" +
      "• Corrigidos agora: " + aplicados + "\n" +
      "• Já estavam corretos: " + jaCorreto + "\n" +
      "• Sem CNAE candidato pro item pesquisado (revisar cadastro): " + semCandidato + "\n" +
      "• CNAE identificado mas sem Anexo pesquisado na tabela (não mexido): " + semFonte + "\n" +
      "• Sem item pesquisado único (pendente/múltiplo/SF/inválido — ver 1️⃣c): " + outros + "\n\n" +
      "Lembrete: rode de novo sempre que a pesquisa \"" + ABA_ITENS_PESQUISADOS + "\" for atualizada, ou depois de \"1️⃣b Reconstruir Correlação CNAEs\".");
  } catch (e) {
    exibirAlerta("❌ Erro ao corrigir Anexo pelo item pesquisado: " + e.message);
  }
}

// =============================================================================
// COMPETÊNCIA E BUSCA DOS EXTRATOS NO DRIVE
// =============================================================================
function montarCompetencia_(input) {
  const partes = String(input).trim().split("/");
  const mes = partes[0], ano = partes[1];
  const compLimpa = mes + ano;
  const variacoes = [compLimpa, ano + mes, mes + "-" + ano, ano + "-" + mes, mes + "." + ano];
  const meses = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
                 "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  const nomeMes = meses[parseInt(mes, 10) - 1];
  if (nomeMes) variacoes.push(nomeMes);
  return { compLimpa: compLimpa, variacoes: variacoes, inputOriginal: String(input).trim(),
           mesPA: parseInt(mes, 10), anoPA: parseInt(ano, 10) };
}

function obterDadosCompetencia_IBSCBS() {
  const ui = SpreadsheetApp.getUi();
  let prompt;
  try {
    prompt = ui.prompt('📅 Competência do Extrato',
      'Digite o mês/ano do extrato no formato MM/AAAA\n(Exemplo: 06/2026):', ui.ButtonSet.OK_CANCEL);
  } catch (e) { return null; }
  if (prompt.getSelectedButton() !== ui.Button.OK) return null;
  const input = prompt.getResponseText().trim();
  if (!/^\d{2}\/\d{4}$/.test(input)) { ui.alert('❌ Formato inválido! Use MM/AAAA (ex.: 06/2026).'); return null; }
  return montarCompetencia_(input);
}

function buscarPastaEmpresa_IBSCBS(pastaPai, nomeEmpresa) {
  const nomeLimpo = String(nomeEmpresa).replace(/[^\wÀ-ÿ\s]/gi, ' ').replace(/\s+/g, ' ').trim();
  const palavras = nomeLimpo.split(" ").slice(0, 3);
  if (palavras.length === 0) return null;
  const termoJunto = palavras.join(" ");
  const buscaJunta = pastaPai.searchFolders("title contains '" + termoJunto + "'");
  if (buscaJunta.hasNext()) return buscaJunta.next();
  const querySeparada = palavras.map(function (p) { return "title contains '" + p + "'"; }).join(" and ");
  const buscaSeparada = pastaPai.searchFolders(querySeparada);
  if (buscaSeparada.hasNext()) return buscaSeparada.next();
  return null;
}

function encontrarPastaMes_IBSCBS(pastaEmpresa, variacoes, anoPAStr) {
  const subPastas = pastaEmpresa.getFolders();
  const pastasAno = [];
  while (subPastas.hasNext()) {
    const sub = subPastas.next();
    const nome = sub.getName().toUpperCase().replace(/\s+/g, '');
    for (let i = 0; i < variacoes.length; i++) if (nome.indexOf(variacoes[i]) !== -1) return sub;
    if (anoPAStr && nome.indexOf(anoPAStr) !== -1) pastasAno.push(sub);
  }
  for (let k = 0; k < pastasAno.length; k++) {
    const subs = pastasAno[k].getFolders();
    while (subs.hasNext()) {
      const subMes = subs.next();
      const nomeMes = subMes.getName().toUpperCase().replace(/\s+/g, '');
      for (let j = 0; j < variacoes.length; j++) if (nomeMes.indexOf(variacoes[j]) !== -1) return subMes;
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// ESCOLHA DO EXTRATO NA PASTA (reescrito em 02/09/2026)
// A pasta do mês quase sempre tem mais de um PDF: a apuração ORIGINAL e as
// RETIFICADORAS. A versão anterior devolvia o PRIMEIRO PDF cujo nome tinha
// "PGDASD"/"EXTRATO", o que podia trazer uma apuração já superada.
// Agora lemos os candidatos e ficamos com o mais recente pela data IMPRESSA NO
// DOCUMENTO ("Gerado em" / "Apurado em") — a data de modificação do Drive não
// serve, porque o arquivo pode ter sido apenas re-salvo ou movido de pasta.
// Ordem de preferência:
//   1) extrato do PA pedido, o de data interna mais recente;
//   2) não havendo nenhum do PA pedido, o PA mais recente ANTERIOR ao pedido
//      (a linha sai com aviso no Status dizendo de que competência veio).
// -----------------------------------------------------------------------------

// Data impressa no extrato, em ms (a maior entre "Gerado em" e "Apurado em").
function dataInternaExtrato_(texto) {
  const re = /(?:Gerado|Apurado)\s*em\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/gi;
  const t = String(texto || "");
  let quando = 0, m;
  while ((m = re.exec(t)) !== null) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]),
                       Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0)).getTime();
    if (d > quando) quando = d;
  }
  return quando;
}

// PA declarado no extrato ("Período de Apuração (PA): 07/2026") em MMAAAA.
function paDoExtrato_(texto) {
  const m = String(texto || "").match(
    /Per[ií]odo\s*de\s*Apura[cç][aã]o\s*\(\s*PA\s*\)\s*:?\s*(\d{2})\s*\/\s*(\d{4})/i);
  return m ? (m[1] + m[2]) : "";
}

// MMAAAA -> AAAAMM, só para comparar competências.
function paOrdem_(paMMAAAA) {
  const s = String(paMMAAAA || "");
  return s.length === 6 ? Number(s.slice(2) + s.slice(0, 2)) : 0;
}

// Acumula numa lista os PDFs de uma pasta que têm cara de extrato/declaração.
function candidatosExtrato_(pasta, saida) {
  const arquivos = pasta.getFilesByType(MimeType.PDF);
  while (arquivos.hasNext()) {
    const arq = arquivos.next();
    const nome = arq.getName().toUpperCase();
    if (nome.includes("RECIBO") && !nome.includes("EXTRATO") && !nome.includes("DECLARA")) continue;
    if (nome.includes("PGDASD") || nome.includes("EXTRATO") || nome.includes("DECLARA")) saida.push(arq);
  }
  return saida;
}

// Desempate: PA pedido > competência mais nova > data interna mais nova.
// Ranking do tipo de arquivo. Só o EXTRATO traz o bloco "Informações sobre DAS
// Gerado" (DAS, PIS, COFINS). A DECLARAÇÃO (PGDASD-DECLARACAO) não tem esses
// valores, então só serve como último recurso e nunca deve ganhar do extrato.
function tipoExtrato_(nome) {
  const n = String(nome || "").toUpperCase();
  if (n.includes("DECLARA")) return 0;
  if (n.includes("EXTRATO")) return 2;
  return 1;
}

// Desempate: tipo de arquivo > PA pedido > competência mais nova > data interna.
function melhorExtrato_(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.tipo !== b.tipo)   return a.tipo > b.tipo ? a : b;
  if (a.doPA !== b.doPA)   return a.doPA > b.doPA ? a : b;
  if (a.ordem !== b.ordem) return a.ordem > b.ordem ? a : b;
  return a.quando >= b.quando ? a : b;
}

// Lê os candidatos (com teto de leituras, porque cada uma é uma conversão no
// Drive) e devolve { arquivo, texto, paLido, ordem, doPA, quando }.
function escolherExtrato_(candidatos, compLimpa, nomeTemp) {
  const LIMITE_LEITURAS = 8;
  const alvo = paOrdem_(compLimpa);
  // Extrato antes de declaração: evita gastar conversão do Drive com arquivo
  // que não tem os valores do DAS.
  const fila = candidatos.slice().sort(function (a, b) {
    return tipoExtrato_(b.getName()) - tipoExtrato_(a.getName());
  });
  let melhor = null, lidos = 0;
  for (let i = 0; i < fila.length && lidos < LIMITE_LEITURAS; i++) {
    const tipo = tipoExtrato_(fila[i].getName());
    if (melhor && melhor.tipo > tipo) continue;   // já temos um arquivo melhor
    let texto = "";
    try { texto = lerTextoDoPdf_(fila[i], nomeTemp); lidos++; } catch (e) { continue; }
    const pa = paDoExtrato_(texto);
    const ordem = paOrdem_(pa);
    if (alvo && ordem && ordem > alvo) continue;   // extrato de mês posterior: não serve
    melhor = melhorExtrato_(melhor, {
      arquivo: fila[i], texto: texto, paLido: pa, ordem: ordem, tipo: tipo,
      doPA: (alvo && ordem === alvo) ? 1 : 0, quando: dataInternaExtrato_(texto)
    });
  }
  return melhor;
}

function buscarExtrato_IBSCBS(pastaPai, pastaEmpresa, cnpj, compLimpa, variacoes, anoPAStr, nomeTemp) {
  let melhor = null, pastaMes = null;
  if (pastaEmpresa) {
    pastaMes = encontrarPastaMes_IBSCBS(pastaEmpresa, variacoes, anoPAStr);
    if (pastaMes) melhor = escolherExtrato_(candidatosExtrato_(pastaMes, []), compLimpa, nomeTemp);
    // PA ilegível mas o arquivo estava na pasta do mês: aceita como sendo do mês
    // (evita varrer a árvore inteira por causa de um PDF mal convertido).
    if (melhor && !melhor.ordem && melhor.tipo === 2) melhor.doPA = 1;
    if (!melhor || !melhor.doPA) {
      melhor = melhorExtrato_(melhor,
        escolherExtrato_(candidatosExtrato_(pastaEmpresa, []), compLimpa, nomeTemp));
    }
    // Nada do PA pedido: recorre a meses anteriores varrendo as subpastas.
    if (!melhor || !melhor.doPA) {
      const todas = [];
      const subs = pastaEmpresa.getFolders();
      while (subs.hasNext()) {
        const sub = subs.next();
        if (pastaMes && sub.getId() === pastaMes.getId()) continue;
        candidatosExtrato_(sub, todas);
        const netos = sub.getFolders();
        while (netos.hasNext()) candidatosExtrato_(netos.next(), todas);
      }
      todas.sort(function (a, b) { return b.getLastUpdated().getTime() - a.getLastUpdated().getTime(); });
      melhor = melhorExtrato_(melhor, escolherExtrato_(todas, compLimpa, nomeTemp));
    }
  }
  if (!melhor) {
    const cnpjLimpo = String(cnpj || "").replace(/[^\d]/g, "");
    if (cnpjLimpo) {
      const globais = [];
      const arqGlobal = pastaPai.searchFiles(
        "title contains '" + cnpjLimpo + "' and mimeType = 'application/pdf'");
      while (arqGlobal.hasNext()) {
        const arqG = arqGlobal.next();
        const n = arqG.getName().toUpperCase();
        if (n.includes("PGDASD") || n.includes("EXTRATO")) globais.push(arqG);
      }
      melhor = escolherExtrato_(globais, compLimpa, nomeTemp);
    }
  }
  return melhor;
}

// Converte o PDF para Google Docs e devolve o texto. Com retry: a conversão do
// Drive é a etapa que mais falha por rate limit.
function lerTextoDoPdf_(pdfFile, nomeTemp) {
  let tempFileId = null;
  try {
    const tempFile = comRetry_("conversão do PDF de " + nomeTemp, function () {
      Utilities.sleep(1200);
      return Drive.Files.copy(
        { title: "Temp_" + nomeTemp, mimeType: MimeType.GOOGLE_DOCS },
        pdfFile.getId(),
        { convert: true, supportsAllDrives: true }
      );
    });
    tempFileId = tempFile.id;
    const texto = comRetry_("leitura do texto de " + nomeTemp, function () {
      return DocumentApp.openById(tempFileId).getBody().getText();
    });
    return texto;
  } finally {
    if (tempFileId) { try { DriveApp.getFileById(tempFileId).setTrashed(true); } catch (e) { } }
  }
}

// =============================================================================
// ABA "Segmentos" — de onde sai o MODELO DO COMUNICADO de cada empresa
// -----------------------------------------------------------------------------
// Fonte primária: DADOS_SEGMENTOS (planilha de reuniões do escritório).
// Fallback: CNAE principal (engenharia 7111/7112/7119; saúde 861 a 869, 8711,
// 8712). Quem não se encaixa em nenhum dos dois fica DEMAIS e recebe o modelo
// padrão. A aba é recriada a cada importação/reconstrução da Correlação, e a
// coluna AR da aba "Simples Nacional" a consulta por fórmula.
// =============================================================================
const ABA_SEGMENTOS = "Segmentos";
const SEG_ENG_RAIZ_ = { "71111": true, "71120": true, "71197": true };
const SEG_SAU_PREFIXO_ = ["861", "862", "863", "864", "865", "866", "869", "8711", "8712"];

function segmentoPorCnae_(textoCnaes) {
  const dig = cnaePrincipalDigitos_(textoCnaes);
  if (!dig) return "";
  if (SEG_ENG_RAIZ_[dig.substring(0, 5)]) return "ENGENHARIA";
  for (let i = 0; i < SEG_SAU_PREFIXO_.length; i++) {
    if (dig.indexOf(SEG_SAU_PREFIXO_[i]) === 0) return "SAUDE";
  }
  return "";
}

// Índice CNPJ (só dígitos) -> segmento, montado uma vez por execução.
let _mapaSegmentos = null;
function mapaSegmentos_() {
  if (_mapaSegmentos) return _mapaSegmentos;
  _mapaSegmentos = {};
  for (let i = 0; i < DADOS_SEGMENTOS.length; i++) {
    _mapaSegmentos[normalizar(DADOS_SEGMENTOS[i][0])] = DADOS_SEGMENTOS[i][1];
  }
  return _mapaSegmentos;
}

// Devolve { segmento, origem }. A lista oficial sempre vence o CNAE.
function segmentoDaEmpresa_(cnpj, textoCnaes) {
  const mapa = mapaSegmentos_();
  const dig = normalizar(cnpj);
  if (mapa[dig]) return { segmento: mapa[dig], origem: "Planilha de reuniões (lista oficial)" };
  const porCnae = segmentoPorCnae_(textoCnaes);
  if (porCnae) return { segmento: porCnae, origem: "Classificado pelo CNAE principal" };
  return { segmento: "DEMAIS", origem: "Sem classificação — modelo padrão" };
}

function modeloComunicadoPara_(segmento) {
  const s = String(segmento || "").toUpperCase();
  return (s === "ENGENHARIA" || s === "SAUDE" || s === "SAÚDE")
    ? ID_MODELO_COMUNICADO_ENG_SAUDE
    : ID_MODELO_COMUNICADO_PADRAO;
}

function atualizarAbaSegmentos_(ss) {
  const sn = ss.getSheetByName("Simples Nacional");
  if (!sn) return null;
  const ix = mapearColunas_SN_(sn);
  const nLinhas = Math.max(sn.getLastRow() - 1, 0);
  const dados = nLinhas > 0 ? sn.getRange(2, 1, nLinhas, sn.getLastColumn()).getValues() : [];

  const linhas = [], vistos = {};
  for (let i = 0; i < dados.length; i++) {
    const cnpj = String(dados[i][ix.cnpj] || "").trim();
    if (!cnpj) continue;
    vistos[normalizar(cnpj)] = true;
    const r = segmentoDaEmpresa_(cnpj, dados[i][ix.cnaes]);
    if (r.segmento === "DEMAIS") continue;   // DEMAIS é o default da fórmula
    linhas.push([cnpj, String(dados[i][ix.empresa] || ""), r.segmento, r.origem]);
  }
  // CNPJs da lista oficial que ainda não estão na carteira
  for (let i = 0; i < DADOS_SEGMENTOS.length; i++) {
    if (vistos[normalizar(DADOS_SEGMENTOS[i][0])]) continue;
    linhas.push([DADOS_SEGMENTOS[i][0], "(fora da carteira atual) " + DADOS_SEGMENTOS[i][2],
                 DADOS_SEGMENTOS[i][1], "Planilha de reuniões (lista oficial)"]);
  }

  let sh = ss.getSheetByName(ABA_SEGMENTOS);
  if (!sh) sh = ss.insertSheet(ABA_SEGMENTOS);
  sh.clear();
  sh.getRange(1, 1, 1, 4)
    .setValues([["CNPJ", "Razão Social", "Segmento", "Origem da classificação"]])
    .setFontWeight("bold").setBackground(VERDE_ESCURO).setFontColor("#ffffff").setWrap(true);
  if (linhas.length > 0) {
    sh.getRange(2, 1, linhas.length, 4).setValues(linhas);
    sh.getRange(2, 1, linhas.length, 1).setNumberFormat("@");
    sh.getRange(2, 3, linhas.length, 1).setFontWeight("bold").setHorizontalAlignment("center");
    const cores = linhas.map(function (l) {
      const c = l[2] === "ENGENHARIA" ? "#DDEBF7" : (l[2] === "SAUDE" ? "#E2EFDA" : null);
      return [c, c, c, c];
    });
    sh.getRange(2, 1, linhas.length, 4).setBackgrounds(cores);
  }
  sh.setColumnWidth(1, 160); sh.setColumnWidth(2, 320);
  sh.setColumnWidth(3, 120); sh.setColumnWidth(4, 240);
  sh.setFrozenRows(1);
  return linhas.length;
}

function remontarAbaSegmentos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const n = atualizarAbaSegmentos_(ss);
  if (n === null) { exibirAlerta("❌ Aba 'Simples Nacional' não encontrada."); return; }
  exibirAlerta("✅ Aba '" + ABA_SEGMENTOS + "' remontada com " + n + " empresa(s) de " +
    "ENGENHARIA/SAÚDE.\n\nEssas recebem o Comunicado do modelo específico; as demais, o " +
    "modelo padrão. A coluna AR da aba 'Simples Nacional' mostra o segmento de cada uma.");
}

// =============================================================================
// 2. EXTRAÇÃO DO EXTRATO DO PGDAS-D E CÁLCULO DO CENÁRIO 2027
// =============================================================================
function extrairDadosExtrato_IBSCBS(compForcada, limite, silencioso) {
  // Sem trava de tempo (MINUTOS_EXECUCAO = 0): a fila roda até o fim. Se o Google
  // cortar a execução, o que já foi lido está gravado — rode de novo para seguir.
  const prazo = novoPrazo_();
  const inicio = prazo.inicio;
  const LIMITE_MS = prazo.limiteMs;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Simples Nacional");
  if (!sheet) { exibirAlerta("❌ Aba 'Simples Nacional' não encontrada."); return; }

  const ix = mapearColunas_SN_(sheet);
  try {
    validarIndicesColunas({
      CNPJ: ix.cnpj, "Razão Social": ix.empresa, RBT12: ix.rbt12, "Fator R": ix.fatorR,
      "Alíquota Efetiva Atual": ix.aliqEfetiva, "Valor no DAS": ix.valorDas,
      Faturamento: ix.faturamento, "CBS Devido": ix.cbsFora, "IBS Devido": ix.ibsFora,
      "Alíquota Efetiva Cheia": ix.aliqCheia, "Híbrida 2027": ix.aliqHibrida,
      Status: ix.status, SELECIONAR: ix.selecionar, "PIS no DAS": ix.pis,
      "COFINS no DAS": ix.cofins, "DAS sem PIS/COFINS": ix.dasLiquido,
      "Redução da Atividade": ix.reducao, "DAS Híbrido 2027": ix.dasHibrido,
      "RBT12p": ix.rbt12p, "Data de Abertura": ix.dataAbertura
    });
  } catch (e) {
    exibirAlerta("❌ " + e.message + "\n\nRode antes: ⚙️ Automação 2027 > 🔧 Migrar Layout 2027.");
    return;
  }

  const dados = sheet.getDataRange().getValues();
  let linhasSel = [];
  for (let i = 1; i < dados.length; i++) if (dados[i][ix.selecionar] === true) linhasSel.push(i + 1);
  if (linhasSel.length === 0) { exibirAlerta("❌ Selecione as empresas na coluna '☑️ SELECIONAR'."); return; }
  if (typeof limite === "number" && limite > 0) linhasSel = linhasSel.slice(0, limite);

  const compDados = (typeof compForcada === "string" && /^\d{2}\/\d{4}$/.test(compForcada))
    ? montarCompetencia_(compForcada) : obterDadosCompetencia_IBSCBS();
  if (!compDados) return;

  const pastaPai = DriveApp.getFolderById(ID_PASTA_EXTRATOS);
  let processados = 0, jaProntas = 0, restantes = 0, semRbt12p = 0;

  for (let i = 0; i < linhasSel.length; i++) {
    if (new Date().getTime() - inicio > LIMITE_MS) { restantes = linhasSel.length - i; break; }

    const row = linhasSel[i];
    const statusAtual = String(dados[row - 1][ix.status] || "");
    if (statusAtual.indexOf("Sucesso") > -1 && statusAtual.indexOf(compDados.inputOriginal) > -1) { jaProntas++; continue; }

    const cnpj = String(dados[row - 1][ix.cnpj]).trim();
    const empresa = String(dados[row - 1][ix.empresa]).trim();

    try {
      sheet.getRange(row, ix.status + 1).setValue("⏳ Buscando pasta...");
      SpreadsheetApp.flush();

      const pastaEmpresa = buscarPastaEmpresa_IBSCBS(pastaPai, empresa);
      if (!pastaEmpresa) {
        sheet.getRange(row, ix.status + 1).setValue("❌ Pasta não encontrada");
        SpreadsheetApp.flush(); continue;
      }

      sheet.getRange(row, ix.status + 1).setValue("🔍 Lendo extrato(s) da pasta...");
      SpreadsheetApp.flush();

      const extratoEscolhido = buscarExtrato_IBSCBS(pastaPai, pastaEmpresa, cnpj, compDados.compLimpa,
                                       compDados.variacoes, String(compDados.anoPA), empresa);
      if (!extratoEscolhido) {
        sheet.getRange(row, ix.status + 1).setValue("❌ Extrato " + compDados.inputOriginal + " não localizado");
        SpreadsheetApp.flush(); continue;
      }
      const pdf = extratoEscolhido.arquivo;
      const paUsado = String(extratoEscolhido.paLido || "");
      const texto = extratoEscolhido.texto;

      // --- confere se o extrato é realmente do CNPJ da linha
      const mCnpjExtrato = texto.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
      const soDigitos = function (s) { return String(s).replace(/\D/g, ""); };
      if (mCnpjExtrato && soDigitos(cnpj) && soDigitos(mCnpjExtrato[1]) !== soDigitos(cnpj)) {
        sheet.getRange(row, ix.status + 1).setValue("❌ Extrato é de outro CNPJ (" + mCnpjExtrato[1] + ")");
        SpreadsheetApp.flush(); continue;
      }

      // --- DAS gerado e tributos destacados
      let valorDas = 0, valPis = 0, valCofins = 0;
      const mBlocoDas = texto.match(/Informa[cç][oõ]es sobre DAS Gerado[\s\S]{0,600}?Total\s+([\d\.]+,\d{2})/i);
      if (mBlocoDas) {
        valorDas = parseMoney_IBSCBS(mBlocoDas[1]);
        const bloco = mBlocoDas[0];
        const mCofins = bloco.match(/COFINS\s+([\d\.]+,\d{2})/i);
        const mPis = bloco.match(/PIS\/PASEP\s+([\d\.]+,\d{2})/i) || bloco.match(/PIS\s+([\d\.]+,\d{2})/i);
        if (mCofins) valCofins = parseMoney_IBSCBS(mCofins[1]);
        if (mPis) valPis = parseMoney_IBSCBS(mPis[1]);
      }
      if (valorDas === 0) {
        const mAlt = texto.match(/Total do D[eé]bito Exig[ií]vel[\s\S]{0,40}?([\d\.]+(?:,\d{2}))/i)
          || texto.match(/Valor total do documento[\s\S]{0,40}?([\d\.]+(?:,\d{2}))/i)
          || texto.match(/Valor (?:total )?do DAS[\s\S]{0,40}?([\d\.]+(?:,\d{2}))/i);
        if (mAlt) valorDas = parseMoney_IBSCBS(mAlt[1]);
      }
      const temPisCofins = (valPis > 0 || valCofins > 0);

      // --- faturamento do período (RPA) — SEPARADO POR MERCADO
      // O "Discriminativo de Receitas" do PGDAS-D traz três colunas:
      //   Mercado Interno | Mercado Externo | Total
      // Ignorar isso fazia o RPA e o RBT12 voltarem 0,00 para exportadoras
      // (a 1ª coluna vinha zerada). Ver lerReceitasMercado_ em _p1/helpers.
      const recPA = lerReceitasMercado_(texto, [
        "Receita\\s*Bruta\\s*do\\s*PA\\s*\\(\\s*RPA\\s*\\)\\s*-?\\s*(?:Compet[\u00EAe]ncia|Caixa)?",
        "Receita\\s*Bruta\\s*Total\\s*do\\s*PA",
        "Receita\\s*Bruta\\s*do\\s*PA",
        "Receita\\s*Bruta\\s*do\\s*M[\u00EAe]s",
        "Valor\\s*Informado"   // total do estabelecimento. A antiga "Receita Bruta
        // Informada" era POR ATIVIDADE: em empresa com mais de uma atividade no
        // extrato (as "VÁRIOS") gravava só uma parcela do RPA — 02/09/2026.
      ]);
      let faturamentoPA = recPA.total;
      const recInterna = recPA.interno, recExterna = recPA.externo;

      // --- RBT12 (12 meses anteriores ao PA) — também por mercado
      const recRBT = lerReceitasMercado_(texto, [
        "Receita\\s*bruta\\s*acumulada\\s*nos\\s*doze\\s*meses\\s*anteriores\\s*ao\\s*PA",
        "anteriores\\s*ao\\s*PA\\s*\\(\\s*RBT12\\s*\\)",
        "\\(\\s*RBT12\\s*\\)",
        "RBT12"
      ]);
      let rbt12 = recRBT.total;
      const rbt12Interno = recRBT.interno, rbt12Externo = recRBT.externo;

      // --- RBT12 proporcionalizada (RBT12p): a Receita Federal já imprime o valor
      // pronto no extrato, e deixa o campo VAZIO quando não se aplica. Por isso
      // não calculamos meses de atividade — só lemos o campo (art. 18, §§ 2º a 4º
      // da LC 123/2006; Resolução CGSN 140/2018, art. 6º).
      // ATENÇÃO: os padrões são de MESMA LINHA ([^\n]) de propósito. Quando o
      // campo vem vazio (caso normal), o rótulo "proporcionalizada (RBT12p)"
      // termina a linha e a linha seguinte já é a RBA — um padrão com [\s\S]
      // capturava a RBA e gravava um RBT12p falso.
      let rbt12p = lerRBT12p_(texto);
      // Trava extra: se por acaso a leitura devolveu o próprio RBT12, descarta —
      // proporcionalizar não faz sentido quando os dois valores são iguais.
      if (rbt12p > 0 && rbt12 > 0 && Math.abs(rbt12p - rbt12) < 0.01) rbt12p = 0;
      if (rbt12p === 0) {
        semRbt12p++;
        const jan = texto.indexOf("RBT12p");
        if (jan > -1) Logger.log("[RBT12p] " + empresa + " — trecho: " +
          texto.substring(Math.max(0, jan - 120), jan + 180).replace(/\s+/g, " "));

        // --- RBT12 zerado (empresa nova, ou sem faturamento nos 12 meses
        // anteriores) e a Receita não imprimiu RBT12p: sem isso não há base de
        // cálculo nenhuma. Regra confirmada com a Vicky em 01/09/2026 (casos
        // APTM, BARRETO, CONTREIRAS, JHN, MF ENGENHARIA, VINICIUS DOMINGUEZ):
        // projeta pela receita do próprio período — RBT12 = RPA × 12 (LC
        // 123/2006, art. 18, §§3º-4º). NUNCA mexe quando já existe RBT12 real
        // (rbt12 > 0) — aí a RBT12p continua vazia de propósito e o cálculo
        // usa a RBT12 normal.
        if (rbt12 === 0 && faturamentoPA > 0) {
          rbt12p = faturamentoPA * 12;
        }
      }

      // --- data de abertura (referência para conferir a proporcionalização)
      let dataAberturaTxt = "";
      const mAbertura = texto.match(/Data de Abertura:?\s*(\d{2}\/\d{2}\/\d{4})/i);
      if (mAbertura) dataAberturaTxt = mAbertura[1];
      // --- trava da proporcionalização (02/09/2026)
      // A RBT12p só existe nos 12 primeiros meses de atividade (LC 123/2006,
      // art. 18, §§ 2º a 4º). Empresa aberta ANTES do início da janela de 12
      // meses do PA já tem RBT12 completa: qualquer número lido ali é ruído
      // (na prática, a RBA da linha seguinte) e não pode virar base de cálculo.
      let rbt12pDescartado = "";
      if (rbt12p > 0 && rbt12 > 0 && dataAberturaTxt) {
        const mAb = String(dataAberturaTxt).match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (mAb) {
          const abertura = new Date(Number(mAb[3]), Number(mAb[2]) - 1, Number(mAb[1]));
          const inicioJanela = new Date(compDados.anoPA, compDados.mesPA - 13, 1);
          if (abertura < inicioJanela) {
            rbt12pDescartado = "RBT12p ignorada (aberta em " + dataAberturaTxt + ", RBT12 completa)";
            rbt12p = 0;
          }
        }
      }

      // --- Fator R
      let fatorRTxt = "";
      const mFatorR = texto.match(/Fator\s*r\s*=?\s*([\d]+,\d+)/i);
      if (mFatorR) fatorRTxt = parseFloat(mFatorR[1].replace(",", ".")) >= 0.28 ? "com" : "sem";

      // --- anexos citados
      let anexosTxt = "";
      const mAnexos = texto.match(/Anexo\s+(VI|V|IV|III|II|I)\b/gi);
      if (mAnexos) {
        const vistos = [];
        mAnexos.forEach(function (t) {
          const rom = t.replace(/Anexo\s+/i, "").toUpperCase();
          if (["I", "II", "III", "IV", "V", "VI"].indexOf(rom) > -1 && vistos.indexOf(rom) === -1) vistos.push(rom);
        });
        const ordem = ["I", "II", "III", "IV", "V", "VI"];
        vistos.sort(function (x, y) { return ordem.indexOf(x) - ordem.indexOf(y); });
        anexosTxt = vistos.join("/");
      }

      // --- comércio (Anexo I) / indústria (Anexo II): a Receita não escreve
      // "Anexo I/II" no extrato — só aparece pela descrição da atividade em
      // "Valor do Débito por Tributo para a Atividade" (padrão oficial do
      // PGDAS-D). Só decide quando não achou nenhum "Anexo N" citado no texto
      // (não mexe em III/IV/V, que já vêm do match acima). Confirmado com a
      // Vicky em 01/09/2026 contra os extratos de A SANTANA DE ALMEIDA SANTOS
      // (comércio) e SUDOESTE PLACAS (indústria).
      if (!anexosTxt) {
        const ehComercio = /Revenda de mercadorias, exceto para o exterior/i.test(texto);
        const ehIndustria = /Venda de mercadorias industrializadas pelo contribuinte, exceto para o exterior/i.test(texto);
        if (ehComercio && !ehIndustria) anexosTxt = "I";
        else if (ehIndustria && !ehComercio) anexosTxt = "II";
        // se os dois padrões aparecem juntos (atividade mista comércio+indústria), não decide sozinho.
      }

      // --- imunidade de ICMS (ex.: livros/bíblias, CF art. 150, VI, "d") — a
      // Receita marca "Imunidade tributária de: <tributo(s)>." no bloco do
      // estabelecimento quando a atividade tem imunidade/isenção permanente de
      // algum tributo. Confirmado com a Vicky em 01/09/2026 contra o extrato de
      // A VERDADE COMÉRCIO DE MATERIAL BÍBLICO (ICMS imune) x 31 DE JANEIRO
      // COMÉRCIO DE CONFECÇÕES (comércio normal, sem a linha).
      const mImune = texto.match(/Imunidade\s+tribut[aá]ria\s+de:\s*([^.\n]+)\./gi);
      const icmsImune = !!(mImune && mImune.some(function (t) { return /ICMS/i.test(t); }));

      // --- gravação dos valores lidos
      const MOEDA = "R$ #,##0.00";
      if (anexosTxt) sheet.getRange(row, ix.anexo + 1).setValue(anexosTxt);
      if (rbt12 > 0)  sheet.getRange(row, ix.rbt12 + 1).setValue(rbt12).setNumberFormat(MOEDA);
      sheet.getRange(row, ix.rbt12p + 1).setValue(rbt12p > 0 ? rbt12p : "").setNumberFormat(MOEDA);
      if (dataAberturaTxt) sheet.getRange(row, ix.dataAbertura + 1).setValue(dataAberturaTxt);
      if (fatorRTxt) sheet.getRange(row, ix.fatorR + 1).setValue(fatorRTxt);
      if (ix.icmsImune > -1) sheet.getRange(row, ix.icmsImune + 1).setValue(icmsImune ? "SIM" : "");
      // Link do extrato que embasou o cálculo (coluna opcional "Extrato usado";
      // se a coluna não existir, o índice fica -1 e nada é gravado) — 02/09/2026.
      if (ix.linkExtrato > -1) {
        const rotuloExtrato = paUsado
          ? ("Extrato " + paUsado.slice(0, 2) + "/" + paUsado.slice(2))
          : pdf.getName();
        sheet.getRange(row, ix.linkExtrato + 1)
             .setFormula('=HYPERLINK("' + pdf.getUrl() + '";"' + rotuloExtrato + '")');
      }
      // Anexo que o PRÓPRIO extrato declara em cada atividade ("tributados pelo
      // Anexo III"), predominante por Receita Bruta Informada. É ele que resolve
      // o anexo das empresas com vários CNAEs — 02/09/2026.
      if (ix.anexoExtrato > -1) {
        sheet.getRange(row, ix.anexoExtrato + 1).setValue(anexoDoExtrato_(texto));
      }
      sheet.getRange(row, ix.valorDas + 1).setValue(valorDas).setNumberFormat(MOEDA);
      sheet.getRange(row, ix.pis + 1).setValue(valPis).setNumberFormat(MOEDA);
      sheet.getRange(row, ix.cofins + 1).setValue(valCofins).setNumberFormat(MOEDA);
      if (faturamentoPA > 0) sheet.getRange(row, ix.faturamento + 1).setValue(faturamentoPA).setNumberFormat(MOEDA);
      // receitas e RBT12 segregados por mercado (interno x externo)
      if (ix.recInterna > -1)   sheet.getRange(row, ix.recInterna + 1).setValue(recInterna).setNumberFormat(MOEDA);
      if (ix.recExterna > -1)   sheet.getRange(row, ix.recExterna + 1).setValue(recExterna).setNumberFormat(MOEDA);
      if (ix.rbt12Interno > -1) sheet.getRange(row, ix.rbt12Interno + 1).setValue(rbt12Interno).setNumberFormat(MOEDA);
      if (ix.rbt12Externo > -1) sheet.getRange(row, ix.rbt12Externo + 1).setValue(rbt12Externo).setNumberFormat(MOEDA);

      // --- fórmulas: Faixa/Alíquota Cheia/ISS/RBT12 base/Anexo apurado recalculam
      //     sozinhas a partir de D, E e Y; o cenário híbrido também é fórmula.
      escreverFormulasCalculadas_(sheet, row, ix);
      escreverFormulasHibrido_(sheet, row, ix);

      // --- aviso quando a empresa saiu do Simples
      const anexoConf = anexoApurado_(anexosTxt || dados[row - 1][ix.anexo]);
      const baseConf = rbt12p > 0 ? rbt12p : rbt12;
      const conf = calcularAliquotaCheiaSN_(anexoConf, baseConf);

      const avisos = [], notas = [];
      if (rbt12pDescartado) avisos.push(rbt12pDescartado);
      // Receita de EXPORTAÇÃO: PIS/COFINS vêm zerados no DAS por IMUNIDADE
      // (CF art. 149, § 2º, I; LC 123/2006, art. 18, § 14) — não é falha de
      // leitura do extrato. Nesse caso não se emite aviso: calcula-se normal.
      const totalPA = recInterna + recExterna;
      const percExp = totalPA > 0 ? (recExterna / totalPA) : 0;
      const soExportacao = percExp >= 0.9995;
      if (valorDas <= 0) avisos.push("DAS não localizado");
      if (faturamentoPA <= 0) avisos.push("faturamento não localizado");
      if (!temPisCofins && percExp <= 0) avisos.push("PIS/COFINS não destacados");
      if (conf.faixa === "EXCEDEU LIMITE") avisos.push("RBT12 acima de R$ 4,8 mi (fora do Simples)");
      // Extrato de outra competência (não havia o PA pedido na pasta): a linha
      // fica marcada para conferência — 02/09/2026.
      if (paUsado && paUsado !== compDados.compLimpa) {
        avisos.push("extrato de " + paUsado.slice(0, 2) + "/" + paUsado.slice(2) +
                    " (não há " + compDados.inputOriginal + " na pasta)");
      }
      if (percExp > 0) {
        notas.push("🌐 Exportação " + (percExp * 100).toFixed(2).replace(".", ",") + "% da receita" +
          (temPisCofins ? "" : (soExportacao
            ? " — PIS/COFINS/ISS zerados por imunidade (CF art. 149, §2º, I)"
            : " — PIS/COFINS reduzidos pela parcela imune")));
      }
      const marca = avisos.length > 0 ? ("⚠️ " + avisos.join(" / "))
                  : (notas.length > 0 ? ("✅ " + notas.join(" / ")) : "✅ Sucesso");
      sheet.getRange(row, ix.status + 1).setValue(marca + " " + compDados.inputOriginal);
      SpreadsheetApp.flush();
      processados++;
    } catch (e) {
      sheet.getRange(row, ix.status + 1).setValue("❌ Erro: " + e.message);
      SpreadsheetApp.flush();
    }
  }

  let resumo = "✅ " + processados + " extrato(s) lidos na competência " + compDados.inputOriginal + ".";
  if (jaProntas > 0) resumo += "\n↩️ " + jaProntas + " linha(s) já concluídas foram puladas.";
  if (semRbt12p > 0) resumo += "\nℹ️ " + semRbt12p + " extrato(s) sem RBT12p (campo vazio = não se aplica). Trechos registrados no Logger.";
  if (restantes > 0) resumo += "\n⏱️ Parei em " + restantes + " linha(s) ao fechar o orçamento de " +
      MINUTOS_EXECUCAO + " min desta execução. Rode de novo para continuar de onde parou.";
  else if (SEM_TRAVA_DE_TEMPO) resumo += "\nℹ️ Sem trava de tempo: a fila foi percorrida até o fim.";
  else resumo += "\n🏁 Fila concluída.";
  const relatorio = { processados: processados, jaProntas: jaProntas, restantes: restantes, resumo: resumo };
  // silencioso = true: quem chamou (o "ATUALIZAR TUDO") mostra a mensagem no fim.
  if (silencioso !== true) exibirAlerta(resumo);
  return relatorio;
}

// =============================================================================
// 3. COMUNICADO TÉCNICO EM PDF — DOIS modelos de Google Docs
// -----------------------------------------------------------------------------
// Empresas de ENGENHARIA e SAÚDE (aba "Segmentos" / coluna AR) recebem o modelo
// ID_MODELO_COMUNICADO_ENG_SAUDE; as demais, o ID_MODELO_COMUNICADO_PADRAO.
// Os placeholders VAR_* são os mesmos nos dois documentos.
// Continua usando ID_MODELO_COMUNICADO e os placeholders VAR_*. O modelo e o ID
// seguem intocados: o que mudou aqui foi só a teimosia — as chamadas ao Drive
// insistem com backoff até a fatia de tempo da empresa acabar.
// =============================================================================
function gerarComunicadoUnico(limite) {
  const prazo = novoPrazo_();
  const inicio = prazo.inicio;
  const LIMITE_MS = prazo.limiteMs;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Simples Nacional");
  if (!sheet) { exibirAlerta("❌ Aba 'Simples Nacional' não encontrada."); return; }

  const dados = sheet.getDataRange().getValues();
  const headers = dados[0];
  const idxCnpj        = buscarIndiceColuna(headers, "CNPJ");
  const idxEmpresa     = buscarIndiceColuna(headers, "Razão Social");
  const idxAliqAtual   = buscarIndiceColuna(headers, "Alíquota Efetiva Atual");
  const idxAliqHibrida = buscarIndiceColuna(headers, "Hibrida 2027");
  const idxAliqCheia   = buscarIndiceColuna(headers, "Aliquota Efetiva Cheia");
  const idxStatus      = buscarIndiceColuna(headers, "Status");
  const idxSelecionar  = buscarIndiceColuna(headers, "SELECIONAR");
  const idxFaturamento = buscarIndiceColuna(headers, "Faturamento");

  try {
    validarIndicesColunas({
      CNPJ: idxCnpj, "Razão Social": idxEmpresa, "Alíquota Efetiva Atual": idxAliqAtual,
      "Híbrida 2027": idxAliqHibrida, Status: idxStatus, SELECIONAR: idxSelecionar,
      Faturamento: idxFaturamento
    });
  } catch (e) { exibirAlerta("❌ " + e.message); return; }

  const idxCnaes   = buscarIndiceColuna(headers, "CNAEs");
  const idxSegmento = buscarIndiceColuna(headers, "Segmento (modelo do Comunicado)");

  const pasta = DriveApp.getFolderById(ID_PASTA_DESTINO_PDF);
  const dataHoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  // Os modelos são abertos sob demanda e guardados em cache: são DOIS documentos
  // diferentes (ENGENHARIA/SAÚDE x demais) e não faz sentido abrir os dois se a
  // seleção só tiver empresas de um segmento.
  const cacheModelos = {};
  const modeloDe = function (idModelo) {
    if (!cacheModelos[idModelo]) {
      cacheModelos[idModelo] = comRetry_("abrir modelo de comunicado " + idModelo, function () {
        return DriveApp.getFileById(idModelo);
      });
    }
    return cacheModelos[idModelo];
  };
  const usados = {};

  let processados = 0, jaGerados = 0, semDados = 0, restantes = 0;
  const erros = [];

  for (let i = 1; i < dados.length; i++) {
    if (limite && processados >= limite) break;
    if (new Date().getTime() - inicio > LIMITE_MS) { restantes++; continue; }

    const linha = dados[i];
    if (linha[idxSelecionar] !== true) continue;

    const status = String(linha[idxStatus] || "");
    if (status.indexOf("PDF") > -1) { jaGerados++; continue; }
    // Status de extração (ex.: "⚠️ DAS não localizado...") não bloqueia mais a
    // geração — o modelo do Comunicado não imprime Faturamento/DAS/Status, só
    // Alíquota Cheia/Atual e Híbrida. Autorizado por Vicky em 08/09.

    const cheiaVal = Number(linha[idxAliqCheia]) || 0;
    const atualVal = Number(linha[idxAliqAtual]) || 0;
    const aliqHib  = Number(linha[idxAliqHibrida]) || 0;
    // Só pula quando NENHUMA alíquota existe para imprimir (dado realmente
    // inexistente — não inventar 0,00%). Faturamento zerado não bloqueia mais.
    if (aliqHib <= 0 || (cheiaVal <= 0 && atualVal <= 0)) { semDados++; continue; }

    const empresa = String(linha[idxEmpresa]);
    // Segmento: a coluna AR já traz o valor pela aba "Segmentos"; se ela ainda
    // não existir, resolve na hora pela lista oficial + CNAE principal.
    const segLinha = (idxSegmento > -1) ? String(linha[idxSegmento] || "").trim() : "";
    const seg = segLinha !== "" && segLinha !== "#N/A"
      ? { segmento: segLinha, origem: "coluna AR da aba Simples Nacional" }
      : segmentoDaEmpresa_(linha[idxCnpj], idxCnaes > -1 ? linha[idxCnaes] : "");
    const idModelo = modeloComunicadoPara_(seg.segmento);
    const arquivoModelo = modeloDe(idModelo);
    usados[seg.segmento] = (usados[seg.segmento] || 0) + 1;
    const nomeArquivo = "Comunicado_2027_" + empresa;
    let copiaId = null;

    // fatia de insistência desta empresa (teto por empresa ou o que sobrou)
    const prazoEmpresa = prazoDaEmpresa_(prazo);
    const avisarEmp = function (tentativa, esperaS, restanteTxt) {
      Logger.log("[" + empresa + "] tentativa " + tentativa + " falhou; nova em " + esperaS +
                 "s (" + restanteTxt + ")");
    };

    try {
      const copiaDoc = comRetryAtePrazo_("cópia do modelo de comunicado (" + empresa + ")", function () {
        return arquivoModelo.makeCopy(nomeArquivo, pasta);
      }, prazoEmpresa, avisarEmp);
      copiaId = copiaDoc.getId();
      Utilities.sleep(1500);

      const doc = DocumentApp.openById(copiaId);
      const corpo = doc.getBody();
      const cheia = (linha[idxAliqCheia] !== "" && linha[idxAliqCheia] != null && !isNaN(Number(linha[idxAliqCheia])))
        ? linha[idxAliqCheia] : linha[idxAliqAtual];
      corpo.replaceText("VAR_EMPRESA", empresa);
      corpo.replaceText("VAR_CNPJ", String(linha[idxCnpj]));
      corpo.replaceText("VAR_ALIQ_EFETIVA_DENTRO", pctBR_(cheia));
      corpo.replaceText("VAR_ALIQ_EFETIVA_FORA", pctBR_(linha[idxAliqHibrida]));
      corpo.replaceText("VAR_DATA", dataHoje);
      doc.saveAndClose();
      Utilities.sleep(2000);

      comRetryAtePrazo_("PDF do comunicado (" + empresa + ")", function () {
        pasta.createFile(copiaDoc.getAs(MimeType.PDF)).setName(nomeArquivo + ".pdf");
        return true;
      }, prazoEmpresa, avisarEmp);
      DriveApp.getFileById(copiaId).setTrashed(true);

      sheet.getRange(i + 1, idxStatus + 1)
        .setValue(status + " | PDF " + dataHoje + " (" + seg.segmento + ")");
      SpreadsheetApp.flush();
      processados++;
    } catch (e) {
      erros.push(empresa + ": " + e.message);
      sheet.getRange(i + 1, idxStatus + 1).setValue(status + " | ❌ PDF: " + e.message);
      if (copiaId) { try { DriveApp.getFileById(copiaId).setTrashed(true); } catch (e2) { } }
    }
  }

  let resumo = processados > 0 ? ("✅ " + processados + " comunicado(s) gerado(s) em PDF.") : "ℹ️ Nenhum comunicado gerado.";
  const segsUsados = Object.keys(usados);
  if (segsUsados.length > 0) {
    resumo += "\n📄 Modelos usados: " + segsUsados.map(function (k) {
      return k + " " + usados[k] + "x (" +
        (modeloComunicadoPara_(k) === ID_MODELO_COMUNICADO_ENG_SAUDE ? "modelo Engenharia/Saúde" : "modelo padrão") + ")";
    }).join(" · ");
  }
  if (jaGerados > 0) resumo += "\n↩️ " + jaGerados + " linha(s) já tinham PDF e foram puladas.";
  if (semDados > 0)  resumo += "\n⚠️ " + semDados + " linha(s) sem nenhuma alíquota calculada (não geradas).";
  if (restantes > 0) resumo += "\n⏱️ Parei por tempo em " + restantes + " linha(s). Rode de novo para continuar.";
  else if (SEM_TRAVA_DE_TEMPO && processados > 0) resumo += "\nℹ️ Sem trava de tempo: a fila foi percorrida até o fim.";
  if (erros.length > 0) resumo += "\n❌ Falhas:\n" + erros.slice(0, 10).join("\n");
  exibirAlerta(resumo);
}

// =============================================================================
// 5. ABA "CALCULO MANUAL" — PAINEL DO ESTUDO DETALHADO (em percentuais)
// =============================================================================
// Painel vivo (fórmulas) por CNPJ selecionado em D5. Replica, em PERCENTUAL, a
// estrutura do Comunicado de referência: identificação, panorama atual, cenário
// 2027, comparativo de cenários, diagnóstico CNAE × item, recomendação e base
// legal ao final. É a fonte do PDF do Estudo Detalhado.
// NÃO interfere no Comunicado Técnico (gerarComunicadoUnico / ID_MODELO_COMUNICADO).
const CM_RANGE_SN = "'Simples Nacional'!$A$2:$AR$5000";
const CM_CORR_A   = "'Correlação CNAEs'!$" + COR_COL_CNPJ + "$2:$" + COR_COL_CNPJ + "$" + COR_LINHA_FIM;
const CM_CORR_G   = "'Correlação CNAEs'!$" + COR_COL_REDUCAO + "$2:$" + COR_COL_REDUCAO + "$" + COR_LINHA_FIM;
const CM_CORR_ORIG = "'Correlação CNAEs'!$" + COR_COL_RED_ORIG + "$2:$" + COR_COL_RED_ORIG + "$" + COR_LINHA_FIM;
const CM_CORR_REQ  = "'Correlação CNAEs'!$" + COR_COL_REQ127 + "$2:$" + COR_COL_REQ127 + "$" + COR_LINHA_FIM;

function remontarCalculoManual() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  criarCalculoManual_(ss);
  exibirAlerta("✅ Painel da aba '" + ABA_ANALISE + "' remontado.\nSelecione o CNPJ na célula D5 e rode '4️⃣ Gerar Estudo Detalhado PDF'.");
}

function criarCalculoManual_(ss) {
  const sn = ss.getSheetByName("Simples Nacional");
  if (!sn) throw new Error("Aba 'Simples Nacional' não encontrada.");
  const ix = mapearColunas_SN_(sn);

  // Renomeia a aba antiga, se ainda existir, para não duplicar painel.
  const antiga = ss.getSheetByName("Calculo Manual");
  if (antiga && !ss.getSheetByName(ABA_ANALISE)) antiga.setName(ABA_ANALISE);
  let sh = ss.getSheetByName(ABA_ANALISE);
  if (!sh) sh = ss.insertSheet(ABA_ANALISE);
  sh.clear();
  sh.clearConditionalFormatRules();
  try { sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart(); } catch (e) { }

  // VLOOKUP por índice de coluna dentro de A..AC
  // CEL_CNPJ é a célula que guarda o CNPJ resolvido a partir da razão social
  // escolhida em D5. Todas as buscas do painel passam por ela.
  const CEL_CNPJ = "$G$5";
  const V = function (idx0, fallback) {
    const fb = (fallback === undefined) ? '"—"' : fallback;
    return 'IFERROR(VLOOKUP(' + CEL_CNPJ + ';' + CM_RANGE_SN + ';' + (idx0 + 1) + ';FALSE());' + fb + ')';
  };
  const VAZIO = '""';

  const larguras = [25, 330, 15, 170, 15, 240, 170, 25];
  for (let i = 0; i < larguras.length; i++) sh.setColumnWidth(i + 1, larguras[i]);

  const titulo = function (row, txt, sub) {
    sh.getRange("B" + row + ":G" + row).merge().setValue(txt)
      .setFontWeight("bold").setFontColor("#ffffff")
      .setFontSize(sub ? 10 : 13).setBackground(sub ? VERDE_MEDIO : VERDE_ESCURO)
      .setHorizontalAlignment("center").setVerticalAlignment("middle");
    sh.setRowHeight(row, sub ? 22 : 30);
  };
  const bloco = function (row, txt) {
    sh.getRange("B" + row + ":G" + row).merge().setValue(txt)
      .setFontWeight("bold").setFontColor("#ffffff").setFontSize(11)
      .setBackground(VERDE_MEDIO).setHorizontalAlignment("left").setVerticalAlignment("middle");
    sh.setRowHeight(row, 24);
  };
  const rot = function (cel, txt) {
    sh.getRange(cel).setValue(txt).setFontWeight("bold").setFontSize(10)
      .setFontColor(VERDE_ESCURO).setBackground(VERDE_CLARO)
      .setVerticalAlignment("middle").setWrap(true);
  };
  const val = function (cel, formula, fmt, bold) {
    const r = sh.getRange(cel);
    if (String(formula).charAt(0) === "=") r.setFormula(formula); else r.setValue(formula);
    r.setFontSize(10).setFontWeight(bold ? "bold" : "normal")
     .setHorizontalAlignment("center").setVerticalAlignment("middle").setWrap(true);
    if (fmt) r.setNumberFormat(fmt);
  };
  const nota = function (cel, txt) {
    sh.getRange(cel).setValue(txt).setFontSize(9).setFontStyle("italic")
      .setFontColor(CINZA_TXT).setVerticalAlignment("middle").setWrap(true);
  };
  const cabTab = function (row, textos) {
    textos.forEach(function (t) {
      sh.getRange(t[0]).setValue(t[1]).setFontWeight("bold").setFontSize(9)
        .setFontColor("#ffffff").setBackground(VERDE_HEADER)
        .setHorizontalAlignment("center").setVerticalAlignment("middle").setWrap(true);
    });
    sh.setRowHeight(row, 30);
  };

  const PCT = "0.0000%", PCT2 = "0.00%", RS = "R$ #,##0.00";

  // ---------------- cabeçalho ----------------
  titulo(1, "EXEMPLO CONTABILIDADE LTDA", false);
  titulo(2, "ESTUDO DETALHADO — PANORAMA EM PERCENTUAIS (SIMPLES NACIONAL × IBS/CBS 2027)", true);
  sh.getRange("B3:G3").merge()
    .setValue("Documento interno de apoio ao fiscal. Todos os indicadores estão expressos em % (percentuais), não em R$. Não substitui nem altera o Comunicado Técnico enviado ao cliente.")
    .setFontSize(9).setFontStyle("italic").setFontColor(CINZA_TXT).setWrap(true);
  sh.setRowHeight(3, 30);

  // A seleção é pela RAZÃO SOCIAL (D5). O CNPJ correspondente é resolvido em G5,
  // e é G5 — não D5 — que alimenta todas as fórmulas do painel: as buscas na aba
  // "Simples Nacional" e na "Correlação CNAEs" continuam por CNPJ, que é a chave
  // única. Se duas empresas tiverem exatamente a mesma razão social, o MATCH
  // devolve a primeira; nesse caso digite o CNPJ direto em G5.
  rot("B5", "Selecione a EMPRESA analisada:");
  const ultSN = Math.max(sn.getLastRow(), 2);
  sh.getRange("D5").setFormula("='Simples Nacional'!B2")
    .setFontWeight("bold").setFontSize(11).setFontColor(VERDE_ESCURO)
    .setBackground("#FFF6D9").setHorizontalAlignment("left").setVerticalAlignment("middle")
    .setBorder(true, true, true, true, false, false);
  const regraEmpresa = SpreadsheetApp.newDataValidation()
    .requireValueInRange(sn.getRange("B2:B" + ultSN), true)
    .setAllowInvalid(true)
    .setHelpText("Escolha a empresa pela razão social (aba Simples Nacional, coluna B).")
    .build();
  sh.getRange("D5").setDataValidation(regraEmpresa);

  rot("F5", "CNPJ");
  sh.getRange("G5").setFormula(
      "=IFERROR(INDEX('Simples Nacional'!$A$2:$A$" + COR_LINHA_FIM + ";" +
      "MATCH($D$5;'Simples Nacional'!$B$2:$B$" + COR_LINHA_FIM + ";0));\"\")")
    .setFontWeight("bold").setFontSize(11).setFontColor(VERDE_ESCURO)
    .setBackground("#F3F6F4").setHorizontalAlignment("center").setVerticalAlignment("middle")
    .setNumberFormat("@").setBorder(true, true, true, true, false, false);
  nota("B6", "▲ lista suspensa alimentada pela coluna B (Razão Social) da aba \"Simples Nacional\" — o CNPJ ao lado é resolvido automaticamente e é ele que alimenta todo o painel.");
  sh.getRange("B6:G6").merge();
  sh.setRowHeight(6, 18);

  // ---------------- 1) identificação ----------------
  bloco(7, "1.  IDENTIFICAÇÃO E ENQUADRAMENTO");
  rot("B8", "Razão Social");
  sh.getRange("D8:G8").merge();
  val("D8", "=" + V(ix.empresa));
  rot("B9", "Anexo do Simples Nacional");
  val("D9", "=IF(" + V(ix.anexoApurado, VAZIO) + '="";"(não informado)";' +
            "IF(" + V(ix.anexo) + "=" + V(ix.anexoApurado) + ";" + V(ix.anexoApurado) + ";" +
            V(ix.anexoApurado) + '&"  (cadastro: "&' + V(ix.anexo) + '&")"))', null, true);
  rot("F9", "Fator R");
  val("G9", "=IF(OR(" + V(ix.fatorR, "0") + '=0;' + V(ix.fatorR, "0") + '="");"(não informado)";' + V(ix.fatorR) + ")");
  rot("B10", "RBT12 (12 meses anteriores)");
  val("D10", "=" + V(ix.rbt12, "0"), RS);
  rot("F10", "RBT12p (proporcionalizada)");
  val("G10", "=IF(" + V(ix.rbt12p, VAZIO) + '="";"não se aplica";' + V(ix.rbt12p) + ")", RS);
  rot("B11", "RBT12 base usada no cálculo");
  val("D11", "=" + V(ix.rbt12Base, "0"), RS, true);
  rot("F11", "Faixa da tabela (1 a 6)");
  val("G11", "=" + V(ix.faixaRbt12), null, true);
  rot("B12", "CNAEs cadastrados");
  sh.getRange("D12:G12").merge();
  val("D12", "=" + V(ix.cnaes));
  sh.getRange("D12").setHorizontalAlignment("left").setWrap(true);
  sh.setRowHeight(12, 34);
  rot("B13", "Receita do período — mercado interno");
  val("D13", "=" + V(ix.recInterna, "0"), RS);
  rot("F13", "Mercado externo");
  val("G13", "=" + V(ix.recExterna, "0"), RS);

  rot("B14", "Status da última leitura do extrato");
  sh.getRange("D14:G14").merge();
  val("D14", "=" + V(ix.status));

  // ---------------- 2) panorama atual ----------------
  bloco(16, "2.  PANORAMA ATUAL — TODOS OS INDICADORES EM % DO FATURAMENTO");
  sh.getRange("F17:G17").merge();
  cabTab(17, [["B17", "Indicador"], ["D17", "%"], ["F17", "Como o percentual é obtido"]]);

  const pisMaisCof = "(" + V(ix.pis, "0") + "+" + V(ix.cofins, "0") + ")";
  const fatRef = V(ix.faturamento, "1");
  const linhas2 = [
    ["Alíquota efetiva do DAS (tabela oficial LC 123/2006)", "=" + V(ix.aliqCheia), PCT,
     "((RBT12 base × alíquota nominal) − parcela a deduzir) ÷ RBT12 base", true],
    ["Receita exportada (% do faturamento do período)", "=" + V(ix.percExport, "0"), PCT2,
     "Mercado Externo ÷ (Mercado Interno + Mercado Externo) do Discriminativo de Receitas do PGDAS-D", false],
    ["% do DAS imune na exportação (partilha do anexo/faixa)", "=" + V(ix.percImune, "0"), PCT2,
     "PIS + COFINS + IPI + ICMS + ISS na tabela de partilha do anexo/faixa — tributos imunes na exportação (CF art. 149, §2º, I; art. 153, §3º, III; art. 155, §2º, X, \"a\"; LC 116/2003, art. 2º, I)", false],
    ["ALÍQUOTA EFETIVA DO DAS AJUSTADA PELA IMUNIDADE DE EXPORTAÇÃO", "=" + V(ix.aliqAjustada, "0"), PCT,
     "alíquota efetiva × (100% − % exportada × % imune). Sem receita no mercado externo é igual à alíquota cheia", true],
    ["Alíquota efetiva praticada (DAS pago ÷ faturamento)", "=" + V(ix.aliqEfetiva, "0"), PCT,
     "DAS recolhido no período ÷ faturamento do período (reflete retenções e ISS retido)", false],
    ["ISS destacado na nota (dentro do DAS)", "=" + V(ix.aliqISS), PCT,
     "alíquota efetiva × % de repartição do ISS do anexo/faixa, limitado ao teto de 5%", false],
    ["PIS + COFINS embutidos no DAS (% do próprio DAS)", "=" + V(ix.percPisCofins, "0"), PCT2,
     "(PIS + COFINS) ÷ DAS — parcela que sai do DAS em 2027", false],
    ["PIS + COFINS embutidos no DAS (% do faturamento)", "=IFERROR(" + pisMaisCof + "/" + fatRef + ";0)", PCT,
     "(PIS + COFINS) ÷ faturamento", false],
    ["DAS sem PIS/COFINS (% do faturamento)", "=IFERROR(" + V(ix.dasLiquido, "0") + "/" + fatRef + ";0)", PCT,
     "base residual do DAS em 2027 (IRPJ, CSLL, CPP, ICMS/ISS)", true]
  ];
  for (let i = 0; i < linhas2.length; i++) {
    const row = 18 + i;
    rot("B" + row, linhas2[i][0]);
    if (!linhas2[i][4]) sh.getRange("B" + row).setFontWeight("normal");
    val("D" + row, linhas2[i][1], linhas2[i][2], linhas2[i][4]);
    sh.getRange("F" + row + ":G" + row).merge();
    nota("F" + row, linhas2[i][3]);
    sh.setRowHeight(row, 26);
  }

  // ---------------- 3) cenário 2027 ----------------
  bloco(28, "3.  CENÁRIO 2027 — CBS / IBS EM % DO FATURAMENTO");
  sh.getRange("F29:G29").merge();
  cabTab(29, [["B29", "Indicador"], ["D29", "%"], ["F29", "Base legal / origem"]]);

  const RED = V(ix.reducao, "0");
  const CBSE = "IFERROR('Parâmetros'!$B$2*(1-" + RED + ");0)";
  const IBSE = "IFERROR('Parâmetros'!$B$3*(1-" + RED + ");0)";
  // Exportação é IMUNE a CBS e IBS (CF art. 156-A, §1º, III; LC 214/2025 arts. 79 a 82):
  // a nova contribuição incide só sobre a parcela não exportada.
  const EXPP = V(ix.percExport, "0");
  const NEXP = "(1-" + EXPP + ")";
  const CBSX = "IFERROR('Parâmetros'!$B$2*(1-" + RED + ")*" + NEXP + ";0)";
  const linhas3 = [
    ["Redução setorial do CNAE principal", "=" + RED, PCT2,
     "arts. 344 a 348 da LC 214/2025 — item predominante do CNAE PRINCIPAL (coluna S); não é mais a média das atividades", true],
    ["CBS — alíquota cheia 2027", "='Parâmetros'!$B$2", PCT2,
     "art. 347 da LC 214/2025 (parâmetro editável na aba Parâmetros, célula B2)", false],
    ["CBS efetiva após redução", "=" + CBSE, PCT, "CBS cheia × (1 − redução setorial)", false],
    ["IBS — alíquota de teste 2027/2028", "='Parâmetros'!$B$3", PCT2,
     "art. 344 da LC 214/2025 — 0,05% estadual + 0,05% municipal", false],
    ["IBS efetiva após redução (não entra no híbrido)", "=" + IBSE, PCT,
     "IBS de teste × (1 − redução) — informativo: a alíquota híbrida da seção 4 soma apenas a CBS", false],
    ["CBS EFETIVA SOBRE A RECEITA TRIBUTÁVEL (fora a exportação)", "=" + CBSX, PCT,
     "CBS efetiva × (100% − % exportada). As exportações são imunes a CBS e IBS, com manutenção dos créditos (CF art. 156-A, §1º, III e art. 195, §16; LC 214/2025, arts. 79 a 82) — é este valor que entra na carga híbrida", true]
  ];
  for (let i = 0; i < linhas3.length; i++) {
    const row = 30 + i;
    rot("B" + row, linhas3[i][0]);
    if (!linhas3[i][4]) sh.getRange("B" + row).setFontWeight("normal");
    val("D" + row, linhas3[i][1], linhas3[i][2], linhas3[i][4]);
    sh.getRange("F" + row + ":G" + row).merge();
    nota("F" + row, linhas3[i][3]);
    sh.setRowHeight(row, 26);
  }

  // ---------------- 4) alíquota efetiva híbrida 2027 ----------------
  bloco(37, "4.  CARGA TRIBUTÁRIA TOTAL — MEMÓRIA DE CÁLCULO EM % DO FATURAMENTO");
  sh.getRange("F38:G38").merge();
  cabTab(38, [["B38", "Componente da alíquota"], ["D38", "Cenário A — DAS integral (hoje, 2026)"],
              ["F38", "Cenário B — Híbrido 2027 (CBS por FORA do DAS)"]]);
  sh.setRowHeight(38, 46);

  // Fórmula oficial do híbrido:
  //   alíquota efetiva do DAS − %PIS no DAS − %COFINS no DAS + 8,8% × (100% − redução)
  // Sem redução, o último termo são os 8,8% cheios. O IBS de teste não entra.
  const AEF  = V(ix.aliqCheia, "0");
  const AJUS = V(ix.aliqAjustada, "0");
  const IMUN = "IFERROR(" + AEF + "*" + EXPP + "*" + V(ix.percImune, "0") + ";0)";
  const ISSF = V(ix.issFora, "0");
  const PISP = "IFERROR(" + V(ix.pis, "0") + "/" + fatRef + ";0)";
  const COFP = "IFERROR(" + V(ix.cofins, "0") + "/" + fatRef + ";0)";
  const TOTA = "IFERROR(" + AJUS + "+" + ISSF + ";0)";
  const HIB  = "IFERROR(" + AJUS + "+" + ISSF + "-" + PISP + "-" + COFP + "+" + CBSX + ";0)";

  const comp = [
    ["Alíquota efetiva do DAS (tabela oficial LC 123/2006)", "=" + AEF, "=" + AEF, false],
    ["(−) Parcela imune por EXPORTAÇÃO (PIS/COFINS/IPI/ICMS/ISS sobre a receita exportada)",
     "=IFERROR(-" + IMUN + ";0)", "=IFERROR(-" + IMUN + ";0)", false],
    ["(+) ISS recolhido fora do DAS — 6ª faixa dos Anexos III, IV e V", "=" + ISSF, "=" + ISSF, false],
    ["(−) PIS embutido no DAS", "=0", "=-" + PISP, false],
    ["(−) COFINS embutido no DAS", "=0", "=-" + COFP, false],
    ["(+) CBS por fora do DAS = 8,8% × (100% − redução) × (100% − % exportada)", "=0", "=" + CBSX, false],
    ["CARGA TRIBUTÁRIA TOTAL  (=)", "=" + TOTA, "=" + HIB, true],
    ["Variação vs. a carga de hoje (p.p.)", '="—"', "=IFERROR(" + HIB + "-" + TOTA + ";0)", true]
  ];
  for (let i = 0; i < comp.length; i++) {
    const row = 39 + i;
    const destaque = comp[i][3];
    rot("B" + row, comp[i][0]);
    sh.getRange("B" + row).setFontWeight(destaque ? "bold" : "normal")
      .setFontColor(comp[i][0].indexOf("Variação") === 0 ? "#8C2D2D" : VERDE_ESCURO);
    val("D" + row, comp[i][1], PCT, destaque);
    sh.getRange("F" + row + ":G" + row).merge();
    val("F" + row, comp[i][2], PCT, destaque);
    if (comp[i][0].indexOf("CARGA TRIBUTÁRIA TOTAL") === 0) {
      ["B", "D", "F", "G"].forEach(function (c) { sh.getRange(c + row).setBackground(VERDE_TOTAL); });
    }
    sh.setRowHeight(row, 22);
  }
  sh.getRange("B47:G47").merge().setValue(
    "Memória: alíquota efetiva do DAS − parcela imune por exportação + ISS recolhido fora do DAS (6ª faixa) " +
    "− % de PIS embutido no DAS − % de COFINS embutido no DAS + 8,8% × (100% − redução da atividade) × (100% − % exportada).  " +
    "Sem redução, o termo da CBS são os 8,8% cheios; sem receita no mercado externo, a parcela imune é zero e a conta " +
    "volta a ser exatamente a fórmula do DAS integral.  O IBS de teste (0,1%) NÃO entra nesta conta.  " +
    "Da 6ª faixa em diante (RBT12 acima de R$ 3.600.000,00) o ISS sai do DAS e é recolhido direto ao Município, " +
    "mas continua compondo a carga total — alíquota editável em Parâmetros!B4.  " +
    "Na receita de exportação, PIS/COFINS/IPI/ICMS/ISS já são imunes hoje e a CBS/IBS também será: a parcela exportada " +
    "sai NEUTRA na comparação, e para a empresa 100% exportadora a carga de 2027 é igual à de hoje.  " +
    "O total confere com a coluna \"Alíquota Efetiva Híbrida 2027\" (coluna L) da aba \"Simples Nacional\".")
    .setFontSize(8).setFontStyle("italic").setFontColor(CINZA_TXT).setWrap(true).setVerticalAlignment("top");
  sh.setRowHeight(47, 56);

  // ---------------- 5) CNAE principal e item predominante ----------------
  bloco(49, "5.  CNAE PRINCIPAL E ITEM PREDOMINANTE — ORIGEM DA REDUÇÃO");
  const QTD  = "IFERROR(COUNTIF(" + CM_CORR_A + ";" + CEL_CNPJ + ");0)";
  // MAXIFS/MINIFS não sobrevivem à importação de .xlsx sem o prefixo _xlfn:
  // SUMPRODUCT(MAX(...)) funciona igual no Sheets e no Excel.
  const MAXR = "IFERROR(SUMPRODUCT(MAX((" + CM_CORR_A + "=" + CEL_CNPJ + ")*" + CM_CORR_G + "));0)";
  const MINR = "IFERROR(IF(" + QTD + "=0;0;1-SUMPRODUCT(MAX((" + CM_CORR_A + "=" + CEL_CNPJ + ")*(1-" + CM_CORR_G + "))));0)";
  const CHAVE_PRED = CEL_CNPJ + '&"|"&' + V(ix.cnaePrincipal, '""');
  const PRED = function (col) {
    return "IFERROR(INDEX('Correlação CNAEs'!$" + col + ":$" + col + ";MATCH(" + CHAVE_PRED +
           ";'Correlação CNAEs'!$" + COR_COL_CHAVE_PRED + ":$" + COR_COL_CHAVE_PRED + ";0));\"—\")";
  };

  const diag = [
    ["CNAE principal (1º CNAE do cadastro)", "=" + PRED("C"), null,
     "primeiro CNAE da coluna \"CNAEs (Todos)\" — é ele, e só ele, que define a redução"],
    ["Descrição do CNAE principal", "=" + PRED("D"), null, "Base_CNAE_Item, coluna \"Descrição do CNAE\""],
    ["Item predominante do CNAE principal", "=" + PRED("E"), null,
     "marcado com \"S\" na coluna \"Item predominante do CNAE\" da Base_CNAE_Item — mova o \"S\" se o item efetivo for outro"],
    ["Habilitação profissional (art. 127 da LC 214/2025)", "=" + V(ix.habilitacao, VAZIO), null,
     "profissão intelectual de que vem a redução de 30% — vazio quando a redução não é do art. 127"],
    ["Redução do item predominante ANTES do art. 127", "=" + V(ix.redOriginal, "0"), PCT2,
     "é o que a tabela do item daria se todos os requisitos cumulativos do art. 127 fossem atendidos"],
    ["Requisito do art. 127 — atividade diversa da habilitação", "=" + V(ix.requisito127, VAZIO), null,
     "art. 127 da LC 214/2025: a redução de 30% exige, cumulativamente, que a sociedade NÃO exerça atividade diversa da habilitação profissional dos sócios (e não tenha PJ no quadro societário — esse ponto pede conferência no contrato social)"],
    ["CNAEs fora da habilitação profissional", "=" + V(ix.foraHabilit, VAZIO), null,
     "basta UM destes para a redução de 30% cair a zero. As linhas zeradas ficam de AMARELO na aba \"Correlação CNAEs\""],
    ["REDUÇÃO APLICADA NO CÁLCULO", "=" + RED, PCT2,
     "redução do item predominante do CNAE principal, já com o teste do art. 127 (coluna S da aba Simples Nacional)"],
    ["Itens vinculados a TODOS os CNAEs do CNPJ", "=" + QTD, "0",
     "linhas do CNPJ na aba \"Correlação CNAEs\" — informativo, não entram no cálculo"],
    ["Redução MÍNIMA entre esses itens", "=" + MINR, PCT2, "menor redução setorial entre todos os itens do CNPJ"],
    ["Redução MÁXIMA entre esses itens", "=" + MAXR, PCT2, "maior redução setorial entre todos os itens do CNPJ"]
  ];
  for (let i = 0; i < diag.length; i++) {
    const row = 50 + i;
    const destaque = diag[i][0].indexOf("REDUÇÃO") === 0;
    const art127 = diag[i][0].indexOf("Requisito do art. 127") === 0 ||
                   diag[i][0].indexOf("CNAEs fora da habilitação") === 0;
    rot("B" + row, diag[i][0]);
    if (destaque) sh.getRange("B" + row).setBackground(VERDE_TOTAL);
    val("D" + row, diag[i][1], diag[i][2], destaque);
    if (destaque) sh.getRange("D" + row).setBackground(VERDE_TOTAL);
    sh.getRange("F" + row + ":G" + row).merge();
    nota("F" + row, diag[i][3]);
    if (art127) {
      sh.getRange("B" + row).setBackground(AMARELO_LINHA_127);
      sh.getRange("D" + row).setBackground(AMARELO_CEL_127).setFontColor(AMARELO_TXT_127)
        .setHorizontalAlignment("left").setWrap(true);
    }
    sh.setRowHeight(row, art127 ? 34 : 24);
  }

  // ---------------- 6) leitura técnica e recomendação ----------------
  bloco(62, "6.  LEITURA TÉCNICA E RECOMENDAÇÃO");
  const textoLarga = function (cel, formula) {
    sh.getRange(cel + ":G" + cel.substring(1)).merge();
    sh.getRange(cel).setFormula(formula).setFontSize(10)
      .setHorizontalAlignment("left").setVerticalAlignment("middle").setWrap(true);
  };
  rot("B63", "Comparação de carga");
  // ROUND(...;6) evita que um resíduo de ponto flutuante mostre "ABAIXO ... 0,00%"
  // quando os dois cenários são iguais (caso da empresa 100% exportadora).
  textoLarga("D63", "=IF(ROUND(" + HIB + "-" + TOTA + ";6)>0;" +
    '"A carga tributária total no híbrido 2027 fica ACIMA da atual em "&TEXT(' + HIB + "-" + TOTA + ';"0.00%")&" do faturamento.";' +
    "IF(ROUND(" + HIB + "-" + TOTA + ";6)<0;" +
    '"A carga tributária total no híbrido 2027 fica ABAIXO da atual em "&TEXT(' + TOTA + "-" + HIB + ';"0.00%")&" do faturamento.";' +
    '"A carga tributária total no híbrido 2027 permanece EQUIVALENTE à atual."&IF(' + EXPP + '>=99.95%;" A receita é integralmente de exportação: imune a PIS/COFINS/IPI/ICMS/ISS hoje e imune a CBS/IBS em 2027.";"")))');
  sh.setRowHeight(63, 32);

  rot("B64", "Recomendação sobre o regime");
  textoLarga("D64", "=IF(ROUND(" + HIB + "-" + TOTA + ";6)=0;" +
    '"A reforma é NEUTRA para esta empresa: a carga de 2027 é igual à de hoje. "&IF(' + EXPP + '>=99.95%;"Sendo a receita de exportação imune a CBS e IBS, o ganho está no crédito das aquisições, que passa a ser integral e ressarcível.";"Não há acréscimo nem redução a repassar a preço.");' +
    "IF(ROUND(" + HIB + "-" + TOTA + ";6)>0;" +
    '"O híbrido 2027 eleva a carga em "&TEXT(' + HIB + "-" + TOTA + ';"0.00%")&" do faturamento. Se a carteira for majoritariamente PJ, o crédito de CBS de "' +
    "&TEXT(" + CBSX + ';"0.00%")&" transferido aos clientes tende a compensar esse acréscimo; se for majoritariamente PF/consumidor final, o acréscimo é custo puro e deve entrar na formação de preço.";' +
    '"O híbrido 2027 reduz a carga em "&TEXT(' + TOTA + "-" + HIB + ';"0.00%")&" do faturamento e ainda gera crédito de CBS para os clientes PJ. Cenário favorável."))');
  sh.setRowHeight(64, 46);

  rot("B65", "Ação cadastral sugerida");
  textoLarga("D65", "=IF(ROUND(" + MAXR + ";6)>ROUND(" + RED + ";6);" +
    '"⚠️ Há outras atividades do CNPJ com redução maior (até "&TEXT(' + MAXR + ';"0.00%")&' +
    '"). Como a redução vem só do CNAE principal, avaliar se o CNAE principal do cadastro reflete a atividade preponderante — ou reordenar os CNAEs.";' +
    '"✅ O CNAE principal já é o de maior redução entre as atividades do CNPJ — nenhuma alteração cadastral necessária.")');
  sh.setRowHeight(65, 40);

  rot("B66", "Ponto de atenção do RBT12");
  textoLarga("D66", "=IF(" + V(ix.faixaRbt12, VAZIO) + '="EXCEDEU LIMITE";' +
    '"⚠️ RBT12 acima de R$ 4.800.000,00 — empresa fora do Simples Nacional (art. 3º, II e §9º da LC 123/2006).";' +
    "IF(" + V(ix.faixaRbt12, VAZIO) + "=6;" +
    '"6ª faixa: o ISS deixa de ser recolhido no DAS e passa a ser devido direto ao Município (art. 18, §§ 16 e 17 da LC 123/2006) — somado por fora na carga total acima.";' +
    "IF(" + V(ix.rbt12p, VAZIO) + '="";"RBT12 integral (12 meses anteriores) — cálculo padrão.";' +
    '"RBT12 proporcionalizada (RBT12p) informada pela Receita Federal no extrato — empresa com menos de 12 meses de atividade (art. 18, §§ 2º a 4º da LC 123/2006).")))');
  sh.setRowHeight(66, 36);

  rot("B67", "Alerta de cadastro multi-anexo");
  textoLarga("D67", "=IF(ISNUMBER(FIND(\"/\";" + V(ix.anexo, VAZIO) + "));" +
    '"⚠️ O cadastro traz mais de um anexo ("&' + V(ix.anexo) + '&"). O cálculo usou o Anexo "&' + V(ix.anexoApurado) +
    '&". Segregar a receita por atividade antes de fechar o estudo (art. 18, §§ 4º e 5º da LC 123/2006).";' +
    '"✅ Anexo único no cadastro — sem segregação de receita a apurar.")');
  sh.setRowHeight(67, 36);

  rot("B68", "Efeito da receita de exportação");
  textoLarga("D68", "=IF(" + EXPP + "<=0;" +
    '"Sem receita no mercado externo no período — nenhuma imunidade aplicada; a carga acima é a do mercado interno.";' +
    "IF(" + EXPP + ">=99.95%;" +
    '"Empresa praticamente 100% EXPORTADORA. PIS, COFINS, IPI, ICMS e ISS já são imunes hoje (por isso vêm zerados no DAS — não é falha de leitura do extrato) e a CBS/IBS também será imune (CF art. 156-A, §1º, III). Resultado: a carga de 2027 é IGUAL à de hoje ("&TEXT(' + TOTA + ';"0.00%")&"), e permanece o direito ao crédito das aquisições, que passa a ser ressarcível.";' +
    '"Exportação de "&TEXT(' + EXPP + ';"0.00%")&" da receita do período. Sobre essa parcela não incidem PIS/COFINS/IPI/ICMS/ISS hoje nem CBS/IBS em 2027 (imunidade com manutenção de créditos): o impacto da reforma se concentra nos "&TEXT(1-' + EXPP + ';"0.00%")&" de receita interna."))');
  sh.setRowHeight(68, 52);

  rot("B69", "Efeito do art. 127 (profissões intelectuais)");
  const REQ = V(ix.requisito127, VAZIO);
  const ORIG = V(ix.redOriginal, "0");
  // Conta, no CNPJ inteiro, quantos itens de profissão intelectual foram zerados
  // e qual a maior redução perdida. Serve para explicar o caso em que o CNAE
  // PRINCIPAL não é de profissão intelectual (ex.: 7119-7/03) mas a empresa tem
  // CNAEs de engenharia que perderam os 30%.
  const ZER127 = "IFERROR(SUMPRODUCT((" + CM_CORR_A + "=" + CEL_CNPJ + ")*ISNUMBER(SEARCH(\"" + TOKEN_127_ZERADA + "\";" + CM_CORR_REQ + ")));0)";
  const MAXZER = "IFERROR(SUMPRODUCT(MAX((" + CM_CORR_A + "=" + CEL_CNPJ + ")*ISNUMBER(SEARCH(\"" + TOKEN_127_ZERADA + "\";" + CM_CORR_REQ + "))*" + CM_CORR_ORIG + "));0)";
  textoLarga("D69", "=IF(ISNUMBER(SEARCH(\"" + TOKEN_127_ZERADA + "\";" + REQ + "));" +
    '"⚠️ A redução de "&TEXT(' + ORIG + ';"0.00%")&" da "&' + V(ix.habilitacao, '"profissão intelectual"') +
    '&" foi ZERADA pelo art. 127 da LC 214/2025: a empresa exerce atividade diversa da habilitação profissional dos sócios ("&' +
    V(ix.foraHabilit, '"—"') + '&"). Para recuperar os 30% seria preciso baixar esses CNAEs do cadastro — e conferir também os demais requisitos cumulativos, inclusive a ausência de pessoa jurídica no quadro societário.";' +
    "IF(ISNUMBER(SEARCH(\"" + TOKEN_127_OK + "\";" + REQ + "));" +
    '"✅ Redução de "&TEXT(' + ORIG + ';"0.00%")&" mantida: todos os CNAEs do cadastro são inerentes à habilitação profissional. Confirme no contrato social os demais requisitos cumulativos do art. 127 (sócios habilitados e sem pessoa jurídica no quadro).";' +
    "IF(" + ZER127 + ">0;" +
    '"⚠️ O CNAE PRINCIPAL desta empresa não é de profissão intelectual, mas o CNPJ tem "&TEXT(' + ZER127 + ';"0")&" item(ns) da Lista com redução de até "&TEXT(' + MAXZER + ';"0.00%")&" ZERADA pelo art. 127 (atividade diversa da habilitação). Veja as linhas AMARELAS da aba ""Correlação CNAEs"": se a atividade preponderante for a de profissão intelectual, avaliar reordenar os CNAEs e baixar os que estão fora da habilitação.";' +
    '"A redução desta empresa não vem do art. 127 (profissões intelectuais) — o requisito de atividade diversa da habilitação não se aplica.")))');
  sh.setRowHeight(69, 52);

  // ---------------- 7) base legal ----------------
  bloco(71, "7.  BASE LEGAL APLICADA NESTE ESTUDO");
  for (let i = 0; i < BASE_LEGAL_ESTUDO.length; i++) {
    const row = 72 + i;
    sh.getRange("B" + row).setValue(BASE_LEGAL_ESTUDO[i][0])
      .setFontWeight("bold").setFontSize(9).setFontColor(VERDE_ESCURO)
      .setBackground(VERDE_CLARO).setVerticalAlignment("top").setWrap(true);
    sh.getRange("D" + row + ":G" + row).merge();
    sh.getRange("D" + row).setValue(BASE_LEGAL_ESTUDO[i][1])
      .setFontSize(9).setVerticalAlignment("top").setWrap(true).setHorizontalAlignment("left");
    sh.setRowHeight(row, 32);
  }
  const rodape = 72 + BASE_LEGAL_ESTUDO.length + 1;
  sh.getRange("B" + rodape + ":G" + rodape).merge()
    .setValue("Estudo Detalhado gerado a partir das abas \"Simples Nacional\" (extratos do PGDAS-D), \"Parâmetros\" e \"Correlação CNAEs\". Documento de trabalho interno — Escritório Contábil Exemplo.")
    .setFontSize(8).setFontStyle("italic").setFontColor("#6B7A73").setHorizontalAlignment("center").setWrap(true);

  sh.setHiddenGridlines(true);
  sh.setFrozenRows(6);
  return sh;
}

// Base legal — usada na aba "Analise por CNPJ" e no PDF do Estudo Detalhado.
const BASE_LEGAL_ESTUDO = [
  ["Art. 18, §1º-A, LC 123/2006", "Alíquota efetiva = ((RBT12 × alíquota nominal) − parcela a deduzir) ÷ RBT12. É a fórmula da alíquota efetiva do DAS usada neste estudo (coluna W da aba Simples Nacional)."],
  ["Anexos I a V, LC 123/2006 (LC 155/2016)", "Alíquotas nominais, parcelas a deduzir e percentuais de repartição por tributo, por faixa de RBT12. Reproduzidos integralmente na aba \"Parâmetros\"."],
  ["Art. 18, §§ 2º a 4º, LC 123/2006", "Proporcionalização da receita bruta (RBT12p) para empresa com menos de 12 meses de atividade — valor impresso pela Receita Federal no extrato do PGDAS-D (coluna Y)."],
  ["Art. 18, §§ 4º e 5º, LC 123/2006", "Segregação de receitas quando a empresa exerce atividades de anexos distintos (cadastros multi-anexo)."],
  ["Art. 18, §§ 16 e 16-A, LC 123/2006", "Percentual de ISS dentro do DAS limitado ao teto de 5% da receita (coluna AB)."],
  ["Art. 18, §§ 16 e 17, LC 123/2006", "Na 6ª faixa dos Anexos III, IV e V (RBT12 acima de R$ 3.600.000,00) o ISS deixa de ser recolhido no DAS e passa a ser devido direto ao Município. A coluna AB marca \"NÃO DESTACADO\" e a coluna AE soma esse ISS por fora, porque ele continua compondo a carga tributária total (alíquota editável em Parâmetros!B4; teto de 5% pelo art. 8º-A da LC 116/2003)."],
  ["Art. 3º, II e §9º, LC 123/2006", "Limite de R$ 4.800.000,00 de receita bruta anual para permanência no Simples Nacional."],
  ["Art. 3º, § 14, LC 123/2006", "A empresa pode auferir até R$ 4.800.000,00 no mercado interno E outros R$ 4.800.000,00 em exportação de mercadorias e serviços, com RBT12 apurada separadamente por mercado. A coluna AA usa a RBT12 do mercado em que a receita do período foi auferida."],
  ["Art. 18, § 14, LC 123/2006", "Sobre a receita de exportação de mercadorias e serviços não incidem, no DAS, as parcelas de PIS/PASEP, COFINS, IPI, ICMS e ISS. É por isso que o extrato do PGDAS-D traz esses tributos ZERADOS — não é falha de leitura."],
  ["CF art. 149, §2º, I; art. 153, §3º, III; art. 155, §2º, X, \"a\"; LC 116/2003, art. 2º, I", "Imunidade/não incidência das contribuições sociais (PIS/COFINS), do IPI, do ICMS e do ISS sobre as receitas decorrentes de exportação. A coluna AL mede o peso desses tributos na partilha do anexo/faixa e a coluna AM retira essa parcela da alíquota efetiva, na proporção da receita exportada."],
  ["CF art. 156-A, §1º, III e art. 195, §16; LC 214/2025, arts. 79 a 82", "As exportações são imunes ao IBS e à CBS, com manutenção e ressarcimento dos créditos das aquisições. Por isso as colunas J, K e T aplicam a CBS/IBS apenas sobre a parcela NÃO exportada — e a empresa 100% exportadora tem, em 2027, a mesma carga de hoje."],
  ["Art. 127, LC 214/2025", "Redução de 30% do IBS/CBS para os serviços de profissão intelectual, de natureza científica, literária ou artística (engenharia, arquitetura, agronomia, advocacia, contabilidade, medicina veterinária, economia, estatística, biologia/química, biblioteconomia, assistência social). A redução é condicionada a REQUISITOS CUMULATIVOS — entre eles, a sociedade não exercer atividade DIVERSA da habilitação profissional dos sócios e não ter pessoa jurídica no quadro societário. Basta UM CNAE fora da habilitação para a redução cair a ZERO: é o teste das colunas AN a AQ da aba \"Simples Nacional\" e das linhas AMARELAS da aba \"Correlação CNAEs\". O requisito societário não é aferível pelo CNAE e precisa de conferência no contrato social."],
  ["Art. 344, LC 214/2025", "Alíquotas de teste do IBS na transição — 0,1% (0,05% estadual + 0,05% municipal)."],
  ["Art. 347, LC 214/2025", "Alíquota da CBS na transição 2027/2028, com a redução de 0,1 p.p."],
  ["Arts. 344 a 348, LC 214/2025", "Reduções setoriais de CBS e IBS por item/NBS vinculado à atividade. A redução aplicada é a do item predominante do CNAE PRINCIPAL (aba \"Correlação CNAEs\", coluna G, linha marcada como predominante)."],
  ["Art. 41 e seguintes, LC 214/2025", "Regime do optante do Simples na transição: PIS e COFINS deixam o DAS e a CBS passa a ser apurada por fora, junto com o IBS de teste — é o cenário híbrido deste estudo. O recolhimento por fora do DAS é o que permite transferir crédito integral ao adquirente PJ."]
];

// =============================================================================
// 6. ESTUDO DETALHADO EM PDF — paleta verde escuro
// =============================================================================
// Documento NOVO e SEPARADO do Comunicado: não usa ID_MODELO_COMUNICADO e não
// altera aquele fluxo. Lê o CNPJ selecionado em 'Analise por CNPJ'!D5 (ou recebe
// o CNPJ por parâmetro, no modo lote) e monta o PDF a partir da mesma fonte de
// dados do painel: aba "Simples Nacional" + "Parâmetros" + "Correlação CNAEs".
// Assim o PDF e o painel nunca divergem.

function edColetarDados_(cnpj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sn = ss.getSheetByName("Simples Nacional");
  if (!sn) throw new Error("Aba 'Simples Nacional' não encontrada.");
  const ix = mapearColunas_SN_(sn);
  const nLinhas = sn.getLastRow() - 1;
  if (nLinhas < 1) throw new Error("Aba 'Simples Nacional' sem dados.");
  const dados = sn.getRange(2, 1, nLinhas, sn.getLastColumn()).getValues();

  let linha = null;
  for (let i = 0; i < nLinhas; i++) {
    if (String(dados[i][ix.cnpj]).trim() === String(cnpj).trim()) { linha = dados[i]; break; }
  }
  if (!linha) throw new Error("CNPJ " + cnpj + " não encontrado na aba 'Simples Nacional'.");

  const par = ss.getSheetByName("Parâmetros");
  const cbsCheia = Number(par.getRange("B2").getValue()) || 0;
  const ibsTeste = Number(par.getRange("B3").getValue()) || 0;

  const num = function (v) { return (typeof v === "number" && isFinite(v)) ? v : 0; };
  const anexoCad = String(linha[ix.anexo] || "").trim();
  const anexo = String(linha[ix.anexoApurado] || "").trim() || anexoApurado_(anexoCad);
  const rbt12 = num(linha[ix.rbt12]);
  const rbt12p = ix.rbt12p > -1 ? num(linha[ix.rbt12p]) : 0;
  // --- receitas e RBT12 por mercado (interno x externo)
  const recInt = ix.recInterna > -1 ? num(linha[ix.recInterna]) : 0;
  const recExt = ix.recExterna > -1 ? num(linha[ix.recExterna]) : 0;
  const rbtInt = ix.rbt12Interno > -1 ? num(linha[ix.rbt12Interno]) : 0;
  const rbtExt = ix.rbt12Externo > -1 ? num(linha[ix.rbt12Externo]) : 0;
  const totPA = recInt + recExt;
  const pExp  = totPA > 0 ? (recExt / totPA) : 0;
  // RBT12 base: RBT12p > RBT12 do mercado onde a receita foi auferida > RBT12 total
  let base = rbt12;
  if (rbt12p > 0) base = rbt12p;
  else if ((rbtInt + rbtExt) > 0 && totPA > 0) base = (recInt * rbtInt + recExt * rbtExt) / totPA;

  // recalcula pela tabela oficial — confere com a fórmula da planilha
  const calc = calcularAliquotaCheiaSN_(anexo, base);
  const aef = (typeof linha[ix.aliqCheia] === "number" && linha[ix.aliqCheia] > 0)
    ? linha[ix.aliqCheia] : calc.aliqCheia;
  const issPct = (typeof linha[ix.aliqISS] === "number") ? linha[ix.aliqISS] : calc.aliqISS;

  const fat = num(linha[ix.faturamento]);
  const red = num(linha[ix.reducao]);
  const dass = fat > 0 ? num(linha[ix.dasLiquido]) / fat : 0;
  const pisP = fat > 0 ? num(linha[ix.pis]) / fat : 0;
  const cofP = fat > 0 ? num(linha[ix.cofins]) / fat : 0;
  const issFora = ix.issFora > -1 ? num(linha[ix.issFora]) : 0;
  const cbsEf = cbsCheia * (1 - red);
  const ibsEf = ibsTeste * (1 - red);
  const aefNum = (typeof aef === "number") ? aef : 0;
  // --- imunidade de exportação
  // % do DAS composto por tributos imunes na exportação, pela partilha do anexo/faixa
  const faixaCalc = Number(linha[ix.faixaRbt12]) || Number(calc.faixa) || 0;
  const pImune = (ix.percImune > -1 && typeof linha[ix.percImune] === "number" && linha[ix.percImune] > 0)
    ? linha[ix.percImune] : percImuneExportacao_(anexo, faixaCalc);
  const imunePP = aefNum * pExp * pImune;             // em p.p. do faturamento
  // --- imunidade de ICMS (coluna opcional — 01/09/2026): mesma lógica da
  // fórmula da planilha (formulasCalculadas_/aliqAjustada) — só entra quando a
  // coluna "Imunidade de ICMS" existe e está marcada "SIM" nessa empresa.
  const icmsImune = ix.icmsImune > -1 && String(linha[ix.icmsImune] || "").trim() === "SIM";
  const pctIcms = icmsImune ? percIcmsPartilha_(anexo, faixaCalc) : 0;
  const aefAjust = (ix.aliqAjustada > -1 && typeof linha[ix.aliqAjustada] === "number" && linha[ix.aliqAjustada] > 0)
    ? linha[ix.aliqAjustada]
    : (aefNum * (1 - pExp * pImune) - (icmsImune ? aefNum * pctIcms : 0));
  const cbsTrib = cbsEf * (1 - pExp);                 // CBS só sobre a receita não exportada

  // --- art. 127 (profissões intelectuais): habilitação, redução original e o
  //     status do requisito cumulativo de não exercer atividade diversa
  const txt = function (i) { return i > -1 ? String(linha[i] || "").trim() : ""; };
  const habilitacao  = txt(ix.habilitacao);
  const redOriginal  = ix.redOriginal > -1 ? num(linha[ix.redOriginal]) : red;
  const requisito127 = txt(ix.requisito127);
  const foraHabilit  = txt(ix.foraHabilit);
  const art127Zerada = requisito127.indexOf(TOKEN_127_ZERADA) > -1;
  const art127Ok     = requisito127.indexOf(TOKEN_127_OK) > -1;
  const segmento     = txt(ix.segmento) || "DEMAIS";

  // itens da Lista de Serviços vinculados aos CNAEs do CNPJ — posições em COR_IX
  const cor = ss.getSheetByName("Correlação CNAEs");
  const reds = [], det = [];
  if (cor && cor.getLastRow() > 1) {
    const nc = Math.max(cor.getLastColumn(), HEADERS_CORRELACAO.length);
    const cd = cor.getRange(2, 1, cor.getLastRow() - 1, nc).getValues();
    for (let j = 0; j < cd.length; j++) {
      if (String(cd[j][COR_IX.cnpj]).trim() !== String(cnpj).trim()) continue;
      reds.push(num(cd[j][COR_IX.red]));
      det.push({ cnae: cd[j][COR_IX.cnae], dcnae: cd[j][COR_IX.dcnae],
                 item: String(cd[j][COR_IX.item] || "").replace(/^'/, ""),
                 ditem: cd[j][COR_IX.ditem], nbs: cd[j][COR_IX.nbs],
                 red: num(cd[j][COR_IX.red]),
                 dig: String(cd[j][COR_IX.dig] || ""),
                 pred: String(cd[j][COR_IX.pred] || "").toUpperCase(),
                 // art. 127 por linha: redução original e status do requisito
                 redOrig: num(cd[j][COR_IX.redOrig]),
                 zerada127: String(cd[j][COR_IX.req127] || "").indexOf(TOKEN_127_ZERADA) > -1 });
    }
  }

  return {
    cnpj: cnpj, razao: String(linha[ix.empresa] || cnpj), cnaes: String(linha[ix.cnaes] || "—"),
    anexoCad: anexoCad, anexo: anexo, fatorR: linha[ix.fatorR], status: linha[ix.status],
    rbt12: rbt12, rbt12p: rbt12p, base: base,
    faixa: (linha[ix.faixaRbt12] !== "" && linha[ix.faixaRbt12] != null) ? linha[ix.faixaRbt12] : calc.faixa,
    aef: aef, aefNum: aefNum, aePraticada: num(linha[ix.aliqEfetiva]),
    issPct: issPct,
    pisCofDoDas: num(linha[ix.percPisCofins]),
    pisCofDoFat: fat > 0 ? (num(linha[ix.pis]) + num(linha[ix.cofins])) / fat : 0,
    red: red, cbsCheia: cbsCheia, ibsTeste: ibsTeste, cbsEf: cbsEf, ibsEf: ibsEf,
    dass: dass,
    pisP: pisP, cofP: cofP, issFora: issFora,
    // exportação
    recInt: recInt, recExt: recExt, rbtInt: rbtInt, rbtExt: rbtExt,
    pExp: pExp, pImune: pImune, imunePP: imunePP, aefAjust: aefAjust, cbsTrib: cbsTrib,
    icmsImune: icmsImune, pctIcms: pctIcms,
    // art. 127
    habilitacao: habilitacao, redOriginal: redOriginal, requisito127: requisito127,
    foraHabilit: foraHabilit, art127Zerada: art127Zerada, art127Ok: art127Ok,
    segmento: segmento,
    // alíquota efetiva do DAS ajustada pela imunidade de exportação + ISS por fora
    // (6ª faixa) − %PIS − %COFINS + 8,8% × (100% − redução) × (100% − % exportada)
    totA: aefAjust + issFora, totB: aefAjust + issFora - pisP - cofP + cbsTrib,
    det: det, qtdItens: reds.length,
    cnaePrincipal: String(linha[ix.cnaePrincipal] || ""),
    redMin: reds.length ? Math.min.apply(null, reds) : 0,
    redMax: reds.length ? Math.max.apply(null, reds) : 0,
    principal: (function () {
      const dp = String(linha[ix.cnaePrincipal] || "");
      for (let i = 0; i < det.length; i++) if (det[i].dig === dp && det[i].pred === "S") return det[i];
      return null;
    })()
  };
}

function edHtml_(d) {
  const B = "#C9D6CF";
  const esc = function (t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };
  const rot = function (t, w) {
    return '<td style="background:' + VERDE_CLARO + ';color:' + VERDE_ESCURO +
      ';font-weight:bold;border:1px solid ' + B + ';padding:5px 8px;' + (w ? 'width:' + w + ';' : '') + '">' + t + '</td>';
  };
  const cel = function (t, cs) {
    return '<td' + (cs ? ' colspan="' + cs + '"' : '') + ' style="border:1px solid ' + B + ';padding:5px 8px;">' + t + '</td>';
  };
  const num = function (t, b, cs) {
    return '<td' + (cs ? ' colspan="' + cs + '"' : '') + ' style="text-align:center;border:1px solid ' + B +
      ';padding:5px 8px;' + (b ? 'font-weight:bold;' : '') + '">' + t + '</td>';
  };
  const h2 = function (t) {
    return '<tr><td colspan="4" style="background:' + VERDE_MEDIO +
      ';color:#fff;font-size:10pt;font-weight:bold;padding:6px 9px;">' + t + '</td></tr>';
  };
  const ind = function (n, v, como, b) {
    return '<tr><td style="border:1px solid ' + B + ';padding:5px 8px;' +
      (b ? 'font-weight:bold;color:' + VERDE_ESCURO + ';' : '') + '">' + esc(n) + '</td>' + num(v, true) +
      '<td colspan="2" style="border:1px solid ' + B + ';padding:5px 8px;font-size:8pt;font-style:italic;color:' +
      CINZA_TXT + ';">' + esc(como) + '</td></tr>';
  };

  let s = '<html><head><meta charset="utf-8"></head>' +
    '<body style="font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#1E2A24;">';

  s += '<div style="background:' + VERDE_ESCURO + ';color:#fff;padding:14px 18px;">' +
       '<div style="font-size:8pt;letter-spacing:2px;color:#9CC7B4;">EXEMPLO CONTABILIDADE LTDA &nbsp;·&nbsp; REFORMA TRIBUTÁRIA 2027</div>' +
       '<div style="font-size:16pt;font-weight:bold;margin:4px 0;">Estudo Detalhado — Panorama em Percentuais</div>' +
       '<div style="font-size:8.5pt;color:#C6DCD1;">Simples Nacional × Regime IBS/CBS · transição 2027–2028 · documento técnico de apoio ao fiscal</div></div>' +
       '<div style="background:' + DOURADO + ';height:3px;margin-bottom:10px;"></div>';

  s += '<table style="width:100%;border-collapse:collapse;">';

  s += h2('1. IDENTIFICAÇÃO E ENQUADRAMENTO');
  s += '<tr>' + rot('Razão Social', '28%') + cel(esc(d.razao), 3) + '</tr>';
  s += '<tr>' + rot('CNPJ') + cel(esc(d.cnpj)) + rot('Anexo apurado') +
       cel('<b>' + esc(d.anexo || '—') + '</b>' + (d.anexoCad !== d.anexo ? ' &nbsp;(cadastro: ' + esc(d.anexoCad) + ')' : '')) + '</tr>';
  s += '<tr>' + rot('RBT12 (12 meses anteriores)') + cel(reaisBR_(d.rbt12)) +
       rot('RBT12p (proporcionalizada)') + cel(d.rbt12p > 0 ? reaisBR_(d.rbt12p) : 'não se aplica') + '</tr>';
  s += '<tr>' + rot('RBT12 base do cálculo') + cel('<b>' + reaisBR_(d.base) + '</b>') +
       rot('Faixa da tabela') + cel('<b>' + esc(d.faixa) + (typeof d.faixa === 'number' ? 'ª faixa' : '') + '</b>') + '</tr>';
  s += '<tr>' + rot('Fator R') + cel(esc(d.fatorR || 'não informado')) +
       rot('Última leitura do extrato') + cel(esc(d.status || '—')) + '</tr>';
  s += '<tr>' + rot('Receita do período — mercado interno') + cel(reaisBR_(d.recInt)) +
       rot('Receita do período — mercado externo') + cel(reaisBR_(d.recExt) +
       (d.pExp > 0 ? '  <b>(' + pctBR_(d.pExp, 2) + ' da receita)</b>' : '')) + '</tr>';
  if (d.pExp > 0) {
    s += '<tr>' + rot('RBT12 mercado interno') + cel(reaisBR_(d.rbtInt)) +
         rot('RBT12 mercado externo') + cel(reaisBR_(d.rbtExt)) + '</tr>';
  }
  s += '<tr>' + rot('CNAEs cadastrados') +
       '<td colspan="3" style="border:1px solid ' + B + ';padding:5px 8px;font-size:8pt;">' +
       esc(d.cnaes).replace(/,/g, ', ') + '</td></tr>';

  s += h2('2. PANORAMA ATUAL — INDICADORES EM % DO FATURAMENTO');
  s += ind('Alíquota efetiva do DAS (tabela oficial LC 123/2006)', pctBR_(d.aef, 4),
           '((RBT12 base × alíquota nominal) − parcela a deduzir) ÷ RBT12 base', true);
  if (d.pExp > 0) {
    s += ind('Receita exportada (% do faturamento do período)', pctBR_(d.pExp, 2),
             'Mercado Externo ÷ receita total do Discriminativo de Receitas do PGDAS-D');
    s += ind('% do DAS imune na exportação (partilha do anexo/faixa)', pctBR_(d.pImune, 2),
             'PIS + COFINS + IPI + ICMS + ISS na partilha do Anexo ' + esc(d.anexo) + ' — imunes na exportação');
    s += ind('ALÍQUOTA EFETIVA DO DAS AJUSTADA PELA IMUNIDADE DE EXPORTAÇÃO', pctBR_(d.aefAjust, 4),
             'alíquota efetiva × (100% − % exportada × % imune) — é esta que compõe a carga real', true);
  }
  s += ind('Alíquota efetiva praticada (DAS pago ÷ faturamento)', pctBR_(d.aePraticada, 4),
           'reflete retenções, ISS retido e a imunidade da receita exportada');
  s += ind('ISS destacado na nota (dentro do DAS)', pctBR_(d.issPct, 4),
           'alíquota efetiva × % de repartição do anexo/faixa, teto de 5%');
  s += ind('PIS + COFINS embutidos no DAS (% do próprio DAS)', pctBR_(d.pisCofDoDas, 2),
           'parcela do DAS que deixa de existir em 2027');
  s += ind('PIS + COFINS embutidos no DAS (% do faturamento)', pctBR_(d.pisCofDoFat, 4),
           '(PIS + COFINS) ÷ faturamento');
  s += ind('DAS sem PIS/COFINS (% do faturamento)', pctBR_(d.dass, 4),
           'base residual do DAS em 2027 (IRPJ, CSLL, CPP, ICMS/ISS)', true);

  s += h2('3. CENÁRIO 2027 — CBS E IBS EM % DO FATURAMENTO');
  s += ind('Redução setorial do CNAE principal', pctBR_(d.red, 2),
           'arts. 344 a 348 da LC 214/2025 — item predominante do CNAE principal, não a média das atividades', true);
  s += ind('CBS — alíquota cheia 2027', pctBR_(d.cbsCheia, 2), 'art. 347 da LC 214/2025');
  s += ind('CBS efetiva após redução', pctBR_(d.cbsEf, 4), 'CBS cheia × (1 − redução setorial)');
  s += ind('IBS — alíquota de teste 2027/2028', pctBR_(d.ibsTeste, 2), 'art. 344 da LC 214/2025');
  s += ind('IBS efetiva após redução (não entra no híbrido)', pctBR_(d.ibsEf, 4),
           'IBS de teste × (1 − redução) — informativo: a alíquota híbrida soma apenas a CBS');
  if (d.pExp > 0) {
    s += ind('CBS EFETIVA SOBRE A RECEITA TRIBUTÁVEL (fora a exportação)', pctBR_(d.cbsTrib, 4),
             'CBS efetiva × (100% − ' + pctBR_(d.pExp, 2) + '). Exportação é imune a CBS e IBS, com manutenção dos créditos ' +
             '(CF art. 156-A, §1º, III e art. 195, §16; LC 214/2025, arts. 79 a 82)', true);
  }

  s += h2('4. CARGA TRIBUTÁRIA TOTAL — MEMÓRIA DE CÁLCULO EM % DO FATURAMENTO');
  const cabCen = function (t, cs) {
    return '<td' + (cs ? ' colspan="' + cs + '"' : '') + ' style="background:' + VERDE_HEADER +
      ';color:#fff;text-align:center;font-size:8pt;font-weight:bold;border:1px solid ' + B + ';padding:5px;">' + t + '</td>';
  };
  s += '<tr>' + rot('Componente da alíquota', '42%') + cabCen('Cenário A — DAS integral (hoje, 2026)') +
       cabCen('Cenário B — Híbrido 2027 (CBS por fora do DAS)', 2) + '</tr>';
  s += '<tr>' + rot('Alíquota efetiva do DAS (tabela oficial LC 123/2006)') +
       num(pctBR_(d.aefNum, 4)) + num(pctBR_(d.aefNum, 4), false, 2) + '</tr>';
  if (d.imunePP > 0) {
    s += '<tr style="background:#EAF1F7;">' +
         rot('(−) Parcela imune por EXPORTAÇÃO (PIS/COFINS/IPI/ICMS/ISS)') +
         num('−' + pctBR_(d.imunePP, 4)) + num('−' + pctBR_(d.imunePP, 4), false, 2) + '</tr>';
  }
  s += '<tr' + (d.issFora > 0 ? ' style="background:#F6F2E3;"' : '') + '>' +
       rot('(+) ISS recolhido fora do DAS — 6ª faixa') +
       num(pctBR_(d.issFora, 4)) + num(pctBR_(d.issFora, 4), false, 2) + '</tr>';
  s += '<tr>' + rot('(−) PIS embutido no DAS') + num('0,0000%') + num('−' + pctBR_(d.pisP, 4), false, 2) + '</tr>';
  s += '<tr>' + rot('(−) COFINS embutido no DAS') + num('0,0000%') + num('−' + pctBR_(d.cofP, 4), false, 2) + '</tr>';
  s += '<tr>' + rot('(+) CBS por fora do DAS = 8,8% × (100% − ' + pctBR_(d.red, 2) + ')' +
       (d.pExp > 0 ? ' × (100% − ' + pctBR_(d.pExp, 2) + ' exportado)' : '')) +
       num('0,0000%') + num(pctBR_(d.cbsTrib, 4), false, 2) + '</tr>';
  s += '<tr style="background:' + VERDE_TOTAL + ';">' + rot('CARGA TRIBUTÁRIA TOTAL') +
       num(pctBR_(d.totA, 4), true) + num(pctBR_(d.totB, 4), true, 2) + '</tr>';
  s += '<tr>' + rot('Variação vs. a carga de hoje') + num('—') +
       num('<span style="color:' + (Math.round((d.totB - d.totA) * 1e6) / 1e6 > 0 ? '#8C2D2D' : '#1F6B3B') + ';">' + ppBR_(d.totB - d.totA) + '</span>', true, 2) + '</tr>';
  s += '<tr><td colspan="4" style="font-size:7.5pt;font-style:italic;color:' + CINZA_TXT + ';padding:6px 2px;">' +
       '<b>Memória de cálculo.</b> Alíquota efetiva do DAS − parcela imune por exportação + ISS recolhido fora do DAS (6ª faixa) − % de PIS embutido no DAS − % de COFINS embutido no DAS + 8,8% × (100% − redução da atividade) × (100% − % exportada). ' +
       'Sem redução, o último termo são os 8,8% cheios. O IBS de teste (0,1%) não entra nesta conta. ' +
       'O crédito de CBS transferível ao cliente PJ é de ' + pctBR_(d.cbsEf, 2) + ' do faturamento. ' +
       (d.issFora > 0
         ? '<b>Esta empresa está na 6ª faixa</b> (RBT12 acima de R$ 3.600.000,00): o ISS saiu do DAS e é recolhido direto ao Município, mas continua compondo a carga total — daí os ' + pctBR_(d.issFora, 2) + ' somados por fora. '
         : 'Empresa fora da 6ª faixa: o ISS continua dentro do DAS, sem parcela por fora. ') +
       (d.pExp >= 0.9995
         ? '<b>Empresa praticamente 100% exportadora.</b> PIS, COFINS, IPI, ICMS e ISS já são imunes hoje (por isso vêm zerados no DAS — não é falha de leitura do extrato) e a CBS/IBS também será imune: a carga de 2027 fica IGUAL à de hoje, e os créditos das aquisições passam a ser ressarcíveis. '
         : (d.pExp > 0
            ? '<b>Parte da receita é exportada (' + pctBR_(d.pExp, 2) + ').</b> Sobre ela não incidem PIS/COFINS/IPI/ICMS/ISS hoje nem CBS/IBS em 2027 (imunidade com manutenção de créditos): o impacto da reforma se concentra nos ' + pctBR_(1 - d.pExp, 2) + ' de receita interna. '
            : '')) +
       'O total confere com a coluna "Alíquota Efetiva Híbrida 2027" da aba Simples Nacional.</td></tr>';

  s += h2('5. CNAE PRINCIPAL E ITEM PREDOMINANTE — ORIGEM DA REDUÇÃO');
  const p = d.principal;
  s += '<tr>' + rot('CNAE principal (1º do cadastro)', '30%') + cel(esc(p ? p.cnae : '—')) +
       rot('Item predominante') + cel(esc(p ? p.item : '—')) + '</tr>';
  s += '<tr>' + rot('Descrição do CNAE principal') + cel(esc(p ? p.dcnae : '—'), 3) + '</tr>';
  s += '<tr>' + rot('Descrição do item predominante') + cel(esc(p ? p.ditem : '—'), 3) + '</tr>';
  if (d.habilitacao || d.art127Zerada) {
    s += '<tr>' + rot('Habilitação profissional (art. 127)') +
         cel('<b>' + esc(d.habilitacao || '—') + '</b>', 3) + '</tr>';
    s += '<tr' + (d.art127Zerada ? ' style="background:#FFF2CC;"' : '') + '>' +
         rot('Redução do item predominante ANTES do art. 127') +
         '<td colspan="3" style="border:1px solid ' + B + ';padding:5px 8px;"><b>' +
         pctBR_(d.redOriginal, 2) + '</b></td></tr>';
    s += '<tr' + (d.art127Zerada ? ' style="background:#FFF2CC;"' : '') + '>' +
         rot('Requisito do art. 127 — atividade diversa') +
         '<td colspan="3" style="border:1px solid ' + B + ';padding:5px 8px;' +
         (d.art127Zerada ? 'color:' + '#8C5A00' + ';font-weight:bold;' : '') + '">' +
         esc(d.requisito127 || '—') + '</td></tr>';
    if (d.foraHabilit) {
      s += '<tr style="background:#FFF2CC;">' + rot('CNAEs fora da habilitação profissional') +
           '<td colspan="3" style="border:1px solid ' + B + ';padding:5px 8px;font-weight:bold;color:#8C5A00;">' +
           esc(d.foraHabilit) + '</td></tr>';
    }
  }
  s += '<tr>' + rot('REDUÇÃO APLICADA NO CÁLCULO') +
       '<td colspan="3" style="border:1px solid ' + B + ';padding:5px 8px;"><b>' + pctBR_(d.red, 2) +
       '</b> — vem exclusivamente do item predominante do CNAE principal' +
       (d.art127Zerada ? ', já com o corte do art. 127' : '') + '</td></tr>';
  s += '<tr>' + rot('Itens vinculados a todos os CNAEs') + num(d.qtdItens) +
       rot('Redução mín / máx entre eles') + num(pctBR_(d.redMin, 2) + ' / ' + pctBR_(d.redMax, 2)) + '</tr>';
  s += '<tr><td colspan="4" style="border:1px solid ' + B + ';border-left:4px solid ' + DOURADO +
       ';background:#FAFBFA;padding:6px 9px;font-size:8.5pt;">' +
       (d.redMax > d.red + 1e-9
         ? '⚠️ Há outras atividades do CNPJ com redução maior (até ' + pctBR_(d.redMax, 2) +
           '). Como a redução vem só do CNAE principal, avaliar se o CNAE principal do cadastro reflete a atividade preponderante.'
         : '✅ O CNAE principal já é o de maior redução entre as atividades do CNPJ — nada a rever no cadastro.') + '</td></tr>';

  s += '</table>';
  s += '<table style="width:100%;border-collapse:collapse;">';
  s += h2('5.1. ITENS DA LISTA DE SERVIÇOS VINCULADOS AOS CNAEs DO CNPJ');
  s += '</table><table style="width:100%;border-collapse:collapse;font-size:7pt;">' +
       '<tr>' +
       '<td style="background:' + VERDE_HEADER + ';color:#fff;font-weight:bold;text-align:center;border:1px solid ' + B + ';padding:3px;width:9%;">CNAE</td>' +
       '<td style="background:' + VERDE_HEADER + ';color:#fff;font-weight:bold;text-align:center;border:1px solid ' + B + ';padding:3px;width:26%;">Descrição do CNAE</td>' +
       '<td style="background:' + VERDE_HEADER + ';color:#fff;font-weight:bold;text-align:center;border:1px solid ' + B + ';padding:3px;width:7%;">Item</td>' +
       '<td style="background:' + VERDE_HEADER + ';color:#fff;font-weight:bold;text-align:center;border:1px solid ' + B + ';padding:3px;width:32%;">Descrição do item (LC 116/2003)</td>' +
       '<td style="background:' + VERDE_HEADER + ';color:#fff;font-weight:bold;text-align:center;border:1px solid ' + B + ';padding:3px;width:16%;">NBS</td>' +
       '<td style="background:' + VERDE_HEADER + ';color:#fff;font-weight:bold;text-align:center;border:1px solid ' + B + ';padding:3px;width:8%;">Redução</td>' +
       '<td style="background:' + VERDE_HEADER + ';color:#fff;font-weight:bold;text-align:center;border:1px solid ' + B + ';padding:3px;width:6%;">Usado</td></tr>';
  for (let i = 0; i < d.det.length; i++) {
    const x = d.det[i];
    const usado = (x.dig === d.cnaePrincipal && x.pred === 'S');
    const fundoLinha = usado ? '#EAF3EE' : (x.zerada127 ? '#FFF2CC' : '');
    s += '<tr' + (fundoLinha ? ' style="background:' + fundoLinha + ';' + (usado ? 'font-weight:bold;' : '') + '"' : '') + '>' +
      '<td style="border:1px solid ' + B + ';padding:2.5px 4px;vertical-align:top;">' + esc(x.cnae || '-') + '</td>' +
      '<td style="border:1px solid ' + B + ';padding:2.5px 4px;vertical-align:top;">' + esc(x.dcnae || '-') + '</td>' +
      '<td style="border:1px solid ' + B + ';padding:2.5px 4px;vertical-align:top;">' + esc(x.item || '-') + '</td>' +
      '<td style="border:1px solid ' + B + ';padding:2.5px 4px;vertical-align:top;">' + esc(x.ditem || '-') + '</td>' +
      '<td style="border:1px solid ' + B + ';padding:2.5px 4px;vertical-align:top;">' + esc(x.nbs || '-') + '</td>' +
      '<td style="border:1px solid ' + B + ';padding:2.5px 4px;text-align:center;' +
        (x.zerada127 ? 'color:#8C5A00;font-weight:bold;' : '') + '">' + pctBR_(x.red, 2) +
        (x.zerada127 ? '<br><span style="font-size:6pt;">(era ' + pctBR_(x.redOrig, 2) + ' — art. 127)</span>' : '') + '</td>' +
      '<td style="border:1px solid ' + B + ';padding:2.5px 4px;text-align:center;">' + (usado ? '◀ SIM' : '') + '</td></tr>';
  }
  s += '</table>';
  s += '<div style="border:1px solid ' + B + ';border-left:4px solid ' + DOURADO +
       ';background:#FAFBFA;padding:6px 9px;font-size:8pt;margin-top:4px;">' +
       'Cada CNAE pode estar vinculado a mais de um item da Lista de Serviços — por isso um mesmo CNAE aparece em várias linhas. ' +
       'Dos ' + d.qtdItens + ' itens acima, <b>apenas a linha destacada em verde</b> (item predominante do CNAE principal) define a redução aplicada. ' +
       'As linhas em <b>AMARELO</b> teriam redução de 30% pelo art. 127 da LC 214/2025, mas foram ZERADAS porque a empresa exerce atividade diversa da habilitação profissional dos sócios.</div>';
  s += '<table style="width:100%;border-collapse:collapse;">';

  s += h2('6. LEITURA TÉCNICA E RECOMENDAÇÃO');
  // tolerância de 0,0001 p.p.: sem ela um resíduo de ponto flutuante faz o texto
  // dizer "ABAIXO ... +0,00 p.p." quando os dois cenários são de fato iguais —
  // é justamente o caso da empresa 100% exportadora, neutra na reforma.
  const difCen = Math.round((d.totB - d.totA) * 1e6) / 1e6;
  const leitura = difCen === 0
    ? ('A carga tributária total no híbrido 2027 permanece EQUIVALENTE à atual.' +
       (d.pExp >= 0.9995 ? ' A receita é integralmente de exportação: imune a PIS/COFINS/IPI/ICMS/ISS hoje e imune a CBS/IBS em 2027.' : ''))
    : difCen > 0
    ? 'A carga tributária total no híbrido 2027 fica ACIMA da atual em ' + ppBR_(d.totB - d.totA) + ' do faturamento.'
    : 'A carga tributária total no híbrido 2027 fica ABAIXO da atual em ' + ppBR_(d.totA - d.totB) + ' do faturamento.';
  const recom = difCen === 0
    ? ('A reforma é NEUTRA para esta empresa: a carga de 2027 é igual à de hoje. ' +
       (d.pExp >= 0.9995
        ? 'Sendo a receita de exportação imune a CBS e IBS, o ganho está no crédito das aquisições, que passa a ser integral e ressarcível.'
        : 'Não há acréscimo nem redução a repassar a preço.'))
    : difCen > 0
    ? 'O híbrido 2027 eleva a carga em ' + ppBR_(d.totB - d.totA) + ' do faturamento. Se a carteira for majoritariamente PJ, o crédito de CBS de ' +
      pctBR_(d.cbsEf, 2) + ' transferido aos clientes tende a compensar esse acréscimo; se for majoritariamente PF/consumidor final, o acréscimo é custo puro e deve entrar na formação de preço.'
    : 'O híbrido 2027 reduz a carga em ' + ppBR_(d.totA - d.totB) + ' do faturamento e ainda gera crédito de CBS para os clientes PJ. Cenário favorável.';
  s += '<tr>' + rot('Comparação de carga', '28%') + cel(esc(leitura), 3) + '</tr>';
  s += '<tr>' + rot('Recomendação sobre o regime') + cel(esc(recom), 3) + '</tr>';
  s += '<tr>' + rot('Ponto de atenção do RBT12') + cel(esc(
        d.faixa === 'EXCEDEU LIMITE'
          ? '⚠️ RBT12 acima de R$ 4.800.000,00 — empresa fora do Simples Nacional (art. 3º, II e §9º da LC 123/2006).'
          : (d.faixa === 6
              ? '6ª faixa: o ISS deixa de ser recolhido no DAS e passa a ser devido direto ao Município (art. 18, §§ 16 e 17 da LC 123/2006) — somado por fora na carga total acima.'
              : (d.rbt12p > 0
                  ? 'RBT12 proporcionalizada (RBT12p) informada pela Receita Federal — empresa com menos de 12 meses de atividade.'
                  : 'RBT12 integral (12 meses anteriores) — cálculo padrão.'))), 3) + '</tr>';
  if (d.habilitacao || d.art127Zerada) {
    s += '<tr' + (d.art127Zerada ? ' style="background:#FFF2CC;"' : '') + '>' +
      rot('Efeito do art. 127 (profissões intelectuais)') + cel(esc(
        d.art127Zerada
          ? '⚠️ A redução de ' + pctBR_(d.redOriginal, 2) + ' da habilitação em ' + d.habilitacao +
            ' foi ZERADA pelo art. 127 da LC 214/2025: a empresa exerce atividade diversa da habilitação ' +
            'profissional dos sócios (' + d.foraHabilit + '). Para recuperar os 30% seria preciso baixar ' +
            'esses CNAEs do cadastro — e conferir os demais requisitos cumulativos, inclusive a ausência ' +
            'de pessoa jurídica no quadro societário.'
          : '✅ Redução de ' + pctBR_(d.redOriginal, 2) + ' mantida: todos os CNAEs do cadastro são ' +
            'inerentes à habilitação profissional. Confirme no contrato social os demais requisitos ' +
            'cumulativos do art. 127 (sócios habilitados e sem pessoa jurídica no quadro).'), 3) + '</tr>';
  }
  s += '<tr>' + rot('Cadastro de anexos') + cel(esc(
        String(d.anexoCad).indexOf('/') >= 0
          ? '⚠️ O cadastro traz mais de um anexo (' + d.anexoCad + '). O cálculo usou o Anexo ' + d.anexo +
            '. Segregar a receita por atividade antes de fechar o estudo (art. 18, §§ 4º e 5º da LC 123/2006).'
          : '✅ Anexo único no cadastro — sem segregação de receita a apurar.'), 3) + '</tr>';

  s += h2('7. BASE LEGAL APLICADA NESTE ESTUDO');
  for (let i = 0; i < BASE_LEGAL_ESTUDO.length; i++) {
    s += '<tr>' + rot(esc(BASE_LEGAL_ESTUDO[i][0]), '28%') +
      '<td colspan="3" style="border:1px solid ' + B + ';padding:5px 8px;font-size:8pt;">' +
      esc(BASE_LEGAL_ESTUDO[i][1]) + '</td></tr>';
  }
  s += '</table>';

  s += '<div style="background:' + VERDE_ESCURO + ';color:#C6DCD1;font-size:7.5pt;padding:7px 10px;margin-top:10px;">' +
       '<b>Natureza do documento.</b> Estudo Detalhado é documento interno de trabalho, elaborado em percentuais para apoiar a explicação do fiscal ao cliente. ' +
       'Não substitui e não altera o Comunicado Técnico oficial, que segue gerado em valores (R$) pelo modelo próprio. ' +
       'Percentuais calculados sobre o faturamento do período lido no extrato do PGDAS-D.</div>';
  s += '</body></html>';
  return s;
}

// Plano B: se a conversão HTML→PDF falhar, monta o documento pelo DocumentApp.
function edPdfViaDocumentApp_(d, nome) {
  const doc = DocumentApp.create(nome.replace(/\.pdf$/i, ""));
  const corpo = doc.getBody();
  corpo.setMarginTop(40).setMarginBottom(40).setMarginLeft(50).setMarginRight(50);

  corpo.appendParagraph("ESTUDO DETALHADO").setFontSize(20).setBold(true)
    .setForegroundColor(VERDE_ESCURO).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  corpo.appendParagraph("Panorama em percentuais — Simples Nacional × IBS/CBS 2027 · Escritório Contábil Exemplo")
    .setFontSize(10).setItalic(true).setForegroundColor(VERDE_MEDIO)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  corpo.appendParagraph(" ");

  const linha = function (rotulo, valor) {
    const p = corpo.appendParagraph("");
    p.appendText(rotulo + " ").setBold(true).setForegroundColor(VERDE_ESCURO);
    p.appendText(String(valor));
  };
  linha("Empresa:", d.razao);
  linha("CNPJ:", d.cnpj);
  linha("Anexo apurado:", d.anexo + (d.anexoCad !== d.anexo ? " (cadastro: " + d.anexoCad + ")" : ""));
  linha("RBT12 base do cálculo:", reaisBR_(d.base) + (d.rbt12p > 0 ? "  (RBT12p)" : ""));
  linha("Faixa:", d.faixa);
  if (d.pExp > 0) linha("Receita exportada:", reaisBR_(d.recExt) + " (" + pctBR_(d.pExp, 2) +
    " do período) — imune a PIS/COFINS/IPI/ICMS/ISS hoje e a CBS/IBS em 2027; % do DAS imune: " + pctBR_(d.pImune, 2));
  linha("CNAE principal / item predominante:", (d.principal ? (d.principal.cnae + " / " + d.principal.item) : "—") +
        "  —  redução aplicada: " + pctBR_(d.red, 2));
  if (d.art127Zerada) {
    linha("Art. 127 (profissões intelectuais):", "⚠️ redução de " + pctBR_(d.redOriginal, 2) + " (" +
      d.habilitacao + ") ZERADA — a empresa exerce atividade diversa da habilitação profissional: " +
      d.foraHabilit);
  } else if (d.art127Ok) {
    linha("Art. 127 (profissões intelectuais):", "✅ redução de " + pctBR_(d.redOriginal, 2) + " (" +
      d.habilitacao + ") mantida — todos os CNAEs são inerentes à habilitação.");
  }
  corpo.appendParagraph(" ");

  const secao = function (txt) {
    corpo.appendParagraph(txt).setFontSize(12).setBold(true)
      .setForegroundColor("#ffffff").setBackgroundColor(VERDE_ESCURO);
  };
  const pintar = function (tab) {
    for (let r = 0; r < tab.getNumRows(); r++) {
      const row = tab.getRow(r);
      for (let c = 0; c < row.getNumCells(); c++) {
        const cell = row.getCell(c);
        if (r === 0) { cell.setBackgroundColor(VERDE_MEDIO); cell.editAsText().setForegroundColor("#ffffff").setBold(true); }
        else cell.setBackgroundColor(r % 2 === 0 ? VERDE_CLARO : "#ffffff");
      }
    }
  };

  secao("PANORAMA ATUAL (% do faturamento)");
  pintar(corpo.appendTable([
    ["Indicador", "%"],
    ["Alíquota efetiva do DAS (LC 123/2006)", pctBR_(d.aef, 4)],
    ["Alíquota efetiva praticada", pctBR_(d.aePraticada, 4)],
    ["ISS destacado na nota", pctBR_(d.issPct, 4)],
    ["PIS + COFINS no DAS (% do faturamento)", pctBR_(d.pisCofDoFat, 4)],
    ["DAS sem PIS/COFINS (% do faturamento)", pctBR_(d.dass, 4)]
  ]));
  corpo.appendParagraph(" ");

  secao("CARGA TRIBUTÁRIA TOTAL — MEMÓRIA DE CÁLCULO (% do faturamento)");
  pintar(corpo.appendTable([
    ["Componente", "A — hoje (2026)", "B — híbrido 2027"],
    ["Alíquota efetiva do DAS", pctBR_(d.aefNum, 4), pctBR_(d.aefNum, 4)],
    ["(−) Parcela imune por EXPORTAÇÃO", "−" + pctBR_(d.imunePP, 4), "−" + pctBR_(d.imunePP, 4)],
    ["(+) ISS fora do DAS (6ª faixa)", pctBR_(d.issFora, 4), pctBR_(d.issFora, 4)],
    ["(−) PIS embutido no DAS", "0,0000%", "−" + pctBR_(d.pisP, 4)],
    ["(−) COFINS embutido no DAS", "0,0000%", "−" + pctBR_(d.cofP, 4)],
    ["(+) CBS por fora = 8,8% × (100% − " + pctBR_(d.red, 2) + ")" +
      (d.pExp > 0 ? " × (100% − " + pctBR_(d.pExp, 2) + ")" : ""), "0,0000%", pctBR_(d.cbsTrib, 4)],
    ["CARGA TRIBUTÁRIA TOTAL", pctBR_(d.totA, 4), pctBR_(d.totB, 4)],
    ["Variação vs. hoje", "—", ppBR_(d.totB - d.totA)]
  ]));
  corpo.appendParagraph(" ");

  secao("ITENS DA LISTA VINCULADOS AOS CNAEs (" + d.qtdItens + ")");
  const tabItens = [["CNAE", "Item", "Descrição do item", "Redução", "Usado"]];
  for (let i = 0; i < d.det.length; i++) {
    const usado = (d.det[i].dig === d.cnaePrincipal && d.det[i].pred === "S");
    tabItens.push([String(d.det[i].cnae || "-"), String(d.det[i].item || "-"),
                   String(d.det[i].ditem || "-"), pctBR_(d.det[i].red, 2), usado ? "SIM" : ""]);
  }
  pintar(corpo.appendTable(tabItens));
  corpo.appendParagraph(" ");

  secao("BASE LEGAL");
  BASE_LEGAL_ESTUDO.forEach(function (b) {
    corpo.appendParagraph("• " + b[0] + " — " + b[1])
      .setFontSize(8).setItalic(true).setForegroundColor(CINZA_TXT);
  });
  corpo.appendParagraph("Documento interno de apoio técnico. Não substitui o Comunicado Técnico oficial.")
    .setFontSize(8).setForegroundColor(CINZA_TXT).setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  doc.saveAndClose();
  const blob = DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF).setName(nome);
  try { DriveApp.getFileById(doc.getId()).setTrashed(true); } catch (e) { }
  return blob;
}

// -----------------------------------------------------------------------------
// Gera o PDF de UMA empresa INSISTINDO em cada etapa (montar o PDF, gravar no
// Drive e, se o HTML→PDF não vingar, o desenho via DocumentApp).
// Sem trava de tempo (MINUTOS_EXECUCAO = 0), a insistência é limitada apenas por
// MAX_TENTATIVAS_RETRY em cada etapa — nada aborta a execução por relógio.
// -----------------------------------------------------------------------------
function edGerarPdfPara_(cnpj, prazo, avisar) {
  prazo = prazo || novoPrazo_();
  const nada = function () { };
  const av = (typeof avisar === "function") ? avisar : nada;

  const d = edColetarDados_(cnpj);
  const mes = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
  const nome = "EstudoDetalhado_2027_" + String(d.razao).replace(/[^A-Za-z0-9]+/g, "_").substring(0, 45) + "_" + mes + ".pdf";

  const registrar = function (etapa) {
    return function (tentativa, esperaS, restanteTxt) {
      av("⏳ " + etapa + " — tentativa " + tentativa + " de " + MAX_TENTATIVAS_RETRY +
         " falhou; nova em " + esperaS + "s (" + restanteTxt + ")");
    };
  };

  // Com trava de tempo ligada, o prazo é repartido entre as etapas para a
  // montagem não comer tudo e deixar a gravação no Drive sem tempo:
  //   55% montar o PDF pelo HTML  ·  15% o desenho via DocumentApp  ·  resto gravar
  // Sem trava (padrão), cada etapa recebe prazo aberto e para só pelo número
  // de tentativas.
  const total = prazo.restanteMs();
  const fatia = function (fracao) {
    if (!isFinite(total)) return novoPrazo_(Infinity);
    return novoPrazo_(Math.min(Math.round(total * fracao), prazo.restanteMs()));
  };

  // 1) monta o blob do PDF. Tenta o HTML→PDF; se nem assim vingar, cai para o
  //    desenho via DocumentApp com a fatia reservada a ele.
  let blob = null;
  try {
    blob = comRetryAtePrazo_("conversão HTML→PDF do estudo (" + d.razao + ")", function () {
      return Utilities.newBlob(edHtml_(d), "text/html", nome).getAs("application/pdf").setName(nome);
    }, fatia(0.55), registrar("HTML→PDF"));
  } catch (e) {
    Logger.log("HTML→PDF não vingou (" + e.message + "). Tentando o desenho via DocumentApp.");
    av("↩️ HTML→PDF não vingou; montando o PDF via DocumentApp");
    blob = comRetryAtePrazo_("PDF do estudo via DocumentApp (" + d.razao + ")", function () {
      return edPdfViaDocumentApp_(d, nome);
    }, fatia(0.15), registrar("PDF via DocumentApp"));
  }

  // 2) grava na pasta do Drive com TODO o tempo que ainda sobrou — é aqui que
  //    aparece o rate limit quando se gera muita coisa em sequência.
  const arquivo = comRetryAtePrazo_("gravação do PDF no Drive (" + d.razao + ")", function () {
    return DriveApp.getFolderById(ID_PASTA_DESTINO_PDF).createFile(blob);
  }, prazo, registrar("gravação no Drive"));

  Logger.log("Estudo Detalhado gerado: " + arquivo.getUrl());
  return arquivo;
}

function gerarEstudoDetalhadoUnico() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA_ANALISE);
  if (!sh) { exibirAlerta("❌ Aba 'Calculo Manual' não encontrada. Rode '🔧 Remontar painel da aba Analise por CNPJ'."); return; }
  // D5 guarda a RAZÃO SOCIAL escolhida na lista suspensa; G5 traz o CNPJ resolvido.
  const cnpj = String(sh.getRange("G5").getValue() || "").trim();
  const nomeSel = String(sh.getRange("D5").getValue() || "").trim();
  if (!cnpj) {
    exibirAlerta("❌ Não consegui resolver o CNPJ da empresa selecionada" +
      (nomeSel ? " (\"" + nomeSel + "\")" : "") + ".\n\n" +
      "Escolha a empresa na lista suspensa da célula D5 da aba '" + ABA_ANALISE + "'. " +
      "Se a razão social não estiver na aba 'Simples Nacional', digite o CNPJ direto em G5.");
    return;
  }

  // Uma empresa só: prazo aberto (sem trava de tempo).
  const prazo = novoPrazo_();
  const avisar = function (msg) {
    try { ss.toast(msg, "Estudo Detalhado", 8); } catch (e) { }
    Logger.log(msg);
  };
  avisar("🖨️ Gerando o Estudo Detalhado" + (SEM_TRAVA_DE_TEMPO
    ? " — sem trava de tempo; insisto até " + MAX_TENTATIVAS_RETRY + " tentativas por etapa se der erro."
    : " — vou insistir por até " + MINUTOS_EXECUCAO + " min se der erro."));
  try {
    const f = edGerarPdfPara_(cnpj, prazo, avisar);
    exibirAlerta("✅ Estudo Detalhado gerado em " + prazo.minutosDecorridos() + " min.\n\n" +
      f.getName() + "\n" + f.getUrl() +
      "\n\n(O Comunicado Técnico não foi alterado.)");
  } catch (e) {
    exibirAlerta("❌ Não consegui gerar o Estudo Detalhado.\n\n" + e.message +
      "\n\nInsisti por " + prazo.minutosDecorridos() + " min" +
      (SEM_TRAVA_DE_TEMPO ? " (" + MAX_TENTATIVAS_RETRY + " tentativas por etapa)" : " de " + MINUTOS_EXECUCAO) + ".\n" +
      "Se a mensagem falar de permissão ou de pasta/CNPJ inexistente, insistir não resolve — " +
      "confira o ID_PASTA_DESTINO_PDF e o CNPJ selecionado em D5. " +
      "Nos demais casos, rode de novo: o erro costuma ser instabilidade do Drive.");
  }
}

function gerarEstudoDetalhadoEmLote() {
  // Sem trava de tempo: percorre TODAS as empresas marcadas. Se o Google cortar
  // a execução no limite da conta, os PDFs já gerados estão no Drive — desmarque
  // as prontas e rode de novo.
  const prazoLote = novoPrazo_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sn = ss.getSheetByName("Simples Nacional");
  if (!sn) { exibirAlerta("❌ Aba 'Simples Nacional' não encontrada."); return; }
  const ix = mapearColunas_SN_(sn);
  const nLinhas = sn.getLastRow() - 1;
  if (nLinhas < 1) { exibirAlerta("ℹ️ Sem empresas na planilha."); return; }
  const dados = sn.getRange(2, 1, nLinhas, sn.getLastColumn()).getValues();

  const selecionadas = [];
  for (let i = 0; i < nLinhas; i++) {
    if (dados[i][ix.selecionar] !== true) continue;
    const cnpj = String(dados[i][ix.cnpj]).trim();
    if (cnpj) selecionadas.push({ cnpj: cnpj, nome: String(dados[i][ix.empresa] || cnpj) });
  }
  if (selecionadas.length === 0) {
    exibirAlerta("ℹ️ Nenhuma empresa marcada na coluna '☑️ SELECIONAR'."); return;
  }

  let ok = 0, restantes = 0;
  const erros = [];
  for (let i = 0; i < selecionadas.length; i++) {
    const emp = selecionadas[i];
    if (prazoLote.expirou()) { restantes++; continue; }

    const prazoEmpresa = prazoDaEmpresa_(prazoLote);
    const avisar = function (msg) {
      try {
        ss.toast(msg + "\n(" + (i + 1) + " de " + selecionadas.length + " — " + emp.nome + ")",
                 "Estudo Detalhado", 8);
      } catch (e) { }
      Logger.log("[" + emp.nome + "] " + msg);
    };
    try { ss.toast("🖨️ " + (i + 1) + "/" + selecionadas.length + " — " + emp.nome, "Estudo Detalhado", 5); }
    catch (e) { }

    try { edGerarPdfPara_(emp.cnpj, prazoEmpresa, avisar); ok++; }
    catch (e) { erros.push(emp.nome + " (" + emp.cnpj + "): " + e.message); }
  }

  let msg = "✅ " + ok + " Estudo(s) Detalhado(s) gerado(s) em PDF em " +
            prazoLote.minutosDecorridos() + " min.";
  if (restantes > 0) {
    msg += "\n⏱️ O orçamento de " + MINUTOS_EXECUCAO + " min acabou com " + restantes +
           " empresa(s) na fila. Rode de novo: as que já saíram continuam marcadas, " +
           "desmarque-as antes para não repetir o trabalho.";
  }
  if (erros.length > 0) {
    msg += "\n❌ Falhas (mesmo depois de " + MAX_TENTATIVAS_RETRY + " tentativas em cada etapa):\n" +
           erros.slice(0, 10).join("\n");
    if (erros.length > 10) msg += "\n... e outras " + (erros.length - 10) + ". Veja o Logger.";
  }
  exibirAlerta(msg);
}

// =============================================================================
// 7. MIGRAÇÃO DE LAYOUT (rodar uma vez após colar o script)
// =============================================================================
function migrarLayout2027() { return migrarLayout2027_v2(); }   // compatibilidade

function migrarLayout2027_v2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Simples Nacional");
  if (!sheet) throw new Error("Aba 'Simples Nacional' não encontrada.");
  const rel = [];

  // Renomeia a aba antiga do painel, se ainda existir.
  const abaAntiga = ss.getSheetByName("Calculo Manual");
  if (abaAntiga && !ss.getSheetByName(ABA_ANALISE)) {
    abaAntiga.setName(ABA_ANALISE);
    rel.push("Aba 'Calculo Manual' renomeada para '" + ABA_ANALISE + "'.");
  }
  // A aba 'Página4' foi descontinuada — o Banco_Dados é a base única.
  // A aba de histórico do cálculo anterior foi descontinuada.
  ["HISTÓRICO - CALCULO ANTERIOR", "HISTORICO - CALCULO ANTERIOR", "HISTÓRICO", "HISTORICO"]
    .forEach(function (nome) {
      const h = ss.getSheetByName(nome);
      if (h) { try { ss.deleteSheet(h); rel.push("Aba '" + nome + "' removida."); } catch (e) { } }
    });

  const p4 = ss.getSheetByName("Página4");
  if (p4) rel.push("ATENÇÃO: a aba 'Página4' ainda existe. O Banco_Dados passou a ser a base única de Item × NBS × Redução — confira e apague a Página4 manualmente.");

  const nSeg = atualizarAbaSegmentos_(ss);
  rel.push("Aba 'Segmentos' atualizada: " + nSeg + " empresa(s) de ENGENHARIA/SAÚDE " +
           "(recebem o Comunicado do modelo específico; as demais, o modelo padrão).");
  criarAbaParametros_(ss);
  rel.push("Aba 'Parâmetros' pronta: CBS/IBS editáveis + tabela oficial dos Anexos I a V (linhas " +
           PAR_TAB_INI + " a " + PAR_TAB_FIM + ").");

  // O painel só é criado se a aba não existir — para não apagar ajustes manuais.
  // Para reconstruí-lo de propósito: menu 🔧 Remontar painel da aba Analise por CNPJ.
  if (!ss.getSheetByName(ABA_ANALISE)) {
    criarCalculoManual_(ss);
    rel.push("Aba '" + ABA_ANALISE + "' criada com o painel do Estudo Detalhado.");
  } else {
    rel.push("Aba '" + ABA_ANALISE + "' já existe — mantida como está (use '🔧 Remontar painel' para reconstruir).");
  }

  const ultColAntes = sheet.getLastColumn();
  sheet.getRange(1, 1, 1, HEADERS_SN_2027.length).setValues([HEADERS_SN_2027])
    .setFontWeight("bold").setBackground(VERDE_ESCURO).setFontColor("#ffffff").setWrap(true);
  sheet.setFrozenRows(1);
  rel.push("Cabeçalho A1:" + getColunaLetra(HEADERS_SN_2027.length) + "1 normalizado (" +
           HEADERS_SN_2027.length + " colunas, incluindo as de mercado externo AG a AM).");

  const ultLinha = sheet.getLastRow();
  if (ultColAntes > HEADERS_SN_2027.length) {
    const qtdCols = ultColAntes - HEADERS_SN_2027.length;
    const nLin = Math.max(ultLinha - 1, 1);
    const bloco = sheet.getRange(2, HEADERS_SN_2027.length + 1, nLin, qtdCols).getValues();
    const temDados = bloco.some(function (r) {
      return r.some(function (cel) { return cel !== "" && cel !== false && cel !== null; });
    });
    if (temDados) {
      rel.push("ATENÇÃO: colunas " + (HEADERS_SN_2027.length + 1) + " a " + ultColAntes +
               " têm dados; nada foi apagado — confira manualmente.");
    } else {
      sheet.getRange(1, HEADERS_SN_2027.length + 1, 1, qtdCols).clearContent().clearFormat();
      rel.push("Cabeçalhos sobrando limpos (colunas " + (HEADERS_SN_2027.length + 1) + " a " + ultColAntes + ").");
    }
  }

  if (ultLinha < 2) { Logger.log(rel.join("\n")); exibirAlerta(rel.join("\n")); return rel.join("\n"); }

  const ix = mapearColunas_SN_(sheet);
  const nLinhas = ultLinha - 1;
  const cnpjs = sheet.getRange(2, ix.cnpj + 1, nLinhas, 1).getValues();

  const hib = { reducao: [], dasLiquido: [], cbs: [], ibs: [], dasHibrido: [],
                aliqAtual: [], aliqHibrida: [], percPisCofins: [], diferenca: [] };
  const calc = { cnaePrincipal: [], anexoApurado: [], rbt12Base: [], faixa: [],
                 aliqCheia: [], aliqISS: [], issReais: [], issFora: [], aliqTotal: [],
                 percExport: [], percImune: [], aliqAjustada: [],
                 habilitacao: [], redOriginal: [], requisito127: [], foraHabilit: [], segmento: [] };
  let ok = 0;

  for (let i = 0; i < nLinhas; i++) {
    const row = i + 2;
    const temCnpj = String(cnpjs[i][0]).trim() !== "";
    const fh = temCnpj ? formulasHibrido_(row, ix) : null;
    const fc = temCnpj ? formulasCalculadas_(row, ix) : null;
    Object.keys(hib).forEach(function (k) { hib[k].push([fh ? fh[k] : ""]); });
    Object.keys(calc).forEach(function (k) { calc[k].push([fc ? fc[k] : ""]); });
    if (temCnpj) ok++;
  }

  const MOEDA = "R$ #,##0.00", PCT = "0.00%";
  sheet.getRange(2, ix.reducao + 1, nLinhas, 1).setFormulas(hib.reducao).setNumberFormat(PCT);
  sheet.getRange(2, ix.dasLiquido + 1, nLinhas, 1).setFormulas(hib.dasLiquido).setNumberFormat(MOEDA);
  sheet.getRange(2, ix.cbsFora + 1, nLinhas, 1).setFormulas(hib.cbs).setNumberFormat(MOEDA);
  sheet.getRange(2, ix.ibsFora + 1, nLinhas, 1).setFormulas(hib.ibs).setNumberFormat(MOEDA);
  sheet.getRange(2, ix.dasHibrido + 1, nLinhas, 1).setFormulas(hib.dasHibrido).setNumberFormat(MOEDA);
  sheet.getRange(2, ix.aliqEfetiva + 1, nLinhas, 1).setFormulas(hib.aliqAtual).setNumberFormat(PCT);
  sheet.getRange(2, ix.aliqHibrida + 1, nLinhas, 1).setFormulas(hib.aliqHibrida).setNumberFormat(PCT);
  sheet.getRange(2, ix.percPisCofins + 1, nLinhas, 1).setFormulas(hib.percPisCofins).setNumberFormat(PCT);
  sheet.getRange(2, ix.diferenca + 1, nLinhas, 1).setFormulas(hib.diferenca).setNumberFormat(MOEDA);
  sheet.getRange(2, ix.pis + 1, nLinhas, 2).setNumberFormat(MOEDA);

  sheet.getRange(2, ix.cnaePrincipal + 1, nLinhas, 1).setFormulas(calc.cnaePrincipal).setNumberFormat("@");
  sheet.getRange(2, ix.anexoApurado + 1, nLinhas, 1).setFormulas(calc.anexoApurado);
  sheet.getRange(2, ix.rbt12Base + 1, nLinhas, 1).setFormulas(calc.rbt12Base).setNumberFormat(MOEDA);
  sheet.getRange(2, ix.faixaRbt12 + 1, nLinhas, 1).setFormulas(calc.faixa);
  sheet.getRange(2, ix.aliqCheia + 1, nLinhas, 1).setFormulas(calc.aliqCheia).setNumberFormat("0.0000%");
  sheet.getRange(2, ix.aliqISS + 1, nLinhas, 1).setFormulas(calc.aliqISS).setNumberFormat("0.0000%");
  sheet.getRange(2, ix.issReais + 1, nLinhas, 1).setFormulas(calc.issReais).setNumberFormat(MOEDA);
  sheet.getRange(2, ix.issFora + 1, nLinhas, 1).setFormulas(calc.issFora).setNumberFormat("0.0000%");
  sheet.getRange(2, ix.aliqTotal + 1, nLinhas, 1).setFormulas(calc.aliqTotal).setNumberFormat("0.0000%");
  if (ix.percExport > -1)   sheet.getRange(2, ix.percExport + 1, nLinhas, 1).setFormulas(calc.percExport).setNumberFormat("0.00%");
  if (ix.percImune > -1)    sheet.getRange(2, ix.percImune + 1, nLinhas, 1).setFormulas(calc.percImune).setNumberFormat("0.00%");
  if (ix.aliqAjustada > -1) sheet.getRange(2, ix.aliqAjustada + 1, nLinhas, 1).setFormulas(calc.aliqAjustada).setNumberFormat("0.0000%");
  if (ix.habilitacao > -1)  sheet.getRange(2, ix.habilitacao + 1, nLinhas, 1).setFormulas(calc.habilitacao);
  if (ix.redOriginal > -1)  sheet.getRange(2, ix.redOriginal + 1, nLinhas, 1).setFormulas(calc.redOriginal).setNumberFormat("0.00%");
  if (ix.requisito127 > -1) sheet.getRange(2, ix.requisito127 + 1, nLinhas, 1).setFormulas(calc.requisito127);
  if (ix.foraHabilit > -1)  sheet.getRange(2, ix.foraHabilit + 1, nLinhas, 1).setFormulas(calc.foraHabilit);
  if (ix.segmento > -1)     sheet.getRange(2, ix.segmento + 1, nLinhas, 1).setFormulas(calc.segmento).setHorizontalAlignment("center");
  sheet.getRange(2, ix.rbt12p + 1, nLinhas, 1).setNumberFormat(MOEDA);
  sheet.getRange(2, ix.dataAbertura + 1, nLinhas, 1).setNumberFormat("dd/mm/yyyy");

  // Oculta as colunas de apoio: a consulta empresa a empresa é feita na aba de análise.
  for (let c = 1; c <= HEADERS_SN_2027.length; c++) {
    const letra = getColunaLetra(c);
    if (COLUNAS_VISIVEIS_SN.indexOf(letra) === -1) sheet.hideColumns(c);
    else sheet.showColumns(c);
  }
  rel.push("Colunas de apoio ocultadas na aba 'Simples Nacional' — visíveis: " + COLUNAS_VISIVEIS_SN.join(", ") + ".");
  formatarColunaReducao_(sheet, ix);
  rel.push("Coluna " + getColunaLetra(ix.reducao + 1) + " (Redução da Atividade) fica AMARELA " +
           "quando a redução foi zerada pelo art. 127 — a explicação completa está na aba " +
           "'Analise por CNPJ' e nas linhas amarelas da 'Correlação CNAEs'.");

  rel.push("Fórmulas aplicadas em " + ok + " linha(s): cenário híbrido + Faixa/Alíquota Cheia/ISS/RBT12 base/Anexo apurado/CNAE principal.");
  rel.push("Redução (coluna S) vem SÓ do CNAE principal, pelo item predominante — não é média das atividades.");
  rel.push("Art. 127 (profissões intelectuais): colunas AN a AQ trazem a habilitação, a redução ORIGINAL, " +
           "o status do requisito cumulativo e os CNAEs fora da habilitação. Rode '1️⃣b Reconstruir Correlação' " +
           "para reaplicar o teste e marcar de amarelo as linhas zeradas.");
  rel.push("Coluna AR (Segmento): ENGENHARIA/SAÚDE recebem o Comunicado do modelo específico.");
  rel.push("Carga total = alíq. efetiva do DAS + ISS fora do DAS (6ª faixa) − %PIS no DAS − %COFINS no DAS + 8,8% × (100% − redução).");
  rel.push("6ª faixa (RBT12 acima de R$ 3.600.000,00): o ISS sai do DAS e entra por fora na coluna AE (alíquota em Parâmetros!B4).");
  rel.push("Próximo passo: 2️⃣ Extrair DAS e Calcular 2027 para preencher faturamento, PIS e COFINS.");
  const txt = rel.join("\n");
  Logger.log(txt);
  exibirAlerta("🔧 Migração concluída.\n\n" + txt);
  return txt;
}

// =============================================================================
// 8. ABA "EMPRESAS CLIENTES" — alíquotas efetivas DAS e ISS
// Mantida do script de referência. Usa a mesma TABELAS_SN_ e usa RBT12p quando
// informado. Detecta as colunas pelo cabeçalho; se não achar, usa o layout
// A CÓDIGO | B CNPJ | C EMPRESA | D ANEXO | E RBT12 | F RBT12p | G ISS | H DAS.
// =============================================================================
function gerarAliquotasClientes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("EMPRESAS CLIENTES");
  if (!sheet) {
    exibirAlerta("ℹ️ Aba 'EMPRESAS CLIENTES' não existe nesta planilha.\n" +
      "Esta rotina é opcional — o cálculo da carteira principal fica na aba 'Simples Nacional'.");
    return;
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { exibirAlerta("ℹ️ Aba 'EMPRESAS CLIENTES' sem dados."); return; }

  const lastCol = Math.max(sheet.getLastColumn(), 8);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let iAnexo  = acharColuna(headers, ["anexo"]);
  let iRbt12  = acharColuna(headers, ["rbt12"]);
  let iRbt12p = acharColuna(headers, ["rbt12p", "proporcionaliz"]);
  let iIss    = acharColuna(headers, ["iss"]);
  let iDas    = acharColuna(headers, ["das", "aliquotaefetiva"]);
  if (iAnexo === -1)  iAnexo = 3;
  if (iRbt12 === -1)  iRbt12 = 4;
  if (iRbt12p === -1) iRbt12p = 5;
  if (iIss === -1)    iIss = 6;
  if (iDas === -1)    iDas = 7;
  // "RBT12" casa também com "RBT12p": se colidirem, mantém o layout padrão.
  if (iRbt12 === iRbt12p) { iRbt12 = 4; iRbt12p = 5; }

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const resISS = [], resDAS = [];

  data.forEach(function (linha) {
    const romano = anexoApurado_(String(linha[iAnexo] || "").replace(/ANEXO/i, ""));
    const rbt12  = parseMonetario_(linha[iRbt12]);
    const rbt12p = parseMonetario_(linha[iRbt12p]);
    const base   = rbt12p > 0 ? rbt12p : rbt12;
    const r = calcularAliquotaCheiaSN_(romano, base);
    resISS.push([r.aliqISS]);
    resDAS.push([r.aliqCheia]);
  });

  sheet.getRange(2, iIss + 1, resISS.length, 1).setValues(resISS);
  sheet.getRange(2, iDas + 1, resDAS.length, 1).setValues(resDAS);
  formatarColunaPercentual_(sheet, resISS, iIss + 1);
  formatarColunaPercentual_(sheet, resDAS, iDas + 1);

  exibirAlerta("✅ Cálculo concluído: " + resDAS.length + " empresa(s).\n" +
    "Fórmula: ((RBT12 × Nominal) − Dedução) ÷ RBT12, com RBT12p quando informado.\n" +
    "Teto de ISS de 5% aplicado (art. 18, §§ 16 e 16-A da LC 123/2006).");
}

function formatarColunaPercentual_(sheet, resultados, colIndex) {
  for (let i = 0; i < resultados.length; i++) {
    const cell = sheet.getRange(i + 2, colIndex);
    if (typeof resultados[i][0] === "number") cell.setNumberFormat("0.0000%");
    else cell.setNumberFormat("@");
  }
}

// =============================================================================
// 9. DIAGNÓSTICO
// =============================================================================
function TEMP_testarExtrato_06_2026() { extrairDadosExtrato_IBSCBS("06/2026", 3); }
function TEMP_testarComunicado_1()    { gerarComunicadoUnico(1); }

// Ajuste o CNPJ/competência aqui e rode pelo editor para ver o texto do extrato.
function TEMP_dumpTeste() {
  TEMP_dumpTextoPDF_UmaLinha("00.000.999/0001-00", "06/2026");
}

// Registra no Logger os trechos do extrato em volta de RBT12 / RBT12p / Abertura.
// Use para confirmar o formato do texto antes de ajustar os regex.
function TEMP_dumpTextoPDF_UmaLinha(cnpjAlvo, competencia) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Simples Nacional");
  const ix = mapearColunas_SN_(sheet);
  const dados = sheet.getDataRange().getValues();
  let empresa = null;
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][ix.cnpj]).trim() === String(cnpjAlvo).trim()) { empresa = String(dados[i][ix.empresa]).trim(); break; }
  }
  if (!empresa) { Logger.log("CNPJ não encontrado: " + cnpjAlvo); return; }

  const comp = montarCompetencia_(competencia);
  const pastaPai = DriveApp.getFolderById(ID_PASTA_EXTRATOS);
  const pastaEmpresa = buscarPastaEmpresa_IBSCBS(pastaPai, empresa);
  if (!pastaEmpresa) { Logger.log("Pasta não encontrada para " + empresa); return; }
  const pdf = buscarExtrato_IBSCBS(pastaPai, pastaEmpresa, cnpjAlvo, comp.compLimpa, comp.variacoes, String(comp.anoPA));
  if (!pdf) { Logger.log("Extrato não localizado para " + empresa + " em " + competencia); return; }

  const texto = lerTextoDoPdf_(pdf, empresa);
  Logger.log("=== " + empresa + " | " + competencia + " | arquivo: " + pdf.getName());
  ["RBT12p", "proporcionaliz", "RBT12", "Data de Abertura", "Fator r"].forEach(function (termo) {
    const re = new RegExp(termo, "i");
    const pos = texto.search(re);
    if (pos === -1) { Logger.log("[" + termo + "] NÃO ENCONTRADO"); return; }
    Logger.log("[" + termo + "] ..." +
      texto.substring(Math.max(0, pos - 150), pos + 250).replace(/\s+/g, " ") + "...");
  });
}

function TEMP_diagnosticoColunas() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Simples Nacional");
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (let i = 0; i < headers.length; i++) Logger.log(getColunaLetra(i + 1) + " (" + (i + 1) + "): " + headers[i]);
  const ix = mapearColunas_SN_(sheet);
  Object.keys(ix).forEach(function (k) {
    Logger.log(k + " -> " + (ix[k] === -1 ? "NÃO ENCONTRADA" : getColunaLetra(ix[k] + 1)));
  });
}

// Chave por CNPJ + CNAE + Item — CNAEs com múltiplos itens não são duplicata.
function TEMP_diagnosticoDuplicatasChave() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Correlação CNAEs");
  const nLinhas = sheet.getLastRow() - 1;
  if (nLinhas < 1) { Logger.log("Correlação vazia."); return; }
  const dados = sheet.getRange(2, 1, nLinhas, 4).getValues();
  const contagem = {};
  for (let i = 0; i < nLinhas; i++) {
    const k = String(dados[i][0]).trim() + "|" + String(dados[i][2]).trim() + "|" + String(dados[i][3]).trim();
    if (k === "||") continue;
    contagem[k] = (contagem[k] || 0) + 1;
  }
  let chavesDup = 0, extras = 0;
  const exemplos = [];
  for (const k in contagem) {
    if (contagem[k] > 1) {
      chavesDup++; extras += contagem[k] - 1;
      if (exemplos.length < 10) exemplos.push(k + " (" + contagem[k] + "x)");
    }
  }
  Logger.log("Linhas: " + nLinhas + " | chaves com duplicata: " + chavesDup + " | linhas extras: " + extras);
  Logger.log("Exemplos: " + exemplos.join(" | "));
}

function TEMP_removerDuplicatasCorrelacao() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Correlação CNAEs");
  const nLinhas = sheet.getLastRow() - 1;
  if (nLinhas < 1) return;
  const dados = sheet.getRange(2, 1, nLinhas, sheet.getLastColumn()).getValues();
  const vistos = {};
  const remover = [];
  for (let i = 0; i < nLinhas; i++) {
    const chave = String(dados[i][0]).trim() + "|" + String(dados[i][2]).trim() + "|" + String(dados[i][3]).trim();
    if (chave === "||") continue;
    if (vistos[chave]) remover.push(i + 2); else vistos[chave] = true;
  }
  remover.sort(function (a, b) { return b - a; });
  for (let i = 0; i < remover.length; i++) sheet.deleteRow(remover[i]);
  SpreadsheetApp.flush();
  Logger.log("Duplicatas removidas: " + remover.length);
}


// -----------------------------------------------------------------------------
// CONFERÊNCIA: FATURAMENTO PARCIAL (02/09/2026)
// Até 02/09/2026 a leitura do RPA podia cair num rótulo POR ATIVIDADE do extrato
// ("Receita Bruta Informada"). Empresas com mais de uma atividade no extrato
// (as "VÁRIOS") ficaram com o faturamento PARCIAL na coluna Faturamento — e,
// por consequência, com a alíquota híbrida errada.
// O teste abaixo não depende do texto do PDF: PIS + COFINS lidos do DAS têm de
// fechar com faturamento × alíquota efetiva cheia × (%PIS + %COFINS da partilha
// do anexo/faixa). Se não fecha, o que está errado é o faturamento.
// A rotina MARCA (Status + SELECIONAR) as linhas divergentes para que o
// "2️⃣ Extrair DAS e Calcular 2027" as reprocesse com a leitura corrigida.
// -----------------------------------------------------------------------------
function marcarFaturamentoSuspeito_2027() {
  const TOLERANCIA = 0.10;   // 10% de folga para arredondamento e ISS retido
  const MARCA = "🔁 Reprocessar — faturamento parcial (conferência 02/09/2026)";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Simples Nacional");
  if (!sheet) { exibirAlerta("❌ Aba \"Simples Nacional\" não encontrada."); return; }

  const ix = mapearColunas_SN_(sheet);
  const ultima = sheet.getLastRow();
  if (ultima < 2) { exibirAlerta("Nada a conferir."); return; }
  const dados = sheet.getRange(2, 1, ultima - 1, sheet.getLastColumn()).getValues();

  const num = function (v) {
    if (typeof v === "number") return v;
    const s = String(v || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  const romanoDe = function (v) {
    const m = String(v || "").toUpperCase().match(/^(I{1,3}V?|IV|V)/);
    return m ? m[1] : "";
  };

  const marcadas = [], selecao = [];
  for (let i = 0; i < dados.length; i++) {
    const linha = dados[i];
    const romano = romanoDe(linha[ix.anexoApurado]);
    const faixa = parseInt(linha[ix.faixaRbt12], 10);
    const fat = num(linha[ix.faturamento]);
    const cheia = num(linha[ix.aliqCheia]);
    const pc = num(linha[ix.pis]) + num(linha[ix.cofins]);
    const tab = PARTILHA_SN_["Anexo " + romano];
    const f = (tab && tab[faixa - 1]) ? tab[faixa - 1] : null;
    const part = f ? (f.pis + f.cofins) / 100 : 0;
    const esperado = fat * cheia * part;
    const suspeita = (part > 0 && fat > 0 && cheia > 0 && pc > 0 && esperado > 0)
                     ? (Math.abs(pc / esperado - 1) > TOLERANCIA) : false;
    selecao.push([suspeita]);
    if (suspeita) marcadas.push(i + 2);
  }

  if (ix.selecionar > -1) sheet.getRange(2, ix.selecionar + 1, selecao.length, 1).setValues(selecao);
  for (let k = 0; k < marcadas.length; k++) {
    sheet.getRange(marcadas[k], ix.status + 1)
         .setValue(MARCA)
         .setBackground(LARANJA_MULTI_ITEM)
         .setFontColor(LARANJA_MULTI_ITEM_TXT);
  }
  SpreadsheetApp.flush();
  exibirAlerta("🔎 Conferência de faturamento\n\n" + marcadas.length +
               " linha(s) marcada(s) e selecionada(s) para reprocessar.\n\n" +
               "Agora rode: ⚙️ Automação 2027 > 2️⃣ Extrair DAS e Calcular 2027.");
}


// -----------------------------------------------------------------------------
// ANEXO DECLARADO NO PRÓPRIO EXTRATO (02/09/2026)
// Cada bloco "Valor do Débito por Tributo para a Atividade" do PGDAS-D diz em
// que anexo aquela receita foi tributada ("... tributados pelo Anexo III ...")
// e traz a Receita Bruta Informada do bloco. Numa empresa com vários CNAEs isso
// resolve o anexo sem chute: devolvemos o anexo PREDOMINANTE por receita.
// Devolve "" quando o extrato não traz a informação.
// -----------------------------------------------------------------------------
function anexoDoExtrato_(texto) {
  const partes = String(texto || "").split(/Valor\s+do\s+D[eé]bito\s+por\s+Tributo\s+para\s+a\s+Atividade/i);
  const soma = {};
  for (let i = 1; i < partes.length; i++) {
    const mA = partes[i].match(/tributad[oa]s?\s+pelo\s+Anexo\s+(I{1,3}V?|IV|V)\b/i);
    if (!mA) continue;
    const an = String(mA[1]).toUpperCase();
    const mR = partes[i].match(/Receita\s*Bruta\s*Informada\s*:?\s*R?\$?\s*([\d\.]+,\d{2})/i);
    const rec = mR ? parseMoney_IBSCBS(mR[1]) : 0;
    soma[an] = (soma[an] || 0) + (rec > 0 ? rec : 0.01);
  }
  let melhor = "", valor = -1;
  for (const k in soma) if (soma[k] > valor) { valor = soma[k]; melhor = k; }
  return melhor;
}


// -----------------------------------------------------------------------------
// MARCAR PARA REPROCESSAR — anexo do extrato e RBT12p (02/09/2026)
// Duas situações que só se resolvem relendo o PDF:
//   a) cadastro com mais de um anexo ("VÁRIOS") e a coluna "Anexo no Extrato"
//      ainda vazia — sem ela o anexo apurado cai no critério de maior alíquota;
//   b) RBT12p diferente da RBT12 numa empresa aberta há mais de 12 meses, que
//      não tem direito à proporcionalização (LC 123/2006, art. 18, §§ 2º a 4º):
//      a base de cálculo, a faixa e a alíquota saíram erradas.
// -----------------------------------------------------------------------------
function marcarReprocessarAnexoERbt12p_2027() {
  const MARCA = "🔁 Reprocessar — anexo do extrato / RBT12p (02/09/2026)";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Simples Nacional");
  if (!sheet) { exibirAlerta("❌ Aba \"Simples Nacional\" não encontrada."); return; }
  const ix = mapearColunas_SN_(sheet);
  const ultima = sheet.getLastRow();
  if (ultima < 2) { exibirAlerta("Nada a marcar."); return; }
  const dados = sheet.getRange(2, 1, ultima - 1, sheet.getLastColumn()).getValues();

  const num = function (v) {
    if (typeof v === "number") return v;
    const s = String(v || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  const dataDe = function (v) {
    if (v instanceof Date) return v;
    const m = String(v || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
  };
  const hoje = new Date();
  const corte = new Date(hoje.getFullYear(), hoje.getMonth() - 13, 1);

  const marcadas = [], selecao = [];
  let semAnexo = 0, proporc = 0;
  for (let i = 0; i < dados.length; i++) {
    const linha = dados[i];
    const temDados = num(linha[ix.rbt12]) > 0 || num(linha[ix.valorDas]) > 0;
    const multiplo = String(linha[ix.anexo] || "").indexOf("/") > -1;
    const faltaAnexo = temDados && multiplo && ix.anexoExtrato > -1 &&
                       !String(linha[ix.anexoExtrato] || "").trim();
    const rbt12 = num(linha[ix.rbt12]);
    const rbt12p = ix.rbt12p > -1 ? num(linha[ix.rbt12p]) : 0;
    let proporcIndevida = false;
    if (rbt12p > 0 && rbt12 > 0 && Math.abs(rbt12p - rbt12) > 0.02 && ix.dataAbertura > -1) {
      const ab = dataDe(linha[ix.dataAbertura]);
      if (ab && ab < corte) proporcIndevida = true;
    }
    const alvo = faltaAnexo || proporcIndevida;
    if (faltaAnexo) semAnexo++;
    if (proporcIndevida) proporc++;
    selecao.push([alvo]);
    if (alvo) marcadas.push(i + 2);
  }

  if (ix.selecionar > -1) sheet.getRange(2, ix.selecionar + 1, selecao.length, 1).setValues(selecao);
  for (let k = 0; k < marcadas.length; k++) {
    sheet.getRange(marcadas[k], ix.status + 1)
         .setValue(MARCA)
         .setBackground(LARANJA_MULTI_ITEM)
         .setFontColor(LARANJA_MULTI_ITEM_TXT);
  }
  SpreadsheetApp.flush();
  exibirAlerta("🔁 Marcação para reprocessar\n\n" + marcadas.length + " linha(s) marcada(s):\n" +
               "• " + semAnexo + " com vários anexos e sem \"Anexo no Extrato\"\n" +
               "• " + proporc + " com RBT12p indevida\n\n" +
               "Agora rode: ⚙️ Automação 2027 > 2️⃣ Extrair DAS e Calcular 2027.");
}


// =============================================================================
// PASSO 2 — CONFERIR E MARCAR AS LINHAS COM PROBLEMA (02/09/2026)
// -----------------------------------------------------------------------------
// Três conferências, nenhuma delas dependente do texto do PDF:
//   a) FATURAMENTO PARCIAL — PIS + COFINS lidos do DAS têm de fechar com
//      faturamento × alíquota efetiva cheia × (%PIS + %COFINS da partilha do
//      anexo/faixa). Não fechando, o faturamento gravado é de uma atividade só
//      (o erro clássico das empresas com vários CNAEs).
//   b) ANEXO DO EXTRATO FALTANDO — cadastro com mais de um anexo e a coluna
//      "Anexo no Extrato" vazia: sem ela o anexo apurado cai no critério de
//      maior alíquota, que é só o último recurso.
//   c) RBT12p INDEVIDA — base proporcionalizada numa empresa aberta há mais de
//      12 meses, que não tem direito a isso (LC 123/2006, art. 18, §§ 2º a 4º).
// A linha marcada fica laranja no Status e com o ☑ SELECIONAR ligado, pronta
// para o passo 3. Chamada com silencioso = true, não mostra caixa de aviso e
// devolve os contadores.
// =============================================================================
function conferirLinhas_2027(silencioso) {
  const TOLERANCIA = 0.10;
  const MARCA = "🔁 Precisa reler o extrato — conferência de 02/09/2026";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Simples Nacional");
  if (!sheet) { exibirAlerta("❌ Aba \"Simples Nacional\" não encontrada."); return null; }

  const ix = mapearColunas_SN_(sheet);
  const ultima = sheet.getLastRow();
  if (ultima < 2) { if (silencioso !== true) exibirAlerta("Nada a conferir."); return { marcadas: 0 }; }
  const dados = sheet.getRange(2, 1, ultima - 1, sheet.getLastColumn()).getValues();

  const num = function (v) {
    if (typeof v === "number") return v;
    const s = String(v || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  const romanoDe = function (v) {
    const m = String(v || "").toUpperCase().match(/^(I{1,3}V?|IV|V)/);
    return m ? m[1] : "";
  };
  const dataDe = function (v) {
    if (v instanceof Date) return v;
    const m = String(v || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
  };
  const hoje = new Date();
  const corte = new Date(hoje.getFullYear(), hoje.getMonth() - 13, 1);

  const marcadas = [], selecao = [];
  let cFat = 0, cAnexo = 0, cRbt = 0;
  for (let i = 0; i < dados.length; i++) {
    const linha = dados[i];

    // (a) faturamento parcial
    const romano = romanoDe(linha[ix.anexoApurado]);
    const faixa = parseInt(linha[ix.faixaRbt12], 10);
    const fat = num(linha[ix.faturamento]);
    const cheia = num(linha[ix.aliqCheia]);
    const pc = num(linha[ix.pis]) + num(linha[ix.cofins]);
    const tab = PARTILHA_SN_["Anexo " + romano];
    const f = (tab && tab[faixa - 1]) ? tab[faixa - 1] : null;
    const esperado = f ? fat * cheia * (f.pis + f.cofins) / 100 : 0;
    const fatParcial = (esperado > 0 && pc > 0) ? (Math.abs(pc / esperado - 1) > TOLERANCIA) : false;

    // (b) anexo do extrato faltando
    const temDados = num(linha[ix.rbt12]) > 0 || num(linha[ix.valorDas]) > 0;
    const faltaAnexo = temDados && String(linha[ix.anexo] || "").indexOf("/") > -1 &&
                       ix.anexoExtrato > -1 && !String(linha[ix.anexoExtrato] || "").trim();

    // (c) RBT12p indevida
    const rbt12 = num(linha[ix.rbt12]);
    const rbt12p = ix.rbt12p > -1 ? num(linha[ix.rbt12p]) : 0;
    let proporcIndevida = false;
    if (rbt12p > 0 && rbt12 > 0 && Math.abs(rbt12p - rbt12) > 0.02 && ix.dataAbertura > -1) {
      const ab = dataDe(linha[ix.dataAbertura]);
      if (ab && ab < corte) proporcIndevida = true;
    }

    if (fatParcial) cFat++;
    if (faltaAnexo) cAnexo++;
    if (proporcIndevida) cRbt++;
    const alvo = fatParcial || faltaAnexo || proporcIndevida;
    selecao.push([alvo]);
    if (alvo) marcadas.push(i + 2);
  }

  if (ix.selecionar > -1) sheet.getRange(2, ix.selecionar + 1, selecao.length, 1).setValues(selecao);
  for (let k = 0; k < marcadas.length; k++) {
    sheet.getRange(marcadas[k], ix.status + 1)
         .setValue(MARCA)
         .setBackground(LARANJA_MULTI_ITEM)
         .setFontColor(LARANJA_MULTI_ITEM_TXT);
  }
  SpreadsheetApp.flush();

  const res = { marcadas: marcadas.length, faturamento: cFat, anexo: cAnexo, rbt12p: cRbt, linhas: marcadas };
  if (silencioso !== true) {
    exibirAlerta("🔎 Conferência das linhas\n\n" + marcadas.length + " linha(s) marcada(s) em laranja:\n" +
      "• " + cFat + " com faturamento parcial (só uma atividade do extrato)\n" +
      "• " + cAnexo + " sem o anexo declarado no extrato\n" +
      "• " + cRbt + " com base proporcionalizada indevida\n\n" +
      (marcadas.length > 0
        ? "Agora rode: ⚙️ Automação 2027 > 3 · Corrigir as linhas marcadas."
        : "Está tudo certo — nenhuma linha precisa ser relida."));
  }
  return res;
}


// =============================================================================
// ROTINA DO MÊS — "ATUALIZAR TUDO" (02/09/2026)
// -----------------------------------------------------------------------------
// O menu foi reorganizado para quem não mexe no código. O caminho normal é um
// clique só, em "▶️ ATUALIZAR TUDO", que executa na ordem certa:
//   1. lê o extrato do PGDAS-D de todas as empresas da aba;
//   2. confere as linhas e marca as que ficaram com problema
//      (faturamento parcial, anexo do extrato faltando, RBT12p indevida);
//   3. relê essas linhas marcadas;
//   4. recalcula as fórmulas de todas as linhas.
// O Google interrompe qualquer rotina depois de alguns minutos. Por isso a
// rotina anota em que passo parou e, ao ser clicada de novo, continua dali —
// a mensagem do final sempre diz se acabou ou se é para clicar outra vez.
// Os itens numerados 1 a 4 do menu fazem cada passo isoladamente.
// =============================================================================
const PROP_ATT_ETAPA_ = "ATT_2027_ETAPA";
const PROP_ATT_COMP_  = "ATT_2027_COMP";

// Marca a coluna SELECIONAR de todas as linhas que têm CNPJ.
function selecionarTodasAsLinhas_2027(sheet) {
  const ix = mapearColunas_SN_(sheet);
  if (ix.selecionar < 0 || ix.cnpj < 0) return 0;
  const ultima = sheet.getLastRow();
  if (ultima < 2) return 0;
  const cnpjs = sheet.getRange(2, ix.cnpj + 1, ultima - 1, 1).getValues();
  const marca = cnpjs.map(function (l) { return [String(l[0] || "").trim() !== ""]; });
  sheet.getRange(2, ix.selecionar + 1, marca.length, 1).setValues(marca);
  SpreadsheetApp.flush();
  let n = 0;
  for (let i = 0; i < marca.length; i++) if (marca[i][0]) n++;
  return n;
}

// Passo 1 do menu: seleciona todas as empresas e lê os extratos da competência.
function lerExtratosDoMes_2027(compForcada) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Simples Nacional");
  if (!sheet) { exibirAlerta("❌ Aba \"Simples Nacional\" não encontrada."); return null; }
  selecionarTodasAsLinhas_2027(sheet);
  const comp = (typeof compForcada === "string" && /^\d{2}\/\d{4}$/.test(compForcada)) ? compForcada : undefined;
  return extrairDadosExtrato_IBSCBS(comp, 0, comp ? true : false);
}

// Passo 3 do menu: relê só o que está marcado (não mexe na seleção).
function reprocessarMarcadas_2027(compForcada) {
  const comp = (typeof compForcada === "string" && /^\d{2}\/\d{4}$/.test(compForcada)) ? compForcada : undefined;
  return extrairDadosExtrato_IBSCBS(comp, 0, comp ? true : false);
}

function reiniciarAtualizarTudo_2027() {
  const props = PropertiesService.getDocumentProperties();
  props.deleteProperty(PROP_ATT_ETAPA_);
  props.deleteProperty(PROP_ATT_COMP_);
  exibirAlerta("🔄 Pronto. O próximo \"▶️ ATUALIZAR TUDO\" vai começar do passo 1 e perguntar a competência de novo.");
}

function atualizarTudo_2027() {
  const props = PropertiesService.getDocumentProperties();
  let etapa = Number(props.getProperty(PROP_ATT_ETAPA_) || 0);
  let comp  = String(props.getProperty(PROP_ATT_COMP_) || "");

  if (!etapa || !/^\d{2}\/\d{4}$/.test(comp)) {
    const compDados = obterDadosCompetencia_IBSCBS();
    if (!compDados) return;
    comp = compDados.inputOriginal;
    etapa = 1;
    props.setProperty(PROP_ATT_COMP_, comp);
    props.setProperty(PROP_ATT_ETAPA_, "1");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Simples Nacional");
  if (!sheet) { exibirAlerta("❌ Aba \"Simples Nacional\" não encontrada."); return; }

  const continuar = function (passo, feito, faltam) {
    exibirAlerta("▶️ ATUALIZAR TUDO — competência " + comp + "\n\n" +
      passo + "\n" + feito + " linha(s) nesta rodada, faltam " + faltam + ".\n\n" +
      "O Google interrompe o robô a cada poucos minutos. Clique em\n" +
      "⚙️ Automação 2027 > ▶️ ATUALIZAR TUDO de novo para continuar de onde parou.");
  };

  // --- PASSO 1: ler os extratos de todas as empresas
  if (etapa === 1) {
    selecionarTodasAsLinhas_2027(sheet);
    const r = extrairDadosExtrato_IBSCBS(comp, 0, true) || { processados: 0, restantes: 0 };
    if (r.restantes > 0) { continuar("Passo 1 de 4 — lendo os extratos.", r.processados, r.restantes); return; }
    etapa = 2; props.setProperty(PROP_ATT_ETAPA_, "2");
  }

  // --- PASSO 2: conferir e marcar as linhas com problema
  let marcadas = 0;
  if (etapa === 2) {
    const c = conferirLinhas_2027(true) || { marcadas: 0 };
    marcadas = c.marcadas;
    etapa = marcadas > 0 ? 3 : 4;
    props.setProperty(PROP_ATT_ETAPA_, String(etapa));
  }

  // --- PASSO 3: reler as linhas marcadas
  if (etapa === 3) {
    const r = extrairDadosExtrato_IBSCBS(comp, 0, true) || { processados: 0, restantes: 0 };
    if (r.restantes > 0) { continuar("Passo 3 de 4 — corrigindo as linhas marcadas.", r.processados, r.restantes); return; }
    etapa = 4; props.setProperty(PROP_ATT_ETAPA_, "4");
  }

  // --- PASSO 4: recalcular as fórmulas e encerrar
  restaurarFormulasCalculadas(true);
  props.deleteProperty(PROP_ATT_ETAPA_);
  props.deleteProperty(PROP_ATT_COMP_);
  exibirAlerta("🏁 Terminou! Competência " + comp + ".\n\n" +
    "• extratos lidos e alíquotas recalculadas;\n" +
    "• " + marcadas + " linha(s) tinham problema e foram corrigidas;\n" +
    "• fórmulas da aba atualizadas.\n\n" +
    "As linhas que continuarem em laranja no Status são as que o robô não\n" +
    "conseguiu resolver sozinho — normalmente extrato faltando na pasta.");
}