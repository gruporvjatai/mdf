// projetos.js /////
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ==================== CLASSE PRINCIPAL DE PROJETOS ====================
class ProjetosManager {
  constructor(container) {
    this.container = container;
    this.profundidade = 60; // cm – será usada tanto no 2D quanto no 3D
    this.blocosFachada = []; // array de objetos { id, tipo, x, y, w, h, ... }
    this.init();
  }

  init() {
    this.renderizarInterface();
    this.mostrarSubAba('fachada'); // começa no editor 2D
  }

  renderizarInterface() {
    this.container.innerHTML = `
      <div class="flex flex-col h-full">
        <!-- Barra superior de sub-abas -->
        <div class="flex gap-2 mb-4 bg-white p-2 rounded-xl shadow-sm border">
          <button data-subaba="fachada" class="subaba-btn px-4 py-2 rounded-lg font-bold text-sm transition bg-[#b8a94e] text-white shadow">📐 Fachada 2D</button>
          <button data-subaba="3d" class="subaba-btn px-4 py-2 rounded-lg font-bold text-sm transition text-slate-600 hover:bg-slate-100">🧊 Visualização 3D</button>
          <button data-subaba="orcamento" class="subaba-btn px-4 py-2 rounded-lg font-bold text-sm transition text-slate-600 hover:bg-slate-100">🧾 Orçamento</button>
          <div class="flex-1"></div>
          <div class="flex items-center gap-2">
            <label class="text-xs font-bold text-slate-600">Profundidade:</label>
            <input type="number" id="profundidade-input" value="60" min="30" max="80" class="w-16 p-1 border rounded text-xs" onchange="window.profundidadeProjeto = parseFloat(this.value)">
          </div>
        </div>
        <!-- Área dinâmica -->
        <div id="subaba-fachada" class="subaba-content flex-1"></div>
        <div id="subaba-3d" class="subaba-content flex-1 hidden"></div>
        <div id="subaba-orcamento" class="subaba-content flex-1 hidden"></div>
      </div>
    `;

    // Eventos dos botões de sub-aba
    this.container.querySelectorAll('.subaba-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.mostrarSubAba(e.target.dataset.subaba));
    });

