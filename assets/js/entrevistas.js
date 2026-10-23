/* ------------------------------------------------------------
   Entrevistas: vista previa del video de YouTube, sin audio,
   que se reproduce cuando la tarjeta entra en pantalla y se
   pausa cuando sale. El clic abre el video en YouTube.
   ------------------------------------------------------------ */
const interviewMedia = document.querySelectorAll('.interview__media[data-yt]');

// prefersReducedMotion viene de main.js, que se carga antes
const saveData = navigator.connection && navigator.connection.saveData;

function sendCommand(iframe, func) {
  if (!iframe.contentWindow) return;
  iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
}

function createPlayer(media) {
  const id = media.dataset.yt;
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    loop: '1',
    playlist: id,
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    disablekb: '1',
    iv_load_policy: '3',
    enablejsapi: '1',
  });

  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/${id}?${params}`;
  iframe.title = 'Vista previa sin audio';
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
  iframe.tabIndex = -1;
  iframe.setAttribute('aria-hidden', 'true');

  // Le pide al reproductor que avise sus cambios de estado (ver listener de 'message')
  iframe.addEventListener('load', () => {
    iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening', id, channel: 'widget' }), '*');
  });

  media.prepend(iframe);
  return iframe;
}

// La miniatura solo se oculta cuando YouTube confirma que el video está corriendo;
// si no arranca (sin conexión, inserción bloqueada), la miniatura queda visible.
window.addEventListener('message', (event) => {
  if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(event.origin)) return;

  let data;
  try {
    data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
  } catch {
    return;
  }

  // 1 = reproduciendo; 3 = cargando, se ignora para no mostrar el fondo negro
  const state = data && data.info && data.info.playerState;
  if (state === undefined || state === 3) return;

  interviewMedia.forEach((media) => {
    const iframe = media.querySelector('iframe');
    if (iframe && iframe.contentWindow === event.source) {
      media.classList.toggle('is-playing', state === 1);
    }
  });
});

// Si la miniatura en alta resolución no existe, usa la de calidad estándar
interviewMedia.forEach((media) => {
  const thumb = media.querySelector('.interview__thumb');
  thumb.addEventListener('error', () => {
    thumb.src = `https://i.ytimg.com/vi/${media.dataset.yt}/hqdefault.jpg`;
  }, { once: true });
});

if ('IntersectionObserver' in window && !prefersReducedMotion && !saveData) {
  const players = new Map();

  const videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const media = entry.target;
        const iframe = players.get(media);

        if (entry.isIntersecting) {
          if (!iframe) {
            players.set(media, createPlayer(media));
          } else {
            sendCommand(iframe, 'playVideo');
          }
        } else if (iframe) {
          sendCommand(iframe, 'pauseVideo');
        }
      });
    },
    { threshold: 0.5 }
  );

  interviewMedia.forEach((media) => videoObserver.observe(media));
}
