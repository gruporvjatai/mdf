// projetos.js – Editor 2D + 3D + Orçamento (3D fiel ao traçado)
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
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        largura: (maxX - minX) || 80,   // mínimo 80cm se não houver largura
        altura: (maxY - minY) || 220,
        offsetX: minX,                  // para centralizar
        offsetY: minY                   // para colocar o chão em y=0
      };
    }
    return null; // sem linhas → sem armário
  }

  // ... (gerarListaPecas e atualizarOrcamento mantidos como antes, mas não são o foco agora)
}

// ==================== EDITOR DE FACHADA 2D (mantido o mesmo) ====================
// (mantenha exatamente o código do EditorFachada2D que já estava funcionando, com botão limpar)

// ==================== CONFIGURADOR 3D (COMPLETAMENTE REFEITO) ====================
class ConfiguradorArmario {
  constructor(container, manager) {
    this.container = container;
    this.manager = manager;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.armarioGrupo = null;
    this.iniciado = false;
    this.init();
  }

  init() {
    this.container.innerHTML = '';
    this.criarCena();
    this.iniciado = true;
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

    // Iluminação simples
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(0, 200, 200);
    this.scene.add(dir);

    // Controles
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 100, 0);
    this.controls.update();

    // Chão de referência
    const gridHelper = new THREE.GridHelper(400, 20, 0xcccccc, 0xe0e0e0);
    this.scene.add(gridHelper);
  }

  reconstruirModelo() {
    // Remove grupo anterior
    if (this.armarioGrupo) {
      this.scene.remove(this.armarioGrupo);
      this.armarioGrupo = null;
    }

    const dims = this.manager.obterDimensoesGerais();
    if (!dims) {
      // Sem linhas: não exibe nada (apenas grid)
      return;
    }

    const { largura, altura, offsetX, offsetY } = dims;
    const profundidade = this.manager.profundidade;
    const d = 1.8; // espessura padrão (visual)

    const matCorpo = new THREE.MeshStandardMaterial({ color: '#A67B5B', roughness: 0.5 });
    const matPorta = new THREE.MeshStandardMaterial({ color: '#8B5A2B', roughness: 0.4 });
    const matGaveta = new THREE.MeshStandardMaterial({ color: '#b89a6b', roughness: 0.5 });

    this.armarioGrupo = new THREE.Group();

    // Função auxiliar: converte coordenadas do canvas (cm) para o mundo 3D
    const to3D = (canvasX, canvasY) => {
      // Centraliza X em 0
      const x3D = canvasX - offsetX - largura / 2;
      // Converte Y (canvas: 0=topo) para Y 3D (0=chão)
      const y3D = altura - (canvasY - offsetY);
      return { x: x3D, y: y3D };
    };

    // --- Estrutura básica (laterais, fundo, teto) ---
    // Laterais nas extremidades esquerda e direita do bounding box
    const leftX = offsetX;
    const rightX = offsetX + largura;
    const bottomY = offsetY + altura; // no canvas, maior Y = chão
    const topY = offsetY;

    // Lateral esquerda
    const latEsq = new THREE.Mesh(
      new THREE.BoxGeometry(d, altura, profundidade),
      matCorpo
    );
    latEsq.position.set(to3D(leftX, 0).x, altura / 2, 0);
    this.armarioGrupo.add(latEsq);

    // Lateral direita
    const latDir = new THREE.Mesh(
      new THREE.BoxGeometry(d, altura, profundidade),
      matCorpo
    );
    latDir.position.set(to3D(rightX, 0).x, altura / 2, 0);
    this.armarioGrupo.add(latDir);

    // Fundo (posicionado no chão, em y=0)
    const fundo = new THREE.Mesh(
      new THREE.BoxGeometry(largura - 2 * d, d, profundidade),
      matCorpo
    );
    fundo.position.set(0, d / 2, 0);
    this.armarioGrupo.add(fundo);

    // Teto
    const teto = new THREE.Mesh(
      new THREE.BoxGeometry(largura, d, profundidade),
      matCorpo
    );
    teto.position.set(0, altura - d / 2, 0);
    this.armarioGrupo.add(teto);

    // --- Linhas internas horizontais → prateleiras ---
    this.manager.linhas.forEach(linha => {
      // Consideramos apenas linhas horizontais (y1 == y2 praticamente)
      if (Math.abs(linha.y1 - linha.y2) < 0.1) {
        const yCanvas = linha.y1;
        // Ignora se for o chão ou topo (próximo das bordas)
        if (yCanvas > topY + 5 && yCanvas < bottomY - 5) {
          const y3D = to3D(0, yCanvas).y;
          const pratGeo = new THREE.BoxGeometry(largura - 2 * d, d, profundidade - 2 * d);
          const prat = new THREE.Mesh(pratGeo, matCorpo);
          prat.position.set(0, y3D, 0);
          this.armarioGrupo.add(prat);
        }
      }
      // Linhas verticais (por enquanto ignoradas, mas podem virar divisórias)
    });

    // --- Preenchimentos (portas/gavetas) ---
    this.manager.preenchimentos.forEach(p => {
      const canvasX = p.x;
      const canvasY = p.y;
      const wTotal = p.w;
      const hTotal = p.h;
      const sub = p.subdivisoes || 1;
      const subW = wTotal / sub;

      const baseX3D = to3D(canvasX, 0).x; // canto esquerdo do preenchimento
      // centro Y do preenchimento
      const centroY3D = to3D(0, canvasY + hTotal / 2).y;

      for (let i = 0; i < sub; i++) {
        const cx = baseX3D + subW / 2 + i * subW;
        const cy = centroY3D;
        const mat = p.tipo === 'porta' ? matPorta : matGaveta;
        const geom = new THREE.BoxGeometry(subW, hTotal, d * 0.8);
        const peca = new THREE.Mesh(geom, mat);
        peca.position.set(cx, cy, profundidade / 2 - (d * 0.8) / 2);
        this.armarioGrupo.add(peca);
      }
    });

    this.scene.add(this.armarioGrupo);
  }

  animar() {
    requestAnimationFrame(() => this.animar());
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
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
