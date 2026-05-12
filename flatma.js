// flatma.js
window.iniciarFlatma = function() {
  const container = document.getElementById('view-flatma');
  if (!container) return;
  
  // Em vez de iframe, mostra uma mensagem e um botão para abrir em nova aba
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full gap-4 p-8">
      <i data-lucide="external-link" class="w-12 h-12 text-slate-400"></i>
      <p class="text-slate-600 text-lg font-medium">Flatma não permite incorporação direta.</p>
      <p class="text-slate-500 text-sm">Clique no botão abaixo para abrir em uma nova aba.</p>
      <button onclick="window.open('https://flatma.com/pt/create/designer', '_blank')" 
              class="btn-primary px-6 py-3 rounded-lg font-bold shadow flex items-center gap-2">
        <i data-lucide="external-link"></i> Abrir Flatma
      </button>
    </div>
  `;
  
  lucide.createIcons();
};
