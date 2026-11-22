import { onRequest } from '../functions/api/[[path]].js';
import { handleMeals } from './meals.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.slice(5).split('/').filter(Boolean);
    if (path[0] === 'meals') {
      // pakai login yang sama: verifikasi sesi lewat endpoint state yang sudah ada
      const cek = new Request(new URL('/api/state', request.url), { headers: { cookie: request.headers.get('Cookie') || '' } });
      const who = await onRequest({ request: cek, env, params: { path: ['state'] } });
      if (!who.ok) return who;
      const { me } = await who.json();
      return handleMeals(request, env, path, me);
    }
    return onRequest({ request, env, params: { path } });
  },
};