    // Referência global para a profundidade ser acessada pelo editor
    window.profundidadeProjeto = this.profundidade;
  }

  mostrarSubAba(nome) {
    // Atualiza botões ativos
    this.container.querySelectorAll('.subaba-btn').forEach(btn => {
      btn.classList.remove('bg-[#b8a94e]', 'text-white', 'shadow');
      btn.classList.add('text-slate-600', 'hover:bg-slate-100');
    });
    const btnAtivo = this.container.querySelector(`[data-subaba="${nome}"]`);
    if (btnAtivo) {
      btnAtivo.classList.add('bg-[#b8a94e]', 'text-white', 'shadow');
      btnAtivo.classList.remove('text-slate-600', 'hover:bg-slate-100');
    }

    // Esconde todas as áreas e mostra a selecionada
    this.container.querySelectorAll('.subaba-content').forEach(el => el.classList.add('hidden'));
    const area = document.getElementById(`subaba-${nome}`);
    if (area) area.classList.remove('hidden');

    // Inicializa a sub-aba se necessário
    if (nome === 'fachada' && !this._fachadaIniciada) {
      this._fachadaIniciada = true;
      this.editor2D = new EditorFachada2D(area, this);
    }
    if (nome === '3d' && !this._3dIniciado) {
      this._3dIniciado = true;
      this.configurador3D = new ConfiguradorArmario(area, this);
    }
    if (nome === 'orcamento') {
      this.atualizarOrcamento();
    }
  }

  // Chamado quando o editor 2D altera os blocos
  atualizarBlocos(novosBlocos) {
    this.blocosFachada = novosBlocos;
    // Se o 3D já foi iniciado, reconstrói o modelo
    if (this.configurador3D) {
      this.configurador3D.reconstruirAPartirDosBlocos(this.blocosFachada);
    }
  }

  // Atualiza a aba de orçamento com a lista de peças
  atualizarOrcamento() {
    const area = document.getElementById('subaba-orcamento');
    if (!area) return;
    const pecas = this.gerarListaPecas();
    area.innerHTML = `
      <div class="bg-white rounded-xl shadow border p-4">
        <h3 class="font-bold text-lg mb-3">Peças do Projeto</h3>
        <table class="w-full text-sm">
          <thead class="bg-slate-100">
            <tr><th class="p-2 text-left">Peça</th><th class="p-2 text-center">Qtd</th><th class="p-2 text-right">Dimensões (cm)</th></tr>
          </thead>
          <tbody>${pecas.map(p => `<tr class="border-b"><td class="p-2">${p.nome}</td><td class="p-2 text-center">${p.qtd}</td><td class="p-2 text-right">${p.dim}</td></tr>`).join('')}</tbody>
        </table>
        <button id="btn-enviar-orcamento" class="mt-4 btn-primary px-4 py-2 rounded-lg font-bold shadow">📤 Enviar para Orçamento</button>
      </div>
    `;
    document.getElementById('btn-enviar-orcamento').addEventListener('click', () => this.enviarParaOrcamento(pecas));
  }

  gerarListaPecas() {
    const pecas = [];
    const d = 1.8; // espessura em cm
    const { largura, altura } = this.obterDimensoesGerais();
    const profundidade = this.profundidade;

    // Laterais, fundo, teto (estrutura básica)
    pecas.push({ nome: 'Lateral Esquerda', qtd: 1, dim: `${d} x ${altura} x ${profundidade}` });
    pecas.push({ nome: 'Lateral Direita', qtd: 1, dim: `${d} x ${altura} x ${profundidade}` });
    pecas.push({ nome: 'Fundo', qtd: 1, dim: `${largura - 2*d} x ${d} x ${profundidade}` });
    pecas.push({ nome: 'Teto', qtd: 1, dim: `${largura} x ${d} x ${profundidade}` });

    // A partir dos blocos da fachada
    this.blocosFachada.forEach(bloco => {
      if (bloco.tipo === 'porta') {
        pecas.push({ nome: `Porta (${bloco.width.toFixed(0)}x${bloco.height.toFixed(0)})`, qtd: 1, dim: `${bloco.width.toFixed(0)} x ${bloco.height.toFixed(0)} x ${d*0.6}` });
      } else if (bloco.tipo === 'gaveta') {
        pecas.push({ nome: `Frente Gaveta (${bloco.width.toFixed(0)}x${bloco.height.toFixed(0)})`, qtd: 1, dim: `${bloco.width.toFixed(0)} x ${bloco.height.toFixed(0)} x ${d*0.6}` });
        // Corpo da gaveta (laterais, fundo, traseira)
        pecas.push({ nome: `Laterais Gaveta (${bloco.width.toFixed(0)}x${profundidade-2})`, qtd: 2, dim: `${d} x ${bloco.height.toFixed(0)} x ${profundidade-2}` });
      } else if (bloco.tipo === 'prateleira') {
        pecas.push({ nome: `Prateleira (${bloco.width.toFixed(0)}x${profundidade-2*d})`, qtd: 1, dim: `${bloco.width.toFixed(0)} x ${d} x ${profundidade-2*d}` });
      }
    });

    // Prateleiras extras (se não houver blocos de prateleira, mantém as do configurador?)
    if (!this.blocosFachada.some(b => b.tipo === 'prateleira')) {
      const numPrateleiras = 3; // default
      if (numPrateleiras > 0 && altura > 2*d) {
        pecas.push({ nome: `Prateleira Interna`, qtd: numPrateleiras, dim: `${largura - 2*d} x ${d} x ${profundidade - 2*d}` });
      }
    }

    return pecas;
  }

  obterDimensoesGerais() {
    if (this.blocosFachada.length > 0) {
      const maxLargura = Math.max(...this.blocosFachada.map(b => b.x + b.width));
      const maxAltura = Math.max(...this.blocosFachada.map(b => b.y + b.height));
      return { largura: maxLargura + 3.6, altura: maxAltura + 3.6 }; // laterais de 1.8 cada
    }
    return { largura: 200, altura: 220 };
  }

  enviarParaOrcamento(pecas) {
    if (typeof window.abrirNovoOrcamento === 'function') {
      window.abrirNovoOrcamento();
      setTimeout(() => {
        pecas.forEach(p => {
          window.adicionarItem({
            nome: p.nome,
            descricao: p.dim,
            preco: 0,
            desconto: 0
          });
        });
      }, 500);
      if (typeof navigate === 'function') navigate('orcamentos');
    }
  }
}

// ==================== EDITOR DE FACHADA 2D (ESTILO FLATMA SKETCH) ====================
class EditorFachada2D {
  constructor(container, manager) {
    this.container = container;
    this.manager = manager;
    this.blocos = [];
    this.idCounter = 0;
    this.escala = 2; // pixels por cm
    this.grade = 10; // cm (grade mais fina, estilo Flatma)
    this.modo = 'porta'; // 'porta', 'gaveta', 'prateleira'
    this.drawing = false;
    this.startX = 0;
    this.startY = 0;
    this.currentRect = null; // retângulo temporário durante o arrasto
    this.renderizar();
  }

