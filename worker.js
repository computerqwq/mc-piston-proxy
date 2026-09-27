const HOME_REDIRECT = 'https://computerqwq.top/';

// 仅保留 Minecraft 原版所需的下载路由
const ROUTES = [
  {
    publicPrefix: '/mc/game/',
    upstreamHost: 'piston-meta.mojang.com',
    upstreamPrefix: '/mc/game/',
  },
  {
    publicPrefix: '/v1/packages/',
    upstreamHost: 'piston-meta.mojang.com',
    upstreamPrefix: '/v1/packages/',
  },
  {
    publicPrefix: '/v1/objects/',
    upstreamHost: 'piston-data.mojang.com',
    upstreamPrefix: '/v1/objects/',
  },
  {
    // /assets/ea/xxx → resources.download.minecraft.net/ea/xxx
    publicPrefix: '/assets/',
    upstreamHost: 'resources.download.minecraft.net',
    upstreamPrefix: '/',
  },
  {
    // /libraries/com/... → libraries.minecraft.net/com/...
    publicPrefix: '/libraries/',
    upstreamHost: 'libraries.minecraft.net',
    upstreamPrefix: '/',
  },
];

function findRoute(path) {
  return [...ROUTES]
    .sort((a, b) => b.publicPrefix.length - a.publicPrefix.length)
    .find(route => path.startsWith(route.publicPrefix));
}

function mapOfficialUrl(value, workerOrigin) {
  try {
    const parsed = new URL(value);

    const routes = [...ROUTES].sort(
      (a, b) => b.upstreamPrefix.length - a.upstreamPrefix.length
    );

    for (const route of routes) {
      if (
        parsed.hostname === route.upstreamHost &&
        parsed.pathname.startsWith(route.upstreamPrefix)
      ) {
        const suffix = parsed.pathname.slice(route.upstreamPrefix.length);
        const workerUrl = new URL(workerOrigin);

        parsed.pathname = route.publicPrefix + suffix;
        parsed.host = workerUrl.host;
        parsed.protocol = workerUrl.protocol;

        return parsed.toString();
      }
    }
  } catch {
    // 无法解析时保留原地址
  }

  return value;
}

export default {
  async fetch(request) {
    const incomingUrl = new URL(request.url);
    const path = incomingUrl.pathname;

    // 访问主页时跳转
    if (path === '/') {
      return Response.redirect(HOME_REDIRECT, 302);
    }

    // CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    const route = findRoute(path);

    if (!route) {
      return new Response('Not Found', { status: 404 });
    }

    // 将公开路径转换为原版资源上游路径
    const suffix = path.slice(route.publicPrefix.length);
    const upstreamPath = route.upstreamPrefix + suffix;
    const upstreamUrl = new URL(
      upstreamPath + incomingUrl.search,
      `https://${route.upstreamHost}`
    );

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('cf-connecting-ip');

    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method)
        ? undefined
        : request.body,
      redirect: 'manual',
    });

    try {
      const upstreamResponse = await fetch(upstreamRequest);
      const responseHeaders = new Headers(upstreamResponse.headers);

      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set(
        'Access-Control-Allow-Methods',
        'GET, HEAD, OPTIONS'
      );
      responseHeaders.set('Access-Control-Allow-Headers', '*');

      // 改写上游重定向地址
      const location = responseHeaders.get('Location');

      if (location) {
        try {
          const absoluteLocation = new URL(location, upstreamUrl).toString();
          responseHeaders.set(
            'Location',
            mapOfficialUrl(absoluteLocation, incomingUrl.origin)
          );
        } catch {
          // 无法解析时保留原 Location
        }
      }

      const contentType = responseHeaders.get('Content-Type') || '';
      const isText = /json|text|xml|javascript|manifest/i.test(contentType);

      // 改写文本内容中的原版官方资源 URL
      if (isText && upstreamResponse.body && request.method !== 'HEAD') {
        let text = await upstreamResponse.text();

        text = text.replace(
          /https?:\/\/[^"'\\\s<>]+/g,
          value => mapOfficialUrl(value, incomingUrl.origin)
        );

        responseHeaders.delete('Content-Length');
        responseHeaders.delete('Content-Encoding');
        responseHeaders.delete('ETag');

        return new Response(text, {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: responseHeaders,
        });
      }

      return new Response(
        request.method === 'HEAD' ? null : upstreamResponse.body,
        {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: responseHeaders,
        }
      );
    } catch (err) {
      return new Response(`代理请求失败：${err.message}`, {
        status: 502,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};