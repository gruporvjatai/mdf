// projetos.js – Editor 2D + 3D + Orçamento (revisão 3D fiel)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ==================== CLASSE PRINCIPAL DE PROJETOS ====================
class ProjetosManager {
  constructor(container) {
    this.container = container;
    this.profundidade = 60;
    this.linhas = [];           // { x1, y1, x2, y2 } em cm
    this.preenchimentos = [];   // { x, y, w, h, tipo, subdivisoes }
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
          <button data-subaba="orcamento" class="subaba-btn px-4 py-2 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-100">🧾 Orçamento</button>
          <div class="flex-1"></div>
          <div class="flex items-center gap-2">
            <label class="text-xs font-bold text-slate-600">Profundidade (cm):</label>
            <input type="number" id="profundidade-input" value="60" min="30" max="80" class="w-16 p-1 border rounded text-xs" onchange="window.profundidadeProjeto = parseFloat(this.value)">
          </div>
        </div>
        <div id="subaba-fachada" class="subaba-content flex-1"></div>
        <div id="subaba-3d" class="subaba-content flex-1 hidden"></div>
        <div id="subaba-orcamento" class="subaba-content flex-1 hidden"></div>
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
      // Atualiza o modelo 3D ao alternar para a aba
      this.configurador3D.reconstruirModelo();
    }
    if (nome === 'orcamento') {
      this.atualizarOrcamento();
    }
  }

  obterDimensoesGerais() {
    if (this.linhas.length > 0) {
      const xs = this.linhas.flatMap(l => [l.x1, l.x2]);
      const ys = this.linhas.flatMap(l => [l.y1, l.y2]);
      // Considera o chão sempre como y=0, então a altura é o maior y
      const maxY = Math.max(...ys, 0);
      return {
        largura: Math.max(...xs, 80) - Math.min(...xs, 0) + 3.6, // laterais de 1.8cm
        altura: maxY + 3.6  // laterais de 1.8cm
      };
    }
    return { largura: 200, altura: 220 };
  }

  gerarListaPecas() {
    // (mantido igual, sem alterações)
    const pecas = [];
    const d = 1.8;
    const { largura, altura } = this.obterDimensoesGerais();
    const profundidade = this.profundidade;

    pecas.push({ nome: 'Lateral Esquerda', qtd: 1, dim: `${d} x ${altura} x ${profundidade}` });
    pecas.push({ nome: 'Lateral Direita', qtd: 1, dim: `${d} x ${altura} x ${profundidade}` });
    pecas.push({ nome: 'Fundo', qtd: 1, dim: `${largura - 2*d} x ${d} x ${profundidade}` });
    pecas.push({ nome: 'Teto', qtd: 1, dim: `${largura} x ${d} x ${profundidade}` });

    this.linhas.forEach(linha => {
      const y = linha.y1;
      if (y > 0 && y < altura) {
        pecas.push({ nome: `Prateleira Fixa (y=${y.toFixed(0)})`, qtd: 1, dim: `${largura - 2*d} x ${d} x ${profundidade - 2*d}` });
      }
    });

    this.preenchimentos.forEach(p => {
      if (p.tipo === 'porta') {
        pecas.push({ nome: `Porta (${p.w.toFixed(0)}x${p.h.toFixed(0)})`, qtd: p.subdivisoes || 1, dim: `${(p.w/(p.subdivisoes||1)).toFixed(0)} x ${p.h.toFixed(0)} x 1.2` });
      } else if (p.tipo === 'gaveta') {
        pecas.push({ nome: `Frente Gaveta (${p.w.toFixed(0)}x${p.h.toFixed(0)})`, qtd: p.subdivisoes || 1, dim: `${(p.w/(p.subdivisoes||1)).toFixed(0)} x ${p.h.toFixed(0)} x 1.2` });
      }
    });

    return pecas;
  }

  atualizarOrcamento() {
    const area = document.getElementById('subaba-orcamento');
    if (!area) return;
    const pecas = this.gerarListaPecas();
    area.innerHTML = `
      <div class="bg-white rounded-xl shadow border p-4">
        <h3 class="font-bold text-lg mb-3">Peças do Projeto</h3>
        <table class="w-full text-sm"><thead class="bg-slate-100"><tr><th class="p-2 text-left">Peça</th><th class="p-2 text-center">Qtd</th><th class="p-2 text-right">Dimensões (cm)</th></tr></thead>
        <tbody>${pecas.map(p => `<tr class="border-b"><td class="p-2">${p.nome}</td><td class="p-2 text-center">${p.qtd}</td><td class="p-2 text-right">${p.dim}</td></tr>`).join('')}</tbody></table>
        <button id="btn-enviar-orcamento" class="mt-4 btn-primary px-4 py-2 rounded-lg font-bold shadow">📤 Enviar para Orçamento</button>
      </div>`;
    document.getElementById('btn-enviar-orcamento').addEventListener('click', () => {
      if (typeof window.abrirNovoOrcamento === 'function') {
        window.abrirNovoOrcamento();
        setTimeout(() => { pecas.forEach(p => window.adicionarItem({ nome: p.nome, descricao: p.dim, preco: 0, desconto: 0 })); }, 500);
        if (typeof navigate === 'function') navigate('orcamentos');
      }
    });
  }
}

