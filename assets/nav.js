// Barra superior en una fila: centra la página actual al cargar y marca con un degradado el lado
// por el que hay más secciones. Solo presentación; sin la barra (portada) no hace nada.
const nav = document.querySelector(".navegacion");

function bordes() {
  const max = nav.scrollWidth - nav.clientWidth;
  nav.classList.toggle("mas-izq", nav.scrollLeft > 4);
  nav.classList.toggle("mas-der", nav.scrollLeft < max - 4);
}

if (nav) {
  const actual = nav.querySelector('[aria-current="page"]');
  if (actual) nav.scrollLeft = actual.offsetLeft - (nav.clientWidth - actual.offsetWidth) / 2;
  bordes();
  nav.addEventListener("scroll", bordes, { passive: true });
  window.addEventListener("resize", bordes);
}
