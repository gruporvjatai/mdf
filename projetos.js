// projetos.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class ConfiguradorArmario {
  constructor(container) {
    this.container = container;
    this.params = {
      largura: 200,   // cm
      altura: 220,
      profundidade: 60,
      numPrateleiras: 3,
      espessura: 1.8, // cm
      corCorpo: '#A67B5B',
      corPorta: '#8B5A2B',
    };
    this.init();
  }

  async init() {
    this.criarInterface();
    try {
      this.criarCena();
      this.animar();
    } catch (e) {
      console.error('Erro ao criar a cena 3D:', e);
      document.getElementById('canvas-container').innerHTML = 
        '<p class="text-red-500 p-4">Erro ao carregar o visualizador 3D. Veja o console (F12).</p>';
    }
  }

  criarInterface() {
    this.container.innerHTML = `
      <div class="flex flex-col lg:flex-row gap-4 h-full">
        <div class="lg:w-1/4 bg-white rounded-xl shadow border p-4 space-y-4 overflow-y-auto">
          <h3 class="text-lg font-bold text-slate-800">Parâmetros</h3>
          <div>
            <label class="block text-sm font-medium text-slate-600">Largura (cm)</label>
            <input type="range" id="inp-largura" min="80" max="400" value="${this.params.largura}" class="w-full">
            <span id="val-largura" class="text-xs">${this.params.largura} cm</span>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-600">Altura (cm)</label>
            <input type="range" id="inp-altura" min="100" max="280" value="${this.params.altura}" class="w-full">
            <span id="val-altura">${this.params.altura} cm</span>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-600">Profundidade (cm)</label>
            <input type="range" id="inp-profundidade" min="30" max="70" value="${this.params.profundidade}" class="w-full">
            <span id="val-profundidade">${this.params.profundidade} cm</span>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-600">Prateleiras</label>
            <input type="range" id="inp-prateleiras" min="0" max="8" value="${this.params.numPrateleiras}" class="w-full">
            <span id="val-prateleiras">${this.params.numPrateleiras}</span>
          </div>
          <button id="btn-exportar-medidas" class="w-full btn-primary px-4 py-2 rounded-lg font-bold shadow">
            📐 Exportar Peças
          </button>
          <textarea id="output-medidas" rows="6" class="w-full p-2 border rounded text-xs bg-slate-50" readonly></textarea>
        </div>
        <div class="flex-1 relative rounded-xl overflow-hidden border shadow" id="canvas-container" style="min-height: 400px; background: #e2e8f0;"></div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const atualizar = () => {
      this.params.largura = parseFloat(document.getElementById('inp-largura').value);
      this.params.altura = parseFloat(document.getElementById('inp-altura').value);
      this.params.profundidade = parseFloat(document.getElementById('inp-profundidade').value);
      this.params.numPrateleiras = parseInt(document.getElementById('inp-prateleiras').value);

      document.getElementById('val-largura').innerText = `${this.params.largura} cm`;
      document.getElementById('val-altura').innerText = `${this.params.altura} cm`;
      document.getElementById('val-profundidade').innerText = `${this.params.profundidade} cm`;
      document.getElementById('val-prateleiras').innerText = this.params.numPrateleiras;

      this.reconstruirModelo();
    };

    ['inp-largura','inp-altura','inp-profundidade','inp-prateleiras'].forEach(id => {
      document.getElementById(id).addEventListener('input', atualizar);
    });

    document.getElementById('btn-exportar-medidas').addEventListener('click', () => this.exportarPecas());
  }

  criarCena() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f1f5f9');

    const container = document.getElementById('canvas-container');
    if (!container) throw new Error('Container canvas-container não encontrado.');

    // Garantir dimensões mínimas para o canvas
    const w = container.clientWidth || 600;
    const h = container.clientHeight || 400;

    this.camera = new THREE.PerspectiveCamera(45, w / h, 10, 1000);
    this.camera.position.set(250, 180, 300);
    this.camera.lookAt(0, 120, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Luzes
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(100, 200, 150);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 600;
    this.scene.add(dirLight);

    // Controles de órbita (com verificação)
    try {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.set(0, 120, 0);
      this.controls.update();
    } catch (e) {
      console.warn('OrbitControls não carregou. O modelo ficará estático.', e);
    }

    // Chão simples
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.reconstruirModelo();
  }

  reconstruirModelo() {
    // Remove móveis antigos
    while(this.scene.children.find(c => c.userData?.tipo === 'armario')) {
      this.scene.remove(this.scene.children.find(c => c.userData?.tipo === 'armario'));
    }

    const { largura, altura, profundidade, numPrateleiras, espessura, corCorpo, corPorta } = this.params;
    const grupo = new THREE.Group();
    grupo.userData = { tipo: 'armario' };

    // Materiais
    const matCorpo = new THREE.MeshStandardMaterial({ color: corCorpo, roughness: 0.5 });
    const matPorta = new THREE.MeshStandardMaterial({ color: corPorta, roughness: 0.4 });

    // Converter cm para unidades Three.js (1 = 1 cm)
    const d = espessura;

    // Laterais (esquerda, direita)
    const lateralGeo = new THREE.BoxGeometry(d, altura, profundidade);
    const lateralEsq = new THREE.Mesh(lateralGeo, matCorpo);
    lateralEsq.position.set(-largura/2 + d/2, altura/2, 0);
    lateralEsq.castShadow = true; lateralEsq.receiveShadow = true;
    grupo.add(lateralEsq);
    const lateralDir = new THREE.Mesh(lateralGeo, matCorpo);
    lateralDir.position.set(largura/2 - d/2, altura/2, 0);
    lateralDir.castShadow = true; lateralDir.receiveShadow = true;
    grupo.add(lateralDir);

    // Fundo
    const fundoGeo = new THREE.BoxGeometry(largura - 2*d, d, profundidade);
    const fundo = new THREE.Mesh(fundoGeo, matCorpo);
    fundo.position.set(0, d/2, 0);
    fundo.castShadow = true; fundo.receiveShadow = true;
    grupo.add(fundo);

    // Teto
    const tetoGeo = new THREE.BoxGeometry(largura, d, profundidade);
    const teto = new THREE.Mesh(tetoGeo, matCorpo);
    teto.position.set(0, altura - d/2, 0);
    teto.castShadow = true; teto.receiveShadow = true;
    grupo.add(teto);

    // Prateleiras internas
    if (numPrateleiras > 0 && altura > 2*d) {
      const alturaUtil = altura - 2*d;
      const passo = alturaUtil / (numPrateleiras + 1);
      const prateleiraGeo = new THREE.BoxGeometry(largura - 2*d, d, profundidade - 2*d);
      for (let i = 1; i <= numPrateleiras; i++) {
        const prateleira = new THREE.Mesh(prateleiraGeo, matCorpo);
        prateleira.position.set(0, d + i * passo - d/2, 0);
        prateleira.castShadow = true; prateleira.receiveShadow = true;
        grupo.add(prateleira);
      }
    }

    // Portas de correr (duas, sobrepostas)
    const larguraPorta = (largura - 2*d) / 2 + d*0.5; // pequena sobreposição
    const portaGeo = new THREE.BoxGeometry(larguraPorta, altura - 2*d, d*0.6);
    const portaEsq = new THREE.Mesh(portaGeo, matPorta);
    portaEsq.position.set(-largura/2 + d + larguraPorta/2, altura/2, profundidade/2 - d*0.3);
    portaEsq.castShadow = true; portaEsq.receiveShadow = true;
    grupo.add(portaEsq);
    const portaDir = new THREE.Mesh(portaGeo, matPorta);
    portaDir.position.set(largura/2 - d - larguraPorta/2, altura/2, profundidade/2 - d*0.3 + d*0.6); // deslocada para trás
    portaDir.castShadow = true; portaDir.receiveShadow = true;
    grupo.add(portaDir);

    // Puxadores (pequenas esferas)
    const puxGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const matPux = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8, roughness: 0.2 });
    const posXPux = largura/2 - d - 10;
    const pux1 = new THREE.Mesh(puxGeo, matPux);
    pux1.position.set(posXPux, altura*0.75, profundidade/2 + 1);
    grupo.add(pux1);
    const pux2 = new THREE.Mesh(puxGeo, matPux);
    pux2.position.set(posXPux, altura*0.25, profundidade/2 + 1);
    grupo.add(pux2);

    this.scene.add(grupo);
  }

  animar() {
    requestAnimationFrame(() => this.animar());
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  exportarPecas() {
    const { largura, altura, profundidade, numPrateleiras, espessura } = this.params;
    const d = espessura;
    const pecas = [];

    // Laterais
    pecas.push({ nome: 'Lateral Esquerda', qtd: 1, dim: `${d} x ${altura} x ${profundidade} cm` });
    pecas.push({ nome: 'Lateral Direita', qtd: 1, dim: `${d} x ${altura} x ${profundidade} cm` });
    // Fundo
    pecas.push({ nome: 'Fundo', qtd: 1, dim: `${largura - 2*d} x ${d} x ${profundidade} cm` });
    // Teto
    pecas.push({ nome: 'Teto', qtd: 1, dim: `${largura} x ${d} x ${profundidade} cm` });
    // Prateleiras
    if (numPrateleiras > 0) {
      pecas.push({ nome: 'Prateleira', qtd: numPrateleiras, dim: `${largura - 2*d} x ${d} x ${profundidade - 2*d} cm` });
    }
    // Portas
    pecas.push({ nome: 'Porta (correr)', qtd: 2, dim: `${(largura - 2*d) / 2 + d*0.5} x ${altura - 2*d} x ${d*0.6} cm` });

    const textArea = document.getElementById('output-medidas');
    if (textArea) {
      textArea.value = pecas.map(p => `${p.nome} (${p.qtd}x): ${p.dim}`).join('\n');
    }
  }
}

// Função chamada pelo sistema ao ativar a aba Projetos
window.iniciarProjetos = function() {
  const container = document.getElementById('view-projetos');
  if (!container) return;
  // Verifica se já foi inicializado
  if (container.dataset.projetoIniciado === 'true') return;
  container.dataset.projetoIniciado = 'true';
  container.classList.remove('p-8', 'text-center', 'text-slate-500');
  container.innerHTML = ''; // limpa placeholder
  new ConfiguradorArmario(container);
};