  renderizar() {
    this.container.innerHTML = `
      <div class="flex flex-col gap-2 h-full">
        <div class="flex gap-2 bg-white p-2 rounded-lg shadow-sm border items-center">
          <button class="tool-btn px-3 py-1 rounded text-sm font-bold bg-[#b8a94e] text-white" data-tool="porta">🚪 Porta</button>
          <button class="tool-btn px-3 py-1 rounded text-sm font-bold bg-slate-200 text-slate-700" data-tool="gaveta">🗄️ Gaveta</button>
          <button class="tool-btn px-3 py-1 rounded text-sm font-bold bg-slate-200 text-slate-700" data-tool="prateleira">📏 Prateleira</button>
          <button class="tool-btn px-3 py-1 rounded text-sm font-bold bg-red-100 text-red-700" data-tool="desfazer">↩️ Desfazer Último</button>
          <span class="text-xs text-slate-500 ml-2">Grade: ${this.grade}cm | Arraste para desenhar</span>
        </div>
        <div class="flex-1 bg-white rounded-xl border shadow-sm relative overflow-hidden" id="canvas-fachada" style="min-height: 500px;">
          <canvas id="fachada-canvas" class="absolute inset-0 w-full h-full"></canvas>
          <div id="preview-info" class="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded hidden"></div>
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
    const container = document.getElementById('canvas-fachada');
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    this.desenhar();
  }

  desenhar() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Grade
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    const passo = this.grade * this.escala;
    for (let x = 0; x < w; x += passo) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += passo) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Linhas de 1 metro (100cm) mais escuras
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    const passoMetro = 100 * this.escala;
    for (let x = 0; x < w; x += passoMetro) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += passoMetro) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Blocos já desenhados
    this.blocos.forEach(bloco => {
      ctx.fillStyle = bloco.tipo === 'porta' ? 'rgba(139,90,43,0.8)' : bloco.tipo === 'gaveta' ? 'rgba(160,120,60,0.8)' : 'rgba(180,140,80,0.6)';
      ctx.fillRect(bloco.x * this.escala, bloco.y * this.escala, bloco.width * this.escala, bloco.height * this.escala);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.strokeRect(bloco.x * this.escala, bloco.y * this.escala, bloco.width * this.escala, bloco.height * this.escala);
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${bloco.tipo} ${bloco.width.toFixed(0)}x${bloco.height.toFixed(0)}cm`, bloco.x * this.escala + 4, bloco.y * this.escala + 14);
    });

    // Retângulo atual sendo desenhado (preview)
    if (this.currentRect) {
      const { x, y, width, height } = this.currentRect;
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(x, y, width, height);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
    }
  }

  bindEventos() {
    // Botões de ferramenta
    this.container.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = e.target.dataset.tool;
        if (tool === 'desfazer') {
          if (this.blocos.length) {
            this.blocos.pop();
            this.sincronizar();
            this.desenhar();
          }
        } else {
          this.modo = tool;
          this.container.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('bg-[#b8a94e]', 'text-white'));
          e.target.classList.add('bg-[#b8a94e]', 'text-white');
        }
      });
    });

    // Eventos de mouse no canvas
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e)); // global para não perder o evento fora do canvas
  }

  obterCoordenadasCanvas(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / this.escala,
      y: (e.clientY - rect.top) / this.escala
    };
  }

  snap(valor) {
    return Math.round(valor / this.grade) * this.grade;
  }

  onMouseDown(e) {
    const { x, y } = this.obterCoordenadasCanvas(e);
    // Snap nas coordenadas iniciais
    this.startX = this.snap(x);
    this.startY = this.snap(y);
    this.drawing = true;
    this.currentRect = {
      x: this.startX * this.escala,
      y: this.startY * this.escala,
      width: 0,
      height: 0
    };
    document.getElementById('preview-info').classList.remove('hidden');
    this.desenhar();
  }

  onMouseMove(e) {
    if (!this.drawing) return;
    const { x, y } = this.obterCoordenadasCanvas(e);
    const snappedX = this.snap(x);
    const snappedY = this.snap(y);
    const w = snappedX - this.startX;
    const h = snappedY - this.startY;
    this.currentRect = {
      x: w >= 0 ? this.startX * this.escala : snappedX * this.escala,
      y: h >= 0 ? this.startY * this.escala : snappedY * this.escala,
      width: Math.abs(w) * this.escala,
      height: Math.abs(h) * this.escala
    };
    // Atualiza info de dimensões
    const info = document.getElementById('preview-info');
    if (info) {
      info.innerText = `${Math.abs(w)} x ${Math.abs(h)} cm`;
    }
    this.desenhar();
  }

  onMouseUp(e) {
    if (!this.drawing) return;
    this.drawing = false;
    const { width, height, x, y } = this.currentRect;
    const wCm = width / this.escala;
    const hCm = height / this.escala;
    const xCm = x / this.escala;
    const yCm = y / this.escala;
    if (wCm > 0 && hCm > 0) {
      const novoBloco = {
        id: ++this.idCounter,
        tipo: this.modo,
        x: xCm,
        y: yCm,
        width: wCm,
        height: hCm
      };
      this.blocos.push(novoBloco);
      this.sincronizar();
    }
    this.currentRect = null;
    document.getElementById('preview-info').classList.add('hidden');
    this.desenhar();
  }

  sincronizar() {
    this.manager.atualizarBlocos(this.blocos);
  }
}

