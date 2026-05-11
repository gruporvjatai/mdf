// Inicializa cliente Supabase
const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// Armazena a logo em base64 (carregada automaticamente)
let logoBase64 = '';

// Carregar a logo ao iniciar
(async function carregarLogo() {
  try {
    const resp = await fetch('logo.png');
    const blob = await resp.blob();
    const reader = new FileReader();
    reader.onloadend = () => {
      logoBase64 = reader.result;
    };
    reader.readAsDataURL(blob);
  } catch (e) {
    console.warn('Logo não encontrada, será usado texto no PDF.');
  }
})();

// Estado do modal
let itens = []; // cada item: { nome, descricao, preco, desconto, fotoBase64, fotoFile }
let itemIdCounter = 0;

// Elementos do DOM
const modalOverlay = document.getElementById('modal-novo');
const btnNovo = document.getElementById('btn-novo');
const btnFechar = document.getElementById('btn-fechar-modal');
const btnCancelar = document.getElementById('btn-cancelar');
const btnAddItem = document.getElementById('btn-add-item');
const listaItens = document.getElementById('lista-itens');
const btnGerarPdf = document.getElementById('btn-gerar-pdf');
const listaOrcamentos = document.getElementById('lista-orcamentos');

// --- Funções de Modal ---
function abrirModal() {
  modalOverlay.classList.add('active');
  limparFormulario();
}

function fecharModal() {
  modalOverlay.classList.remove('active');
  limparFormulario();
}

function limparFormulario() {
  document.getElementById('nome').value = '';
  document.getElementById('telefone').value = '';
  document.getElementById('email').value = '';
  document.getElementById('obs').value = '';
  listaItens.innerHTML = '';
  itens = [];
  itemIdCounter = 0;
  recalcular();
}

// --- Eventos Modal ---
btnNovo.addEventListener('click', abrirModal);
btnFechar.addEventListener('click', fecharModal);
btnCancelar.addEventListener('click', fecharModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) fecharModal();
});

// --- Adicionar Item ---
btnAddItem.addEventListener('click', () => {
  adicionarItem();
});

function adicionarItem(dados = {}) {
  const id = ++itemIdCounter;
  const item = {
    id,
    nome: dados.nome || '',
    descricao: dados.descricao || '',
    preco: dados.preco || 0,
    desconto: dados.desconto || 0,
    fotoBase64: dados.fotoBase64 || '',
    fotoFile: dados.fotoFile || null
  };
  itens.push(item);
  renderizarItem(item);
  recalcular();
}

function renderizarItem(item) {
  const div = document.createElement('div');
  div.className = 'item';
  div.dataset.id = item.id;
  div.innerHTML = `
    <div class="item-header">
      <span class="item-num">Item #${item.id}</span>
      <button class="btn btn-sm btn-danger btn-remover" data-id="${item.id}">Remover</button>
    </div>
    <div class="item-grid">
      <div>
        <img class="item-foto" src="${item.fotoBase64 || ''}" alt="Foto" style="${item.fotoBase64 ? '' : 'display:none;'}">
        <div class="item-foto-placeholder" data-id="${item.id}" style="${item.fotoBase64 ? 'display:none;' : ''}">
          📷<br>Adicionar<br>foto
        </div>
        <input type="file" accept="image/*" style="display:none;" data-id="${item.id}">
      </div>
      <div class="item-campos">
        <input type="text" class="item-nome" placeholder="Nome do móvel" value="${item.nome}">
        <input type="text" class="item-descricao" placeholder="Medidas / descrição" value="${item.descricao}">
        <div class="item-preco-desconto">
          <input type="number" class="item-preco" placeholder="Preço R$" step="0.01" min="0" value="${item.preco || ''}">
          <input type="number" class="item-desconto" placeholder="Desconto R$" step="0.01" min="0" value="${item.desconto || ''}">
        </div>
      </div>
    </div>
  `;

  // Eventos
  const placeholder = div.querySelector('.item-foto-placeholder');
  const fileInput = div.querySelector('input[type="file"]');
  const img = div.querySelector('.item-foto');

  placeholder?.addEventListener('click', () => fileInput.click());
  img?.addEventListener('click', () => fileInput.click()); // clicar na foto também troca
  fileInput.addEventListener('change', (e) => handleFileSelect(e, item.id));

  const btnRemover = div.querySelector('.btn-remover');
  btnRemover.addEventListener('click', () => {
    removerItem(item.id);
  });

  // Atualiza valores nos inputs com event listeners
  const inputs = div.querySelectorAll('input[type="text"], input[type="number"]');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      atualizarItemDoDOM(item.id);
      recalcular();
    });
  });

  listaItens.appendChild(div);
}

