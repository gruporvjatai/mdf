// flatma.js
window.iniciarFlatma = function() {
  const container = document.getElementById('view-flatma');
  if (!container || container.dataset.flatmaIniciado === 'true') return;
  container.dataset.flatmaIniciado = 'true';
  container.innerHTML = `
    <iframe 
      src="https://flatma.com/pt/create/designer" 
      style="width: 100%; height: calc(100vh - 80px); border: none;"
      allow="camera; geolocation; clipboard-write"
      title="Flatma Designer"
    ></iframe>
  `;
};