// ==================== CONFIGURADOR 3D (mantido igual) ====================
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
    this.animar();
  }

  criarCena() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f1f5f9');

    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 400;
    this.camera = new THREE.PerspectiveCamera(45, w / h, 10, 1000);
    this.camera.position.set(250, 180, 300);
    this.camera.lookAt(0, 120, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(100, 200, 150);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 120, 0);
    this.controls.update();

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ color: '#e2e8f0' }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    if (this.manager.blocosFachada.length) {
      this.reconstruirAPartirDosBlocos(this.manager.blocosFachada);
    } else {
      this.reconstruirModelo({
        largura: 200, altura: 220, profundidade: 60,
        numPrateleiras: 3, espessura: 1.8
      });
    }
  }

  reconstruirAPartirDosBlocos(blocos) {
    const { largura, altura } = this.manager.obterDimensoesGerais();
    const profundidade = this.manager.profundidade;
    this.reconstruirModelo({
      largura, altura, profundidade,
      numPrateleiras: 0,
      espessura: 1.8,
      blocos: blocos
    });
  }

  reconstruirModelo(params) {
    if (this.armarioGrupo) this.scene.remove(this.armarioGrupo);
    this.armarioGrupo = new THREE.Group();

    const { largura, altura, profundidade, espessura = 1.8, blocos = [] } = params;
    const d = espessura;
    const matCorpo = new THREE.MeshStandardMaterial({ color: '#A67B5B', roughness: 0.5 });
    const matPorta = new THREE.MeshStandardMaterial({ color: '#8B5A2B', roughness: 0.4 });

    const lateralGeo = new THREE.BoxGeometry(d, altura, profundidade);
    const latE = new THREE.Mesh(lateralGeo, matCorpo); latE.position.set(-largura/2 + d/2, altura/2, 0); this.armarioGrupo.add(latE);
    const latD = new THREE.Mesh(lateralGeo, matCorpo); latD.position.set(largura/2 - d/2, altura/2, 0); this.armarioGrupo.add(latD);
    const fundo = new THREE.Mesh(new THREE.BoxGeometry(largura - 2*d, d, profundidade), matCorpo); fundo.position.set(0, d/2, 0); this.armarioGrupo.add(fundo);
    const teto = new THREE.Mesh(new THREE.BoxGeometry(largura, d, profundidade), matCorpo); teto.position.set(0, altura - d/2, 0); this.armarioGrupo.add(teto);

    blocos.forEach(bloco => {
      const w = bloco.width;
      const h = bloco.height;
      const x = bloco.x - largura/2 + w/2;
      const y = bloco.y + h/2;
      if (bloco.tipo === 'porta') {
        const porta = new THREE.Mesh(new THREE.BoxGeometry(w, h, d*0.6), matPorta);
        porta.position.set(x, y, profundidade/2 - d*0.3);
        this.armarioGrupo.add(porta);
      } else if (bloco.tipo === 'gaveta') {
        const frente = new THREE.Mesh(new THREE.BoxGeometry(w, h, d*0.6), new THREE.MeshStandardMaterial({ color: '#b89a6b' }));
        frente.position.set(x, y, profundidade/2 - d*0.3);
        this.armarioGrupo.add(frente);
      } else if (bloco.tipo === 'prateleira') {
        const prat = new THREE.Mesh(new THREE.BoxGeometry(w, d, profundidade - 2*d), matCorpo);
        prat.position.set(x, y, 0);
        this.armarioGrupo.add(prat);
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

// ==================== INICIALIZAÇÃO GLOBAL ====================
window.iniciarProjetos = function() {
  const container = document.getElementById('view-projetos');
  if (!container || container.dataset.projetoIniciado === 'true') return;
  container.dataset.projetoIniciado = 'true';
  container.classList.remove('p-8', 'text-center', 'text-slate-500');
  container.innerHTML = '';
  new ProjetosManager(container);
};
