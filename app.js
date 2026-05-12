// app.js (sem imports)
const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
window.supabaseClient = supabaseClient;

let itens = [];
let orcamentoAtualId = null;

window.renderOrcamentos = async () => {
  const lista = document.getElementById('lista-orcamentos');
  lista.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400">Carregando...</td></tr>';

  const search = document.getElementById('search-quotes')?.value.toLowerCase() || '';
  const statusFiltro = document.getElementById('status-filter')?.value || '';

  let query = supabaseClient.from('mdf_orcamentos').select('*').order('created_at', { ascending: false });
  if (statusFiltro) query = query.eq('status', statusFiltro);

  const { data: orcamentos, error } = await query;
  if (error) {
    lista.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-red-400">Erro ao carregar.</td></tr>';
    return;
  }

  const filtrados = orcamentos.filter(o => !search || (o.cliente_nome && o.cliente_nome.toLowerCase().includes(search)));

  if (!filtrados.length) {
    lista.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400">Nenhum orçamento encontrado.</td></tr>';
    return;
  }

  const dados = await Promise.all(filtrados.map(async (orc) => {
    const { data: itensData } = await supabaseClient.from('mdf_itens').select('preco, desconto').eq('orcamento_id', orc.id);
    const total = itensData ? itensData.reduce((s, i) => s + parseFloat(i.preco) - parseFloat(i.desconto || 0), 0) : 0;
    return { ...orc, total, itensCount: itensData?.length || 0 };
  }));

  lista.innerHTML = dados.map(orc => {
    const statusClass = {
      'ABERTO': 'status-aberto',
      'EM NEGOCIAÇÃO': 'status-negociacao',
      'APROVADO': 'status-aprovado',
      'PERDIDO': 'status-perdido'
    }[orc.status] || 'status-aberto';

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-4"><div class="font-black text-slate-700">#${orc.id}</div><div class="text-xs text-slate-400">${new Date(orc.created_at).toLocaleDateString('pt-BR')}</div></td>
        <td class="p-4"><div class="font-bold text-slate-800">${orc.cliente_nome || 'Consumidor Final'}</div><div class="text-xs text-slate-500">${orc.itensCount} itens</div></td>
        <td class="p-4 font-bold text-slate-800">R$ ${orc.total.toFixed(2)}</td>
        <td class="p-4 text-center"><span class="status-badge ${statusClass}">${orc.status}</span></td>
        <td class="p-4">
          <div class="flex items-center justify-center gap-2">
            <button onclick="window.editarOrcamento(${orc.id})" class="p-2 border border-[#b8a94e] bg-white text-[#b8a94e] hover:bg-amber-50 rounded-lg shadow-sm" title="Editar"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
            <button onclick="window.duplicarOrcamento(${orc.id})" class="p-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg shadow-sm" title="Duplicar"><i data-lucide="copy" class="w-4 h-4"></i></button>
            <button onclick="window.baixarPDF(${orc.id})" class="p-2 border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 rounded-lg shadow-sm" title="Baixar PDF"><i data-lucide="download" class="w-4 h-4"></i></button>
            <button onclick="window.imprimirOrcamento(${orc.id})" class="p-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg shadow-sm" title="Imprimir"><i data-lucide="printer" class="w-4 h-4"></i></button>
            <button onclick="window.excluirOrcamento(${orc.id})" class="p-2 border border-red-200 bg-white text-red-500 hover:bg-red-50 rounded-lg shadow-sm" title="Excluir"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
};

window.abrirNovoOrcamento = async () => {
  orcamentoAtualId = null;
  document.getElementById('modal-titulo').innerText = 'Novo Orçamento';
  document.getElementById('orcamento-id').value = '';
  document.getElementById('cliente').value = '';
  document.getElementById('status').value = 'ABERTO';
  document.getElementById('observacoes').value = '';
  document.getElementById('tipo-desconto').value = '$';
  document.getElementById('valor-desconto').value = '0';
  itens = [];
  renderizarItens();
  atualizarTotais();
  await carregarClientesSelect();
  document.getElementById('modal-orcamento').classList.add('active');
  lucide.createIcons();
};

window.editarOrcamento = async (id) => {
  orcamentoAtualId = id;
  document.getElementById('modal-titulo').innerText = `Editar Orçamento #${id}`;

  const { data: orc } = await supabaseClient.from('mdf_orcamentos').select('*').eq('id', id).single();
  if (orc) {
    document.getElementById('status').value = orc.status || 'ABERTO';
    document.getElementById('observacoes').value = orc.observacoes || '';
    await carregarClientesSelect();
    if (orc.cliente_nome) {
      const { data: cliente } = await supabaseClient.from('mdf_clientes').select('id').eq('nome', orc.cliente_nome).maybeSingle();
      document.getElementById('cliente').value = cliente?.id || '';
    }
  }

  const { data: itensData } = await supabaseClient.from('mdf_itens').select('*').eq('orcamento_id', id);
  itens = itensData ? itensData.map(i => ({
    id: i.id,
    nome: i.nome,
    descricao: i.descricao || '',
    preco: parseFloat(i.preco),
    desconto: parseFloat(i.desconto || 0),
    foto_url: i.foto_url || '',
    foto_file: null,
    removido: false
  })) : [];

  const totalDesconto = itens.reduce((s, i) => s + i.desconto, 0);
  document.getElementById('tipo-desconto').value = '$';
  document.getElementById('valor-desconto').value = totalDesconto.toFixed(2);

  renderizarItens();
  atualizarTotais();
  document.getElementById('modal-orcamento').classList.add('active');
  lucide.createIcons();
};

window.fecharModal = () => {
  document.getElementById('modal-orcamento').classList.remove('active');
};

async function carregarClientesSelect() {
  const select = document.getElementById('cliente');
  const { data } = await supabaseClient.from('mdf_clientes').select('*');
  select.innerHTML = '<option value="">Selecione um cliente...</option>' +
    (data || []).map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
}

window.adicionarItem = (dados = {}) => {
  itens.push({
    id: null,
    nome: dados.nome || '',
    descricao: dados.descricao || '',
    preco: dados.preco || 0,
    desconto: dados.desconto || 0,
    foto_url: dados.foto_url || '',
    foto_file: null,
    removido: false
  });
  renderizarItens();
  atualizarTotais();
  lucide.createIcons();
};

window.removerItem = (index) => {
  if (itens[index].id) {
    itens[index].removido = true;
  } else {
    itens.splice(index, 1);
  }
  renderizarItens();
  atualizarTotais();
};

function renderizarItens() {
  const container = document.getElementById('container-itens');
  container.innerHTML = itens.filter(i => !i.removido).map((item, idx) => `
    <div class="flex flex-col md:flex-row gap-3 items-start border border-slate-200 rounded-xl p-3 bg-white">
      <div class="w-40 h-40 rounded-lg border bg-slate-100 flex items-center justify-center cursor-pointer overflow-hidden relative" onclick="this.querySelector('input[type=file]').click()">
        ${item.foto_url 
          ? `<img src="${item.foto_url}" class="w-full h-full object-cover" alt="Foto" style="position: absolute; inset: 0;">`
          : `<i data-lucide="camera" class="w-15 h-15 text-slate-400"></i>`
        }
        <input type="file" accept="image/*" class="hidden" onchange="window.uploadImagemItem(this, ${idx})">
      </div>
      <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 w-full">
        <input type="text" placeholder="Nome do móvel" value="${item.nome}" onchange="window.atualizarItem(${idx}, 'nome', this.value)" class="p-2 border rounded text-sm w-full">
        <input type="text" placeholder="Medidas / descrição" value="${item.descricao}" onchange="window.atualizarItem(${idx}, 'descricao', this.value)" class="p-2 border rounded text-sm w-full">
        <input type="number" placeholder="Preço R$" value="${item.preco}" onchange="window.atualizarItem(${idx}, 'preco', parseFloat(this.value) || 0)" class="p-2 border rounded text-sm w-full" step="0.01">
        <input type="number" placeholder="Desconto R$" value="${item.desconto}" onchange="window.atualizarItem(${idx}, 'desconto', parseFloat(this.value) || 0)" class="p-2 border rounded text-sm w-full" step="0.01">
      </div>
      <button onclick="window.removerItem(${idx})" class="text-red-400 hover:text-red-600 p-2"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
    </div>
  `).join('');
  lucide.createIcons();
}

window.atualizarItem = (index, campo, valor) => {
  itens[index][campo] = valor;
  atualizarTotais();
};

window.uploadImagemItem = async (input, index) => {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('image', file);
  try {
    const resp = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.IMGBB_KEY}`, {
      method: 'POST',
      body: formData
    });
    const data = await resp.json();
    if (data.success) {
      itens[index].foto_url = data.data.url;
      renderizarItens();
      lucide.createIcons();
    } else {
      alert('Erro ao enviar imagem.');
    }
  } catch (e) {
    alert('Erro de conexão ao enviar imagem.');
  }
};

window.atualizarTotais = () => {
  const subtotal = itens.filter(i => !i.removido).reduce((s, i) => s + i.preco, 0);
  const tipo = document.getElementById('tipo-desconto').value;
  const valor = parseFloat(document.getElementById('valor-desconto').value) || 0;
  const desconto = tipo === '%' ? subtotal * (valor / 100) : valor;
  const total = Math.max(0, subtotal - desconto);
  document.getElementById('subtotal').innerText = `R$ ${subtotal.toFixed(2)}`;
  document.getElementById('total-geral').innerText = `R$ ${total.toFixed(2)}`;
};

window.salvarOrcamento = async () => {
  const clienteNome = document.getElementById('cliente').selectedOptions[0]?.text || 'Consumidor Final';
  const status = document.getElementById('status').value;
  const obs = document.getElementById('observacoes').value.trim();

  if (orcamentoAtualId) {
    const { error: errOrc } = await supabaseClient.from('mdf_orcamentos').update({
      cliente_nome: clienteNome,
      status,
      observacoes: obs
    }).eq('id', orcamentoAtualId);
    if (errOrc) return alert('Erro ao atualizar orçamento: ' + errOrc.message);

    for (const item of itens.filter(i => i.removido && i.id)) {
      await supabaseClient.from('mdf_itens').delete().eq('id', item.id);
    }
    for (const item of itens.filter(i => !i.removido)) {
      const payload = {
        orcamento_id: orcamentoAtualId,
        nome: item.nome,
        descricao: item.descricao,
        preco: item.preco,
        desconto: item.desconto,
        foto_url: item.foto_url
      };
      if (item.id) {
        await supabaseClient.from('mdf_itens').update(payload).eq('id', item.id);
      } else {
        await supabaseClient.from('mdf_itens').insert(payload);
      }
    }
  } else {
    const { data: novo, error: errOrc } = await supabaseClient.from('mdf_orcamentos').insert({
      cliente_nome: clienteNome,
      status,
      observacoes: obs
    }).select().single();
    if (errOrc) return alert('Erro ao criar orçamento: ' + errOrc.message);

    const itensParaInserir = itens.filter(i => !i.removido).map(i => ({
      orcamento_id: novo.id,
      nome: i.nome,
      descricao: i.descricao,
      preco: i.preco,
      desconto: i.desconto,
      foto_url: i.foto_url
    }));
    if (itensParaInserir.length) {
      await supabaseClient.from('mdf_itens').insert(itensParaInserir);
    }
  }

  window.fecharModal();
  window.renderOrcamentos();
  alert('Orçamento salvo com sucesso!');
};

window.excluirOrcamento = async (id) => {
  if (!confirm('Excluir este orçamento?')) return;
  await supabaseClient.from('mdf_itens').delete().eq('orcamento_id', id);
  await supabaseClient.from('mdf_orcamentos').delete().eq('id', id);
  window.renderOrcamentos();
};

window.duplicarOrcamento = async (id) => {
  if (!confirm('Duplicar este orçamento?')) return;
  const { data: orc } = await supabaseClient.from('mdf_orcamentos').select().eq('id', id).single();
  if (!orc) return;
  const { data: itensData } = await supabaseClient.from('mdf_itens').select().eq('orcamento_id', id);

  const { data: novo } = await supabaseClient.from('mdf_orcamentos').insert({
    cliente_nome: orc.cliente_nome,
    status: 'ABERTO',
    observacoes: orc.observacoes
  }).select().single();

  if (novo && itensData) {
    const novosItens = itensData.map(i => ({
      orcamento_id: novo.id,
      nome: i.nome,
      descricao: i.descricao,
      preco: i.preco,
      desconto: i.desconto,
      foto_url: i.foto_url
    }));
    await supabaseClient.from('mdf_itens').insert(novosItens);
  }
  window.renderOrcamentos();
  alert('Orçamento duplicado!');
};

window.gerarPDF = async () => {
  const clienteNome = document.getElementById('cliente').selectedOptions[0]?.text || 'Consumidor Final';
  const obs = document.getElementById('observacoes').value;
  const itensAtivos = itens.filter(i => !i.removido);
  const subtotal = itensAtivos.reduce((s, i) => s + i.preco, 0);
  const tipo = document.getElementById('tipo-desconto').value;
  const valor = parseFloat(document.getElementById('valor-desconto').value) || 0;
  const desconto = tipo === '%' ? subtotal * (valor / 100) : valor;
  const total = Math.max(0, subtotal - desconto);

  const rowsHtml = itensAtivos.map((item, idx) => `
    <tr style="background: ${idx % 2 === 0 ? '#fff' : '#f9f9f9'};">
      <td style="padding: 12px;">
        ${item.foto_url ? `<img src="${item.foto_url}" style="width:100px; height:100px; object-fit:cover; border-radius:4px; vertical-align:middle;"> ` : ''}
        ${item.nome}
      </td>
      <td style="padding: 8px;">${item.descricao}</td>
      <td style="padding: 8px; text-align: right;">R$ ${item.preco.toFixed(2)}</td>
      <td style="padding: 8px; text-align: right;">R$ ${item.desconto.toFixed(2)}</td>
      <td style="padding: 8px; text-align: right; font-weight: bold;">R$ ${(item.preco - item.desconto).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: Helvetica; padding: 20px; max-width: 800px; margin: auto; background: white;">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="logo.png" style="height: 60px; display: block; margin: 0 auto;" onerror="this.style.display='none'">
        <h2 style="color: #b8a94e; margin-top: 5px;">RV PORTAL MADEIRAS</h2>
        <p style="font-size: 14px; color: #475569;">CNPJ: 30.942.123/0001-02 | Rua Mineiros, 532 - Jataí/GO</p>
        <h3 style="margin-top: 20px;">ORÇAMENTO</h3>
      </div>
      <div style="margin-bottom: 20px;">
        <p><strong>Cliente:</strong> ${clienteNome}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
        ${obs ? `<p><strong>Observações:</strong> ${obs}</p>` : ''}
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #1e293b; color: white;">
            <th style="padding: 8px; text-align: left;">Item</th>
            <th style="padding: 8px; text-align: left;">Descrição</th>
            <th style="padding: 8px; text-align: right;">Preço</th>
            <th style="padding: 8px; text-align: right;">Desc.</th>
            <th style="padding: 8px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div style="text-align: right; font-size: 18px; font-weight: bold; border-top: 2px solid #1e293b; padding-top: 10px;">
        Total: R$ ${total.toFixed(2)}
      </div>
      <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #64748b;">
        RV Portal Madeiras - Obrigado pela preferência!
      </div>
    </div>
  `;

  const opt = {
    margin: 10,
    filename: `orcamento_${clienteNome.replace(/\s+/g, '_')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  const area = document.getElementById('print-area');
  area.innerHTML = html;
  await html2pdf().set(opt).from(html).save();
};

window.baixarPDF = async (id) => {
  const { data: orc } = await supabaseClient.from('mdf_orcamentos').select().eq('id', id).single();
  if (!orc) return;
  const { data: itensData } = await supabaseClient.from('mdf_itens').select().eq('orcamento_id', id);
  const itens = itensData || [];

  const rowsHtml = itens.map((item, idx) => `
    <tr style="background: ${idx % 2 === 0 ? '#fff' : '#f9f9f9'};">
      <td style="padding: 8px;">${item.foto_url ? `<img src="${item.foto_url}" style="width:40px; height:40px; border-radius:4px; vertical-align:middle;"> ` : ''}${item.nome}</td>
      <td style="padding: 8px;">${item.descricao || ''}</td>
      <td style="padding: 8px; text-align: right;">R$ ${parseFloat(item.preco).toFixed(2)}</td>
      <td style="padding: 8px; text-align: right;">R$ ${parseFloat(item.desconto || 0).toFixed(2)}</td>
      <td style="padding: 8px; text-align: right; font-weight: bold;">R$ ${(parseFloat(item.preco) - parseFloat(item.desconto || 0)).toFixed(2)}</td>
    </tr>
  `).join('');

  const total = itens.reduce((s, i) => s + parseFloat(i.preco) - parseFloat(i.desconto || 0), 0);
  const html = `
    <div style="font-family: Helvetica; padding: 20px; max-width: 800px; margin: auto; background: white;">
      <div style="text-align: center;">
        <img src="logo.png" style="height: 60px;" onerror="this.style.display='none'">
        <h2 style="color: #b8a94e;">RV PORTAL MADEIRAS</h2>
        <p style="font-size: 14px;">CNPJ: 30.942.123/0001-02 | Rua Mineiros, 532 - Jataí/GO</p>
        <h3>ORÇAMENTO #${orc.id}</h3>
      </div>
      <p><strong>Cliente:</strong> ${orc.cliente_nome}</p>
      <p><strong>Data:</strong> ${new Date(orc.created_at).toLocaleDateString('pt-BR')}</p>
      ${orc.observacoes ? `<p><strong>Obs:</strong> ${orc.observacoes}</p>` : ''}
      <table style="width:100%; border-collapse: collapse; margin-top:15px;">
        <thead><tr style="background:#1e293b; color:white;"><th>Item</th><th>Desc.</th><th>Preço</th><th>Desc.</th><th>Total</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div style="text-align:right; margin-top:15px; font-size:18px; font-weight:bold;">Total: R$ ${total.toFixed(2)}</div>
    </div>
  `;

  const opt = {
    margin: 10,
    filename: `orcamento_${orc.cliente_nome}_#${id}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  document.getElementById('print-area').innerHTML = html;
  await html2pdf().set(opt).from(html).save();
};

window.imprimirOrcamento = (id) => {
  window.baixarPDF(id);
};
