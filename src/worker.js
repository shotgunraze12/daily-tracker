import { onRequest } from '../functions/api/[[path]].js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.slice(5).split('/').filter(Boolean);
    return onRequest({ request, env, params: { path } });
  },
};
