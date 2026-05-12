// projetos.js – Editor 2D + 3D + Detalhamento + Envio resumido ao orçamento
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ==================== CLASSE PRINCIPAL DE PROJETOS ====================
class ProjetosManager {
  constructor(container) {
    this.container = container;
    this.profundidade = 60;
    this.linhas = [];
    this.preenchimentos = [];
    this.init();
  }

  init() {
    this.renderizarInterface();
    this.mostrarSubAba('fachada');
  }

  renderizarInterface() {
    this.container.innerHTML = `
      <div class="flex flex-col h-full">
        <div class="flex gap-2 mb-4 bg-white p-2 rounded-xl shadow-sm border items-center">
          <button data-subaba="fachada" class="subaba-btn px-4 py-2 rounded-lg font-bold text-sm bg-[#b8a94e] text-white shadow">📐 Fachada 2D</button>
          <button data-subaba="3d" class="subaba-btn px-4 py-2 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-100">🧊 3D</button>
          <button data-subaba="detalhamento" class="subaba-btn px-4 py-2 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-100">📋 Detalhamento</button>
          <div class="flex-1"></div>
          <div class="flex items-center gap-2">
            <label class="text-xs font-bold text-slate-600">Profundidade (cm):</label>
            <input type="number" id="profundidade-input" value="60" min="30" max="80" class="w-16 p-1 border rounded text-xs" onchange="window.profundidadeProjeto = parseFloat(this.value)">
            <button onclick="window.open('https://flatma.com/pt/create/designer', '_blank')" title="Abrir Flatma em nova aba" class="px-3 py-1 border border-[#b8a94e] text-[#b8a94e] rounded text-xs font-bold hover:bg-amber-50 transition">
              📐 Flatma
            </button>
          </div>
        </div>
        <div id="subaba-fachada" class="subaba-content flex-1"></div>
        <div id="subaba-3d" class="subaba-content flex-1 hidden"></div>
        <div id="subaba-detalhamento" class="subaba-content flex-1 hidden"></div>
      </div>
    `;

    this.container.querySelectorAll('.subaba-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.mostrarSubAba(e.target.dataset.subaba));
    });
    window.profundidadeProjeto = this.profundidade;
  }

  mostrarSubAba(nome) {
    this.container.querySelectorAll('.subaba-btn').forEach(btn => {
      btn.classList.remove('bg-[#b8a94e]', 'text-white', 'shadow');
      btn.classList.add('text-slate-600', 'hover:bg-slate-100');
    });
    const btnAtivo = this.container.querySelector(`[data-subaba="${nome}"]`);
    if (btnAtivo) {
      btnAtivo.classList.add('bg-[#b8a94e]', 'text-white', 'shadow');
      btnAtivo.classList.remove('text-slate-600', 'hover:bg-slate-100');
    }

    this.container.querySelectorAll('.subaba-content').forEach(el => el.classList.add('hidden'));
    const area = document.getElementById(`subaba-${nome}`);
    if (area) area.classList.remove('hidden');

    if (nome === 'fachada' && !this._fachadaIniciada) {
      this._fachadaIniciada = true;
      this.editor2D = new EditorFachada2D(area, this);
    }
    if (nome === '3d' && !this._3dIniciado) {
      this._3dIniciado = true;
      this.configurador3D = new ConfiguradorArmario(area, this);
    } else if (nome === '3d' && this.configurador3D) {
      this.configurador3D.reconstruirModelo();
    }
    if (nome === 'detalhamento') {
      this.atualizarDetalhamento();
    }
  }

  obterDimensoesGerais() {
    if (this.linhas.length > 0) {
      const xs = this.linhas.flatMap(l => [l.x1, l.x2]);
      const ys = this.linhas.flatMap(l => [l.y1, l.y2]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        largura: (maxX - minX) || 80,
        altura: (maxY - minY) || 220,
        offsetX: minX,
        offsetY: minY
      };
    }
    return null;
  }

  obterResumoProjeto() {
    const dims = this.obterDimensoesGerais();
    if (!dims) return null;
    const { largura, altura } = dims;
    const profundidade = this.profundidade;
    let numPortas = 0, numGavetas = 0;
    this.preenchimentos.forEach(p => {
      if (p.tipo === 'porta') numPortas += (p.subdivisoes || 1);
      else if (p.tipo === 'gaveta') numGavetas += (p.subdivisoes || 1);
    });
    const cor = "Branco";
    return {
      descricao: `Armário ${largura.toFixed(0)}x${altura.toFixed(0)}x${profundidade}cm, ${numPortas} porta(s) + ${numGavetas} gaveta(s), ${cor}`,
      largura, altura, profundidade, numPortas, numGavetas, cor
    };
  }

  gerarListaPecas() {
    const pecas = [];
    const d = 1.8;
    const dims = this.obterDimensoesGerais();
    if (!dims) return pecas;
    const { largura, altura, offsetX, offsetY } = dims;
    const profundidade = this.profundidade;

    pecas.push({ nome: 'Lateral Esquerda', qtd: 1, dim: `${d} x ${altura} x ${profundidade}` });
    pecas.push({ nome: 'Lateral Direita', qtd: 1, dim: `${d} x ${altura} x ${profundidade}` });
    pecas.push({ nome: 'Fundo', qtd: 1, dim: `${largura - 2*d} x ${d} x ${profundidade}` });
    pecas.push({ nome: 'Teto', qtd: 1, dim: `${largura} x ${d} x ${profundidade}` });

    this.linhas.forEach(linha => {
      const y = linha.y1;
      if (Math.abs(linha.y1 - linha.y2) < 0.1 && y > offsetY + 5 && y < offsetY + altura - 5) {
        pecas.push({ nome: `Prateleira Fixa (y=${y.toFixed(0)})`, qtd: 1, dim: `${largura - 2*d} x ${d} x ${profundidade - 2*d}` });
      } else if (Math.abs(linha.x1 - linha.x2) < 0.1) {
        const x = linha.x1;
        if (x > offsetX + 5 && x < offsetX + largura - 5) {
          pecas.push({ nome: `Divisória Vertical (x=${x.toFixed(0)})`, qtd: 1, dim: `${d} x ${altura} x ${profundidade - 2*d}` });
        }
      }
    });

    this.preenchimentos.forEach(p => {
      const sub = p.subdivisoes || 1;
      const subW = p.w / sub;
      if (p.tipo === 'porta') {
        pecas.push({ nome: `Porta (${p.w.toFixed(0)}x${p.h.toFixed(0)})`, qtd: sub, dim: `${subW.toFixed(0)} x ${p.h.toFixed(0)} x 1.2` });
      } else if (p.tipo === 'gaveta') {
        pecas.push({ nome: `Frente Gaveta (${subW.toFixed(0)}x${p.h.toFixed(0)})`, qtd: sub, dim: `${subW.toFixed(0)} x ${p.h.toFixed(0)} x 1.2` });
        pecas.push({ nome: `Lateral Gaveta (${subW.toFixed(0)}x${profundidade - 2*d - 2})`, qtd: sub * 2, dim: `${d} x ${p.h.toFixed(0)} x ${profundidade - 2*d - 2}` });
        pecas.push({ nome: `Fundo Gaveta (${subW.toFixed(0)}x${profundidade - 2*d - 2})`, qtd: sub, dim: `${subW.toFixed(0)} x ${d} x ${profundidade - 2*d - 2}` });
      } else if (p.tipo === 'fundo') {
        pecas.push({ nome: `Painel de Fundo (${p.w.toFixed(0)}x${p.h.toFixed(0)})`, qtd: 1, dim: `${p.w.toFixed(0)} x ${p.h.toFixed(0)} x ${d}` });
      }
    });

    return pecas;
  }

  atualizarDetalhamento() {
    const area = document.getElementById('subaba-detalhamento');
    if (!area) return;
    const pecas = this.gerarListaPecas();
    area.innerHTML = `
      <div class="bg-white rounded-xl shadow border p-4 flex flex-col h-full">
        <h3 class="font-bold text-lg mb-3">Detalhamento do Projeto</h3>
        <div class="flex-1 overflow-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-100"><tr><th class="p-2 text-left">Peça</th><th class="p-2 text-center">Qtd</th><th class="p-2 text-right">Dimensões (cm)</th></tr></thead>
            <tbody>${pecas.map(p => `<tr class="border-b"><td class="p-2">${p.nome}</td><td class="p-2 text-center">${p.qtd}</td><td class="p-2 text-right">${p.dim}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="mt-4 flex gap-2 justify-end">
          <button id="btn-imprimir-detalhamento" class="btn-outline px-4 py-2 rounded-lg font-bold">🖨️ Imprimir Detalhamento</button>
          <button id="btn-enviar-resumo" class="btn-primary px-6 py-2 rounded-lg font-bold shadow">📤 Enviar para Orçamento (Resumo)</button>
        </div>
      </div>`;

    document.getElementById('btn-imprimir-detalhamento').addEventListener('click', () => {
      this.imprimirDetalhamento(pecas);
    });

    document.getElementById('btn-enviar-resumo').addEventListener('click', () => {
      this.enviarResumoParaOrcamento();
    });
  }

  imprimirDetalhamento(pecas) {
    const html = `
      <div style="font-family: Helvetica; padding: 20px; max-width: 800px; margin: auto; background: white;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2>RV PORTAL MADEIRAS</h2>
          <h3>Detalhamento do Projeto</h3>
        </div>
        <table style="width:100%; border-collapse: collapse; font-size: 12px;">
          <thead><tr style="background:#eee;"><th style="padding:6px; text-align:left;">Peça</th><th style="padding:6px; text-align:center;">Qtd</th><th style="padding:6px; text-align:right;">Dimensões</th></tr></thead>
          <tbody>${pecas.map(p => `<tr><td style="padding:6px;">${p.nome}</td><td style="text-align:center;">${p.qtd}</td><td style="text-align:right;">${p.dim}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    `;
    const w = window.open('', '', 'width=800,height=600');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  }

  async enviarResumoParaOrcamento() {
    const resumo = this.obterResumoProjeto();
    if (!resumo) {
      alert("Desenhe o projeto primeiro.");
      return;
    }

    let fotoUrl = '';
    if (this.configurador3D && this.configurador3D.renderer) {
      try {
        const canvas = this.configurador3D.renderer.domElement;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const formData = new FormData();
          formData.append('image', blob, 'captura.png');
          const resp = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.IMGBB_KEY}`, {
            method: 'POST',
            body: formData
          });
          const data = await resp.json();
          if (data.success) {
            fotoUrl = data.data.url;
          }
        }
      } catch (e) {
        console.warn("Erro ao capturar/upload da imagem 3D:", e);
      }
    }

    this.modalSelecaoOrcamento(resumo, fotoUrl);
  }

  // ─── MODAL DE SELEÇÃO: NOVO OU EXISTENTE ─────────────────────
  modalSelecaoOrcamento(resumo, fotoUrl) {
    const self = this;

    const oldModal = document.getElementById('modal-selecao-orcamento');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modal-selecao-orcamento';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999;';

    overlay.innerHTML = `
      <div style="background:white; border-radius:16px; box-shadow:0 20px 40px rgba(0,0,0,0.2); max-width:400px; width:90%; padding:20px; position:relative;">
        <button style="position:absolute; top:10px; right:15px; background:none; border:none; font-size:1.5rem; cursor:pointer; color:#64748b;" 
                onclick="document.getElementById('modal-selecao-orcamento').remove()">&times;</button>
        <h3 style="font-size:1.2rem; font-weight:700; margin-bottom:15px;">Enviar para Orçamento</h3>
        <p style="margin-bottom:20px;">Deseja criar um <strong>novo orçamento</strong> ou adicionar a um <strong>existente</strong>?</p>
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button id="btn-novo-orcamento" style="padding:10px 20px; background:#b8a94e; color:#1e293b; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Novo Orçamento</button>
          <button id="btn-orcamento-existente" style="padding:10px 20px; background:transparent; border:1.5px solid #b8a94e; color:#b8a94e; border-radius:8px; font-weight:bold; cursor:pointer;">Adicionar a Existente</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('btn-novo-orcamento').addEventListener('click', () => {
      overlay.remove();
      self.criarNovoOrcamento(resumo, fotoUrl);
    });

    document.getElementById('btn-orcamento-existente').addEventListener('click', () => {
      overlay.remove();
      self.selecionarOrcamentoExistente(resumo, fotoUrl);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // ─── CRIA UM NOVO ORÇAMENTO E ADICIONA O ITEM ─────────────────
  criarNovoOrcamento(resumo, fotoUrl) {
    if (typeof window.abrirNovoOrcamento !== 'function') {
      alert("Módulo de orçamento não disponível.");
      return;
    }
    window.abrirNovoOrcamento();
    setTimeout(() => {
      if (typeof window.adicionarItem === 'function') {
        window.adicionarItem({
          nome: resumo.descricao,
          descricao: `Projeto gerado automaticamente.`,
          preco: 0,
          desconto: 0,
          foto_url: fotoUrl
        });
      }
    }, 600);
    if (typeof navigate === 'function') {
      navigate('orcamentos');
    }
  }

  // ─── BUSCA ORÇAMENTOS EXISTENTES E ABRE LISTA ────────────────
  async selecionarOrcamentoExistente(resumo, fotoUrl) {
    if (typeof window.supabaseClient === 'undefined') {
      alert("Conexão com o banco de dados indisponível. Recarregue a página.");
      return;
    }

    try {
      const { data: orcamentos, error } = await window.supabaseClient
        .from('mdf_orcamentos')
        .select('id, cliente_nome, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error("Erro ao buscar orçamentos:", error);
        alert("Falha ao carregar orçamentos.");
        return;
      }

      if (!orcamentos || orcamentos.length === 0) {
        alert("Nenhum orçamento encontrado. Crie um novo primeiro.");
        return;
      }

      this.modalListaOrcamentos(resumo, fotoUrl, orcamentos);
    } catch (err) {
      console.error("Erro inesperado:", err);
      alert("Ocorreu um erro. Consulte o console.");
    }
  }

  // ─── MODAL COM LISTA DE ORÇAMENTOS ────────────────────────────
  modalListaOrcamentos(resumo, fotoUrl, orcamentos) {
    const self = this;
    const oldModal = document.getElementById('modal-lista-orcamentos');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modal-lista-orcamentos';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999;';

    overlay.innerHTML = `
      <div style="background:white; border-radius:16px; box-shadow:0 20px 40px rgba(0,0,0,0.2); max-width:500px; width:90%; padding:20px; position:relative;">
        <button style="position:absolute; top:10px; right:15px; background:none; border:none; font-size:1.5rem; cursor:pointer; color:#64748b;" 
                onclick="document.getElementById('modal-lista-orcamentos').remove()">&times;</button>
        <h3 style="font-size:1.2rem; font-weight:700; margin-bottom:15px;">Selecione o Orçamento</h3>
        <p style="font-size:0.9rem; margin-bottom:15px;">Escolha um orçamento existente para adicionar o item:</p>
        <div style="max-height:300px; overflow-y:auto;">
          ${orcamentos.map(o => `
            <div class="orcamento-item" data-id="${o.id}" style="padding:12px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:6px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; background:white; transition:background 0.2s;">
              <div>
                <span style="font-weight:600;">#${o.id} - ${o.cliente_nome || 'Sem nome'}</span><br>
                <span style="font-size:0.8rem; color:#64748b;">${new Date(o.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              <i data-lucide="plus-circle" style="color:#b8a94e;"></i>
            </div>
          `).join('')}
        </div>
        <div style="margin-top:15px; text-align:right;">
          <button style="padding:8px 16px; border:1.5px solid #b8a94e; color:#b8a94e; background:transparent; border-radius:8px; font-weight:bold; cursor:pointer;" 
                  onclick="document.getElementById('modal-lista-orcamentos').remove()">Cancelar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    lucide.createIcons();

    overlay.querySelectorAll('.orcamento-item').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.id;
        overlay.remove();
        await self.adicionarItemAOrcamento(id, resumo, fotoUrl);
      });
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // ─── ADICIONA O ITEM A UM ORÇAMENTO EXISTENTE ────────────────
  async adicionarItemAOrcamento(orcamentoId, resumo, fotoUrl) {
    if (typeof window.editarOrcamento !== 'function') {
      alert("Função de edição de orçamento não disponível.");
      return;
    }
    await window.editarOrcamento(orcamentoId);
    setTimeout(() => {
      if (typeof window.adicionarItem === 'function') {
        window.adicionarItem({
          nome: resumo.descricao,
          descricao: `Projeto gerado automaticamente.`,
          preco: 0,
          desconto: 0,
          foto_url: fotoUrl
        });
      }
    }, 800);
    if (typeof navigate === 'function') {
      navigate('orcamentos');
    }
  }
}

// ==================== EDITOR DE FACHADA 2D ====================
class EditorFachada2D {
  constructor(container, manager) {
    this.container = container;
    this.manager = manager;
    this.escala = 2;
    this.grade = 10;
    this.modo = 'linha';
    this.drawing = false;
    this.startX = 0; this.startY = 0;
    this.currentPreview = null;
    this.renderizar();
  }

  renderizar() {
    this.container.innerHTML = `
      <div class="flex flex-col gap-2 h-full">
        <div class="flex gap-2 bg-white p-2 rounded-lg shadow-sm border items-center">
          <button class="tool-btn px-3 py-1 rounded text-sm font-bold bg-[#b8a94e] text-white" data-tool="linha">✏️ Linha</button>
          <button class="tool-btn px-3 py-1 rounded text-sm font-bold bg-slate-200 text-slate-700" data-tool="retangulo">🚪 Porta / Gaveta / Fundo</button>
          <button class="tool-btn px-3 py-1 rounded text-sm font-bold bg-red-100 text-red-700" data-tool="desfazer">↩️ Desfazer</button>
          <button class="tool-btn px-3 py-1 rounded text-sm font-bold bg-red-300 text-red-900" data-tool="limpar">🗑️ Limpar Tudo</button>
          <span class="text-xs text-slate-500 ml-2">Grade: ${this.grade}cm | Arraste para desenhar</span>
        </div>
        <div class="flex-1 bg-white rounded-xl border shadow-sm relative overflow-hidden" id="canvas-fachada" style="min-height:500px;">
          <canvas id="fachada-canvas" class="absolute inset-0 w-full h-full"></canvas>
        </div>
      </div>
      <div id="modal-tipo-preenchimento" class="hidden fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div class="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full">
          <h3 class="font-bold text-lg mb-4">Selecionar tipo</h3>
          <div class="grid grid-cols-1 gap-2" id="opcoes-modal"></div>
          <button onclick="document.getElementById('modal-tipo-preenchimento').classList.add('hidden')" class="mt-4 w-full py-2 bg-slate-200 rounded-lg font-bold">Cancelar</button>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('fachada-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.desenhar();
    this.bindEventos();
  }

  resizeCanvas() {
    const c = document.getElementById('canvas-fachada');
    if (!c) return;
    this.canvas.width = c.clientWidth;
    this.canvas.height = c.clientHeight;
    this.desenhar();
  }

  snap(v) { return Math.round(v / this.grade) * this.grade; }

  obterCoordenadas(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / this.escala, y: (e.clientY - rect.top) / this.escala };
  }

  desenhar() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const passo = this.grade * this.escala;
    ctx.strokeStyle = '#e8ecf0'; ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += passo) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += passo) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3;
    this.manager.linhas.forEach(l => {
      ctx.beginPath();
      ctx.moveTo(l.x1 * this.escala, l.y1 * this.escala);
      ctx.lineTo(l.x2 * this.escala, l.y2 * this.escala);
      ctx.stroke();
    });

    this.manager.preenchimentos.forEach(p => {
      let color;
      if (p.tipo === 'porta') color = 'rgba(139,90,43,0.6)';
      else if (p.tipo === 'gaveta') color = 'rgba(160,120,60,0.6)';
      else color = 'rgba(200,200,200,0.5)';
      ctx.fillStyle = color;
      ctx.fillRect(p.x * this.escala, p.y * this.escala, p.w * this.escala, p.h * this.escala);
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
      ctx.strokeRect(p.x * this.escala, p.y * this.escala, p.w * this.escala, p.h * this.escala);
      ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif';
      ctx.fillText(p.tipo + (p.subdivisoes ? ` (${p.subdivisoes}x)` : ''), p.x * this.escala + 4, p.y * this.escala + 14);
    });

    if (this.currentPreview) {
      const { x, y, w, h, tipo } = this.currentPreview;
      if (tipo === 'linha') {
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(w, h); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
      }
    }
  }

  bindEventos() {
    this.container.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = e.target.dataset.tool;
        if (tool === 'desfazer') {
          if (this.manager.preenchimentos.length) this.manager.preenchimentos.pop();
          else if (this.manager.linhas.length) this.manager.linhas.pop();
          this.desenhar();
        } else if (tool === 'limpar') {
          this.manager.linhas = [];
          this.manager.preenchimentos = [];
          this.desenhar();
        } else {
          this.modo = tool;
          this.container.querySelectorAll('.tool-btn').forEach(b => { b.classList.remove('bg-[#b8a94e]', 'text-white'); b.classList.add('bg-slate-200', 'text-slate-700'); });
          e.target.classList.add('bg-[#b8a94e]', 'text-white');
        }
      });
    });

    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
  }

  onMouseDown(e) {
    const { x, y } = this.obterCoordenadas(e);
    this.startX = this.snap(x);
    this.startY = this.snap(y);
    this.drawing = true;
    this.currentPreview = null;
    this.desenhar();
  }

  onMouseMove(e) {
    if (!this.drawing) return;
    const { x, y } = this.obterCoordenadas(e);
    const sx = this.snap(x), sy = this.snap(y);
    if (this.modo === 'linha') {
      const dx = Math.abs(sx - this.startX), dy = Math.abs(sy - this.startY);
      let x2 = sx, y2 = sy;
      if (dx > dy) y2 = this.startY; else x2 = this.startX;
      this.currentPreview = { tipo: 'linha', x: this.startX * this.escala, y: this.startY * this.escala, w: x2 * this.escala, h: y2 * this.escala };
    } else {
      const w = Math.abs(sx - this.startX) * this.escala;
      const h = Math.abs(sy - this.startY) * this.escala;
      const px = (sx >= this.startX ? this.startX : sx) * this.escala;
      const py = (sy >= this.startY ? this.startY : sy) * this.escala;
      this.currentPreview = { tipo: 'retangulo', x: px, y: py, w, h };
    }
    this.desenhar();
  }

  onMouseUp(e) {
    if (!this.drawing) return;
    this.drawing = false;
    const { x, y } = this.obterCoordenadas(e);
    const sx = this.snap(x), sy = this.snap(y);

    if (this.modo === 'linha') {
      const dx = Math.abs(sx - this.startX), dy = Math.abs(sy - this.startY);
      let x1 = this.startX, y1 = this.startY, x2 = sx, y2 = sy;
      if (dx > dy) y2 = y1; else x2 = x1;
      if (x1 !== x2 || y1 !== y2) {
        this.manager.linhas.push({ x1, y1, x2, y2 });
      }
    } else {
      const w = Math.abs(sx - this.startX);
      const h = Math.abs(sy - this.startY);
      if (w > 0 && h > 0) {
        const px = Math.min(this.startX, sx);
        const py = Math.min(this.startY, sy);
        this.abrirModalPreenchimento(px, py, w, h);
      }
    }
    this.currentPreview = null;
    this.desenhar();
  }

  abrirModalPreenchimento(px, py, w, h) {
    const modal = document.getElementById('modal-tipo-preenchimento');
    const opcoes = document.getElementById('opcoes-modal');
    const opcoesTipo = [
      { label: 'Porta (1 folha)', tipo: 'porta', sub: 1 },
      { label: 'Porta (2 folhas)', tipo: 'porta', sub: 2 },
      { label: 'Porta (3 folhas)', tipo: 'porta', sub: 3 },
      { label: 'Porta (4 folhas)', tipo: 'porta', sub: 4 },
      { label: '1 Gaveta', tipo: 'gaveta', sub: 1 },
      { label: '2 Gavetas', tipo: 'gaveta', sub: 2 },
      { label: '3 Gavetas', tipo: 'gaveta', sub: 3 },
      { label: '4 Gavetas', tipo: 'gaveta', sub: 4 },
      { label: 'Fundo / Painel Cego', tipo: 'fundo', sub: 1 },
    ];
    opcoes.innerHTML = opcoesTipo.map(o => `
      <button class="w-full py-3 border rounded-lg font-bold hover:bg-amber-50 transition text-left px-4"
              data-tipo="${o.tipo}" data-sub="${o.sub}">${o.label}</button>
    `).join('');
    opcoes.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const tipo = btn.dataset.tipo;
        const sub = parseInt(btn.dataset.sub);
        this.manager.preenchimentos.push({ x: px, y: py, w, h, tipo, subdivisoes: sub });
        modal.classList.add('hidden');
        this.desenhar();
      });
    });
    modal.classList.remove('hidden');
  }
}