function handleFileSelect(event, itemId) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const item = itens.find(i => i.id == itemId);
    if (item) {
      item.fotoBase64 = e.target.result;
      item.fotoFile = file;
      // Atualiza visual
      const itemDiv = document.querySelector(`.item[data-id="${itemId}"]`);
      if (itemDiv) {
        const img = itemDiv.querySelector('.item-foto');
        const placeholder = itemDiv.querySelector('.item-foto-placeholder');
        if (img) {
          img.src = item.fotoBase64;
          img.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
      }
    }
  };
  reader.readAsDataURL(file);
}

function removerItem(id) {
  itens = itens.filter(i => i.id != id);
  const itemDiv = document.querySelector(`.item[data-id="${id}"]`);
  if (itemDiv) itemDiv.remove();
  recalcular();
}

function atualizarItemDoDOM(itemId) {
  const itemDiv = document.querySelector(`.item[data-id="${itemId}"]`);
  if (!itemDiv) return;
  const item = itens.find(i => i.id == itemId);
  if (!item) return;

  item.nome = itemDiv.querySelector('.item-nome')?.value || '';
  item.descricao = itemDiv.querySelector('.item-descricao')?.value || '';
  item.preco = parseFloat(itemDiv.querySelector('.item-preco')?.value) || 0;
  item.desconto = parseFloat(itemDiv.querySelector('.item-desconto')?.value) || 0;
}

function recalcular() {
  let subtotal = 0, totalDescontos = 0;
  itens.forEach(item => {
    subtotal += item.preco || 0;
    totalDescontos += item.desconto || 0;
  });
  const total = subtotal - totalDescontos;
  document.getElementById('subtotal').textContent = `R$ ${subtotal.toFixed(2)}`;
  document.getElementById('total-descontos').textContent = `R$ ${totalDescontos.toFixed(2)}`;
  document.getElementById('total-geral').textContent = `R$ ${total.toFixed(2)}`;
}

