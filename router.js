const defaultRoute = '/';
let currentRoute = defaultRoute;
let renderFn = () => {};

function normalize(hash) {
  if (!hash || hash === '#') return defaultRoute;
  const value = hash.startsWith('#') ? hash.slice(1) : hash;
  return value || defaultRoute;
}

export function initRouter(render) {
  renderFn = render;
  window.addEventListener('hashchange', handleChange);
  if (!window.location.hash) {
    window.location.hash = defaultRoute;
  } else {
    handleChange();
  }
}

function handleChange() {
  const path = normalize(window.location.hash);
  currentRoute = path;
  renderFn(path);
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  });
}

export function getCurrentRoute() {
  return currentRoute;
}

export function navigate(path) {
  if (!path.startsWith('#')) {
    window.location.hash = `#${path}`;
  } else {
    window.location.hash = path;
  }
}