// ==================== CONFIGURADOR 3D ====================
class ConfiguradorArmario {
  constructor(container, manager) {
    this.container = container;
    this.manager = manager;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.armarioGrupo = null;
    this.init();
  }

  init() {
    this.container.innerHTML = '';
    this.criarCena();
    this.reconstruirModelo();
    this.animar();
  }

  criarCena() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f1f5f9');

    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 400;
    this.camera = new THREE.PerspectiveCamera(45, w / h, 10, 2000);
    this.camera.position.set(250, 180, 350);
    this.camera.lookAt(0, 100, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(0, 200, 200);
    this.scene.add(dir);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 100, 0);
    this.controls.update();

    const gridHelper = new THREE.GridHelper(400, 20, 0xcccccc, 0xe0e0e0);
    this.scene.add(gridHelper);
  }

 reconstruirModelo() {
  if (this.armarioGrupo) {
    this.scene.remove(this.armarioGrupo);
    this.armarioGrupo = null;
  }

  const dims = this.manager.obterDimensoesGerais();
  if (!dims) return;

  const { largura, altura, offsetX, offsetY } = dims;
  const profundidade = this.manager.profundidade;
  const d = 1.8;
  const matCorpo = new THREE.MeshStandardMaterial({ color: '#A67B5B', roughness: 0.5 });
  const matPorta = new THREE.MeshStandardMaterial({ color: '#8B5A2B', roughness: 0.4 });
  const matGaveta = new THREE.MeshStandardMaterial({ color: '#b89a6b', roughness: 0.5 });
  const matFundo = new THREE.MeshStandardMaterial({ color: '#d0c8b0', roughness: 0.6 });

  this.armarioGrupo = new THREE.Group();

  const to3D = (canvasX, canvasY) => {
    const x3D = canvasX - offsetX - largura / 2;
    const y3D = altura - (canvasY - offsetY);
    return { x: x3D, y: y3D };
  };

  // Estrutura fixa (laterais, fundo, teto)
  const leftX = offsetX;
  const rightX = offsetX + largura;
  this.armarioGrupo.add(new THREE.Mesh(new THREE.BoxGeometry(d, altura, profundidade), matCorpo).translateX(to3D(leftX, 0).x).translateY(altura / 2));
  this.armarioGrupo.add(new THREE.Mesh(new THREE.BoxGeometry(d, altura, profundidade), matCorpo).translateX(to3D(rightX, 0).x).translateY(altura / 2));
  this.armarioGrupo.add(new THREE.Mesh(new THREE.BoxGeometry(largura - 2 * d, d, profundidade), matCorpo).translateY(d / 2));
  this.armarioGrupo.add(new THREE.Mesh(new THREE.BoxGeometry(largura, d, profundidade), matCorpo).translateY(altura - d / 2));

  // Prateleiras (linhas horizontais)
  this.manager.linhas.forEach(linha => {
    if (Math.abs(linha.y1 - linha.y2) < 0.1) {
      const yCanvas = linha.y1;
      if (yCanvas > offsetY + 5 && yCanvas < offsetY + altura - 5) {
        const y3D = to3D(0, yCanvas).y;
        this.armarioGrupo.add(new THREE.Mesh(new THREE.BoxGeometry(largura - 2 * d, d, profundidade - 2 * d), matCorpo).translateY(y3D));
      }
    }
  });

  // Divisórias (linhas verticais)
  this.manager.linhas.forEach(linha => {
    if (Math.abs(linha.x1 - linha.x2) < 0.1) {
      const xCanvas = linha.x1;
      if (xCanvas > offsetX + 5 && xCanvas < offsetX + largura - 5) {
        const x3D = to3D(xCanvas, 0).x;
        this.armarioGrupo.add(new THREE.Mesh(new THREE.BoxGeometry(d, altura, profundidade - 2 * d), matCorpo).translateX(x3D).translateY(altura / 2));
      }
    }
  });

  // Portas e gavetas
  const espessuraFrente = d * 0.8;
  this.manager.preenchimentos.forEach(p => {
    const baseX3D = to3D(p.x, 0).x; // canto esquerdo da área
    const centroY3D = to3D(0, p.y + p.h / 2).y; // centro vertical da área
    const faceFrontalZ = profundidade / 2;

    // --- PORTAS (mantém divisão horizontal = largura) ---
    if (p.tipo === 'porta') {
      const sub = p.subdivisoes || 1;
      const subW = p.w / sub;
      for (let i = 0; i < sub; i++) {
        const cx = baseX3D + subW / 2 + i * subW;
        const porta = new THREE.Mesh(new THREE.BoxGeometry(subW, p.h, espessuraFrente), matPorta);
        porta.position.set(cx, centroY3D, faceFrontalZ - espessuraFrente / 2);
        this.armarioGrupo.add(porta);
        // contorno e puxador
        porta.add(new THREE.LineSegments(new THREE.EdgesGeometry(porta.geometry), new THREE.LineBasicMaterial({ color: '#1e293b' })));
        const pux = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 8), new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9, roughness: 0.2 }));
        pux.position.set(subW / 2 - 4, p.h / 2 - 10, espessuraFrente / 2 + 0.5);
        porta.add(pux);
      }
    }

    // --- GAVETAS (CORRIGIDO: divisão vertical = altura) ---
    else if (p.tipo === 'gaveta') {
      const sub = p.subdivisoes || 1;
      const subH = p.h / sub;                        // altura de cada gaveta
      const centroX = baseX3D + p.w / 2;             // centro horizontal fixo

      for (let i = 0; i < sub; i++) {
        // Posição vertical: a primeira gaveta fica no topo da área (maior Y), a última embaixo
        const cy = centroY3D + (p.h / 2) - subH / 2 - i * subH;

        // Frente (painel)
        const frenteGeom = new THREE.BoxGeometry(p.w, subH, espessuraFrente);
        const frente = new THREE.Mesh(frenteGeom, matGaveta);
        frente.position.set(centroX, cy, faceFrontalZ - espessuraFrente / 2);
        this.armarioGrupo.add(frente);
        // contorno da frente
        frente.add(new THREE.LineSegments(new THREE.EdgesGeometry(frenteGeom), new THREE.LineBasicMaterial({ color: '#1e293b' })));
        // friso na base
        const friso = new THREE.Mesh(
          new THREE.BoxGeometry(p.w - 0.4, 0.4, espessuraFrente + 0.3),
          new THREE.MeshBasicMaterial({ color: '#1e293b' })
        );
        friso.position.set(0, -subH / 2 + 2.5, 0);
        frente.add(friso);

        // Corpo (laterais e fundo)
        const profundidadeCorpo = profundidade - 2 * d - 2;
        const alturaCorpo = subH - d * 2;
        const larguraCorpo = p.w - d * 2;
        const zFrenteTraseira = faceFrontalZ - espessuraFrente;
        const zCentroCorpo = zFrenteTraseira - profundidadeCorpo / 2;

        const geoLat = new THREE.BoxGeometry(d, alturaCorpo, profundidadeCorpo);
        this.armarioGrupo.add(new THREE.Mesh(geoLat, matGaveta).translateX(centroX - p.w / 2 + d / 2).translateY(cy).translateZ(zCentroCorpo));
        this.armarioGrupo.add(new THREE.Mesh(geoLat, matGaveta).translateX(centroX + p.w / 2 - d / 2).translateY(cy).translateZ(zCentroCorpo));
        this.armarioGrupo.add(new THREE.Mesh(new THREE.BoxGeometry(larguraCorpo, d, profundidadeCorpo), matGaveta).translateX(centroX).translateY(cy - alturaCorpo / 2 + d / 2).translateZ(zCentroCorpo));
      }
    }

    // --- FUNDO (painel cego) ---
    else if (p.tipo === 'fundo') {
      const centroX = baseX3D + p.w / 2;
      this.armarioGrupo.add(new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, d), matFundo).translateX(centroX).translateY(centroY3D).translateZ(-profundidade / 2 + d / 2));
    }
  });

  this.scene.add(this.armarioGrupo);
}
  

// ==================== INICIALIZAÇÃO GLOBAL ====================
window.iniciarProjetos = function () {
  const container = document.getElementById('view-projetos');
  if (!container || container.dataset.projetoIniciado === 'true') return;
  container.dataset.projetoIniciado = 'true';
  container.classList.remove('p-8', 'text-center', 'text-slate-500');
  container.innerHTML = '';
  new ProjetosManager(container);
};
