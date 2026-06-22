import { showLoading, hideLoading } from './utils.js';

class Router {
  constructor() {
    this.routes = {};
    this.currentPage = null;
    this.beforeHooks = [];
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  addRoute(path, handler, requiresAuth = true, roles = []) {
    this.routes[path] = { handler, requiresAuth, roles };
    return this;
  }

  addBeforeHook(fn) {
    this.beforeHooks.push(fn);
    return this;
  }

  navigate(path) {
    window.location.hash = path;
  }

  getCurrentPath() {
    return window.location.hash.replace(/^#/, '') || '/login';
  }

  async handleRoute() {
    const path = this.getCurrentPath();
    const route = this.routes[path];

    if (!route) {
      this.navigate('/login');
      return;
    }

    for (const hook of this.beforeHooks) {
      const result = hook(path, route);
      if (result === false) return;
    }

    showLoading();
    try {
      if (this.currentPage && this.currentPage.unmount) {
        this.currentPage.unmount();
      }
      this.currentPage = await route.handler();
    } catch (err) {
      console.error('Route handler error:', err);
    } finally {
      hideLoading();
    }
  }

  start() {
    this.handleRoute();
  }
}

export default new Router();
