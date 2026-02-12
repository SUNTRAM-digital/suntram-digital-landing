const btn = document.getElementById('btn');
const out = document.getElementById('out');

btn.addEventListener('click', () => {
  const now = new Date();
  out.textContent = `JS OK — ${now.toLocaleString()}`;
});
