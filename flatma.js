// flatma.js
window.iniciarFlatma = function() {
  const container = document.getElementById('view-flatma');
  if (!container) return;

  // Tenta abrir automaticamente em uma nova aba
  const novaAba = window.open('https://flatma.com/pt/create/designer', '_blank');

  // Se o navegador bloqueou o popup, exibe o botão manual
  if (!novaAba || novaAba.closed || typeof novaAba.closed === 'undefined') {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full gap-4 p-8">
        <i data-lucide="alert-triangle" class="w-12 h-12 text-amber-500"></i>
        <p class="text-slate-600 text-lg font-medium">O popup foi bloqueado pelo navegador.</p>
        <p class="text-slate-500 text-sm">Clique no botão abaixo para abrir o Flatma.</p>
        <button onclick="window.open('https://flatma.com/pt/create/designer', '_blank')" 
                class="btn-primary px-6 py-3 rounded-lg font-bold shadow flex items-center gap-2">
          <i data-lucide="external-link"></i> Abrir Flatma
        </button>
      </div>
    `;
  } else {
    // Se conseguiu abrir, mostra uma confirmação simples
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full gap-4 p-8">
        <i data-lucide="check-circle" class="w-12 h-12 text-green-500"></i>
        <p class="text-slate-600 text-lg font-medium">Flatma foi aberto em uma nova aba.</p>
        <button onclick="window.open('https://flatma.com/pt/create/designer', '_blank')" 
                class="btn-outline px-4 py-2 rounded-lg font-bold flex items-center gap-2">
          <i data-lucide="external-link"></i> Abrir novamente
        </button>
      </div>
    `;
  }

  lucide.createIcons();
};