// ==================== EDITOR DE FACHADA 2D (com botão limpar) ====================
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
          <button class="tool-btn px-3 py-1 rounded text-sm font-bold bg-slate-200 text-slate-700" data-tool="retangulo">🚪 Porta / Gaveta</button>
          <button class="tool-btn px-3 py-1 rounded text-sm font-bold bg-red-100 text-red-700" data-tool="desfazer">↩️ Desfazer</button>
          <button class="tool-btn px-3 py-1 rounded text-sm font-bold bg-red-300 text-red-900" data-tool="limpar">🗑️ Limpar Tudo</button>
          <span class="text-xs text-slate-500 ml-2">Grade: ${this.grade}cm | Linha = estrutura, Retângulo = portas/gavetas</span>
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

    // Grade
    const passo = this.grade * this.escala;
    ctx.strokeStyle = '#e8ecf0'; ctx.lineWidth = 0.5;
    for (let x=0; x<w; x+=passo) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    for (let y=0; y<h; y+=passo) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }

    // Linhas
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3;
    this.manager.linhas.forEach(l => {
      ctx.beginPath();
      ctx.moveTo(l.x1 * this.escala, l.y1 * this.escala);
      ctx.lineTo(l.x2 * this.escala, l.y2 * this.escala);
      ctx.stroke();
    });

    // Preenchimentos
    this.manager.preenchimentos.forEach(p => {
      ctx.fillStyle = p.tipo === 'porta' ? 'rgba(139,90,43,0.6)' : 'rgba(160,120,60,0.6)';
      ctx.fillRect(p.x * this.escala, p.y * this.escala, p.w * this.escala, p.h * this.escala);
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
      ctx.strokeRect(p.x * this.escala, p.y * this.escala, p.w * this.escala, p.h * this.escala);
      ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif';
      ctx.fillText(`${p.tipo} (${p.subdivisoes || 1}x)`, p.x * this.escala + 4, p.y * this.escala + 14);
    });

    // Preview
    if (this.currentPreview) {
      const { x, y, w, h, tipo } = this.currentPreview;
      if (tipo === 'linha') {
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.setLineDash([4,4]);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(w, h); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.setLineDash([4,4]);
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
          this.container.querySelectorAll('.tool-btn').forEach(b => { b.classList.remove('bg-[#b8a94e]','text-white'); b.classList.add('bg-slate-200','text-slate-700'); });
          e.target.classList.add('bg-[#b8a94e]','text-white');
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
      const dx = Math.abs(sx - this.startX);
      const dy = Math.abs(sy - this.startY);
      let x2 = sx, y2 = sy;
      if (dx > dy) y2 = this.startY; else x2 = this.startX; // força ortogonal
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
      if (dx > dy) y2 = y1;
      else x2 = x1;
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

// ==================== CONFIGURADOR 3D (REVISADO COM COORDENADAS CORRIGIDAS) ====================
class ConfiguradorArmario {
  constructor(container, manager) {
    this.container = container;
    this.manager = manager;
    this.scene = null; this.camera = null; this.renderer = null; this.controls = null; this.armarioGrupo = null;
    this.init();
  }

  init() { this.container.innerHTML = ''; this.criarCena(); this.animar(); }

  criarCena() {
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#f1f5f9');
    const w = this.container.clientWidth || 600, h = this.container.clientHeight || 400;
    this.camera = new THREE.PerspectiveCamera(45, w/h, 10, 2000);
    this.camera.position.set(300, 230, 400); this.camera.lookAt(0, 100, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h); this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(100,200,150); this.scene.add(dir);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 100, 0); this.controls.update();

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(600,600), new THREE.MeshStandardMaterial({color:'#e2e8f0'}));
    floor.rotation.x = -Math.PI/2; this.scene.add(floor);

    this.reconstruirModelo();
  }

  reconstruirModelo() {
    if (this.armarioGrupo) this.scene.remove(this.armarioGrupo);
    this.armarioGrupo = new THREE.Group();

    const { largura, altura } = this.manager.obterDimensoesGerais();
    const profundidade = this.manager.profundidade;
    const d = 1.8; // espessura dos painéis
    const matCorpo = new THREE.MeshStandardMaterial({ color: '#A67B5B', roughness: 0.5 });
    const matPorta = new THREE.MeshStandardMaterial({ color: '#8B5A2B', roughness: 0.4 });
    const matGaveta = new THREE.MeshStandardMaterial({ color: '#b89a6b', roughness: 0.5 });

    // Laterais (posicionadas nas extremidades)
    const lateralGeo = new THREE.BoxGeometry(d, altura, profundidade);
    const latE = new THREE.Mesh(lateralGeo, matCorpo); latE.position.set(-largura/2 + d/2, altura/2, 0); this.armarioGrupo.add(latE);
    const latD = new THREE.Mesh(lateralGeo, matCorpo); latD.position.set(largura/2 - d/2, altura/2, 0); this.armarioGrupo.add(latD);

    // Fundo
    const fundoGeo = new THREE.BoxGeometry(largura - 2*d, d, profundidade);
    const fundo = new THREE.Mesh(fundoGeo, matCorpo); fundo.position.set(0, d/2, 0); this.armarioGrupo.add(fundo);

    // Teto
    const tetoGeo = new THREE.BoxGeometry(largura, d, profundidade);
    const teto = new THREE.Mesh(tetoGeo, matCorpo); teto.position.set(0, altura - d/2, 0); this.armarioGrupo.add(teto);

    // Prateleiras (linhas horizontais internas)
    this.manager.linhas.forEach(linha => {
      const yCanvas = linha.y1; // coordenada Y do canvas
      // Converte para Y do 3D: y3D = alturaTotal - yCanvas (porque canvas y=0 = topo)
      const y3D = altura - yCanvas;
      if (y3D > 5 && y3D < altura - 5) {
        const pratGeo = new THREE.BoxGeometry(largura - 2*d, d, profundidade - 2*d);
        const prat = new THREE.Mesh(pratGeo, matCorpo);
        prat.position.set(0, y3D, 0);
        this.armarioGrupo.add(prat);
      }
    });

    // Portas e gavetas
    const espessuraFrente = d * 0.8; // espessura da frente (um pouco menor)
    this.manager.preenchimentos.forEach(p => {
      const canvasX = p.x;
      const canvasY = p.y;
      const wTotal = p.w;
      const hTotal = p.h;
      const sub = p.subdivisoes || 1;
      const subW = wTotal / sub;

      // Converter para sistema 3D:
      // x3D central: canvasX + subW*i + subW/2 - largura/2
      // y3D: altura - (canvasY + hTotal/2)
      const baseX3D = canvasX - largura/2; // canto esquerdo do preenchimento no mundo 3D
      const yCentro3D = altura - (canvasY + hTotal/2);

      for (let i = 0; i < sub; i++) {
        const cx = baseX3D + subW/2 + i*subW; // centro da folha
        const cy = yCentro3D;
        if (p.tipo === 'porta') {
          const porta = new THREE.Mesh(
            new THREE.BoxGeometry(subW, hTotal, espessuraFrente),
            matPorta
          );
          porta.position.set(cx, cy, profundidade/2 - espessuraFrente/2);
          this.armarioGrupo.add(porta);
        } else {
          const frente = new THREE.Mesh(
            new THREE.BoxGeometry(subW, hTotal, espessuraFrente),
            matGaveta
          );
          frente.position.set(cx, cy, profundidade/2 - espessuraFrente/2);
          this.armarioGrupo.add(frente);
        }
      }
    });

    this.scene.add(this.armarioGrupo);
  }

  animar() {
    requestAnimationFrame(() => this.animar());
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
  }
}

window.iniciarProjetos = function() {
  const container = document.getElementById('view-projetos');
  if (!container || container.dataset.projetoIniciado === 'true') return;
  container.dataset.projetoIniciado = 'true';
  container.classList.remove('p-8','text-center','text-slate-500');
  container.innerHTML = '';
  new ProjetosManager(container);
};