// --- Upload ImgBB ---
async function uploadImagem(arquivo) {
  const formData = new FormData();
  formData.append('image', arquivo);
  const resp = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.IMGBB_KEY}`, {
    method: 'POST',
    body: formData
  });
  const data = await resp.json();
  return data.success ? data.data.url : null;
}

// --- Gerar PDF profissional ---
async function gerarPDF(dadosCliente, itensPDF) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Cabeçalho
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 14, y, 30, 15);
  } else {
    doc.setFontSize(16);
    doc.setTextColor(44, 62, 80);
    doc.text('RV Portal Madeiras', 14, y + 5);
  }
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text('Orçamento de Móveis Planejados', pageWidth - 14, y + 5, { align: 'right' });
  y += 18;

  // Linha separadora
  doc.setDrawColor(200);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  // Dados do cliente
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`Cliente: ${dadosCliente.nome}`, 14, y);
  y += 5;
  if (dadosCliente.telefone) {
    doc.text(`Telefone: ${dadosCliente.telefone}`, 14, y);
    y += 5;
  }
  if (dadosCliente.email) {
    doc.text(`E-mail: ${dadosCliente.email}`, 14, y);
    y += 5;
  }
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, y);
  y += 8;

  // Tabela de itens
  doc.setFontSize(9);
  doc.setTextColor(80);
  // Cabeçalho da tabela
  const colunas = { foto: 14, nome: 35, descricao: 80, preco: 110, desconto: 130, total: 150 };
  const linhaY = y;
  doc.setFillColor(240, 240, 240);
  doc.rect(14, y, pageWidth - 28, 6, 'F');
  doc.text('Foto', colunas.foto, y + 4);
  doc.text('Item', colunas.nome, y + 4);
  doc.text('Descrição', colunas.descricao, y + 4);
  doc.text('Preço', colunas.preco, y + 4);
  doc.text('Desc.', colunas.desconto, y + 4);
  doc.text('Total', colunas.total, y + 4);
  y += 8;

  for (let i = 0; i < itensPDF.length; i++) {
    const item = itensPDF[i];
    const preco = parseFloat(item.preco) || 0;
    const desconto = parseFloat(item.desconto) || 0;
    const totalItem = preco - desconto;

    // Verifica espaço na página
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    // Foto (se existir base64)
    if (item.fotoBase64) {
      try {
        doc.addImage(item.fotoBase64, 'JPEG', 14, y - 4, 12, 12);
      } catch (e) { /* ignora */ }
    }

    doc.text(item.nome || '', colunas.nome, y);
    doc.text(item.descricao || '', colunas.descricao, y);
    doc.text(`R$ ${preco.toFixed(2)}`, colunas.preco, y);
    doc.text(`R$ ${desconto.toFixed(2)}`, colunas.desconto, y);
    doc.text(`R$ ${totalItem.toFixed(2)}`, colunas.total, y);
    y += 8;
  }

  // Total geral
  y += 4;
  doc.setDrawColor(150);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;
  const totalGeral = itensPDF.reduce((s, i) => s + (parseFloat(i.preco)||0) - (parseFloat(i.desconto)||0), 0);
  doc.setFontSize(12);
  doc.setTextColor(13, 110, 253);
  doc.text(`Total Geral: R$ ${totalGeral.toFixed(2)}`, pageWidth - 14, y, { align: 'right' });

  // Observações
  if (dadosCliente.observacoes) {
    y += 12;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Observações:', 14, y);
    y += 5;
    doc.text(dadosCliente.observacoes, 14, y, { maxWidth: pageWidth - 28 });
  }

  return doc;
}

// --- Evento Gerar PDF e Salvar ---
btnGerarPdf.addEventListener('click', async () => {
  const nome = document.getElementById('nome').value.trim();
  if (!nome) { alert('Preencha o nome do cliente.'); return; }
  if (itens.length === 0 || itens.every(i => !i.nome || i.preco <= 0)) {
    alert('Adicione ao menos um item com nome e preço.');
    return;
  }

  btnGerarPdf.disabled = true;
  btnGerarPdf.textContent = 'Salvando e gerando PDF...';

  // Upload das imagens para ImgBB (em paralelo)
  const uploadPromises = itens.map(async (item) => {
    if (item.fotoFile && !item.fotoUrl) {
      const url = await uploadImagem(item.fotoFile);
      item.fotoUrl = url || '';
    }
    return item;
  });
  const itensProcessados = await Promise.all(uploadPromises);

  // Insere orçamento no Supabase
  const dadosCliente = {
    cliente_nome: nome,
    cliente_telefone: document.getElementById('telefone').value,
    cliente_email: document.getElementById('email').value,
    observacoes: document.getElementById('obs').value
  };

  const { data: orcamento, error: errOrc } = await supabaseClient
    .from('mdf_orcamentos')
    .insert(dadosCliente)
    .select()
    .single();

  if (errOrc) {
    alert('Erro ao salvar orçamento: ' + errOrc.message);
    btnGerarPdf.disabled = false;
    btnGerarPdf.textContent = 'Gerar Orçamento e PDF';
    return;
  }

  // Insere itens
  const itensParaInserir = itensProcessados.map(item => ({
    orcamento_id: orcamento.id,
    nome: item.nome,
    descricao: item.descricao,
    preco: item.preco,
    desconto: item.desconto,
    foto_url: item.fotoUrl || ''
  }));

  const { error: errItens } = await supabaseClient
    .from('mdf_itens')
    .insert(itensParaInserir);

  if (errItens) {
    alert('Orçamento salvo, mas erro ao salvar itens: ' + errItens.message);
  }

  // Gera PDF (com as base64 ainda disponíveis)
  const dadosParaPDF = {
    nome,
    telefone: document.getElementById('telefone').value,
    email: document.getElementById('email').value,
    observacoes: document.getElementById('obs').value
  };

  const doc = await gerarPDF(dadosParaPDF, itensProcessados);
  doc.save(`orcamento_${nome.replace(/\s+/g, '_')}.pdf`);

  btnGerarPdf.disabled = false;
  btnGerarPdf.textContent = 'Gerar Orçamento e PDF';
  fecharModal();
  carregarOrcamentos(); // atualiza lista
});

// --- Carregar lista de orçamentos ---
async function carregarOrcamentos() {
  const { data, error } = await supabaseClient
    .from('mdf_orcamentos')
    .select('*, mdf_itens(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar orçamentos:', error);
    return;
  }

  if (!data || data.length === 0) {
    listaOrcamentos.innerHTML = `<div class="empty-state"><p>Nenhum orçamento encontrado.</p><p>Crie o primeiro clicando no botão acima.</p></div>`;
    return;
  }

  listaOrcamentos.innerHTML = data.map(orc => {
    const itens = orc.mdf_itens || [];
    const total = itens.reduce((s, i) => s + parseFloat(i.preco) - parseFloat(i.desconto), 0);
    const dataFormatada = new Date(orc.created_at).toLocaleDateString('pt-BR');
    const statusClass = orc.status || 'pendente';

    return `
      <div class="orcamento-card" data-id="${orc.id}">
        <div class="card-header">
          <h3>${orc.cliente_nome}</h3>
          <span class="status ${statusClass}">${orc.status}</span>
        </div>
        <div class="card-body">
          <p><strong>Data:</strong> ${dataFormatada}</p>
          <p><strong>Itens:</strong> ${itens.length}</p>
          <p><strong>Total:</strong> R$ ${total.toFixed(2)}</p>
        </div>
        <div class="card-footer">
          <button class="btn btn-sm btn-outline btn-export-pdf" data-id="${orc.id}">Exportar PDF</button>
        </div>
      </div>
    `;
  }).join('');

  // Adiciona eventos aos botões de exportar PDF
  document.querySelectorAll('.btn-export-pdf').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      await exportarPDFExistente(id);
    });
  });
}

// --- Exportar PDF de um orçamento já salvo ---
async function exportarPDFExistente(orcamentoId) {
  // Busca o orçamento com itens
  const { data, error } = await supabaseClient
    .from('mdf_orcamentos')
    .select('*, mdf_itens(*)')
    .eq('id', orcamentoId)
    .single();

  if (error || !data) {
    alert('Orçamento não encontrado.');
    return;
  }

  const orc = data;
  const itens = orc.mdf_itens || [];

  // Precisamos das fotos em base64. Vamos carregá-las a partir das URLs.
  const itensComFoto = await Promise.all(itens.map(async (item) => {
    let fotoBase64 = '';
    if (item.foto_url) {
      try {
        const resp = await fetch(item.foto_url);
        const blob = await resp.blob();
        fotoBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.warn('Não foi possível carregar a imagem:', item.foto_url);
      }
    }
    return {
      nome: item.nome,
      descricao: item.descricao,
      preco: item.preco,
      desconto: item.desconto,
      fotoBase64: fotoBase64
    };
  }));

  const dadosCliente = {
    nome: orc.cliente_nome,
    telefone: orc.cliente_telefone,
    email: orc.cliente_email,
    observacoes: orc.observacoes
  };

  const doc = await gerarPDF(dadosCliente, itensComFoto);
  doc.save(`orcamento_${orc.cliente_nome.replace(/\s+/g, '_')}.pdf`);
}

// Carrega lista ao iniciar
carregarOrcamentos();