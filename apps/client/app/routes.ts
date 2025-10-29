import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('admin', 'routes/admin.tsx'),
  route(
    '/.well-known/appspecific/com.chrome.devtools.json',
    'routes/debug-null.tsx'
  ),
] satisfies RouteConfig;
