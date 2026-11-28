import { onRequest } from '../functions/api/[[path]].js';
import { handleMeals } from './meals.js';
import { handleRecipes } from './recipes.js';
import { handleGoals } from './goals.js';
import { handleHx } from './hx.js';
import { handleStock } from './stock.js';

const MODULES = { meals: handleMeals, recipes: handleRecipes, goals: handleGoals, hx: handleHx, stock: handleStock };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.slice(5).split('/').filter(Boolean);
    const mod = MODULES[path[0]];
    if (mod) {
      // pakai login yang sama: verifikasi sesi lewat endpoint state yang sudah ada
      const cek = new Request(new URL('/api/state', request.url), { headers: { cookie: request.headers.get('Cookie') || '' } });
      const who = await onRequest({ request: cek, env, params: { path: ['state'] } });
      if (!who.ok) return who;
      const { me } = await who.json();
      return mod(request, env, path, me);
    }
    return onRequest({ request, env, params: { path } });
  },
};
