// GitHub Pages 项目站点部署在 /star-social-dashboard/ 子路径下，
// 使用相对 base 保证资源引用在子路径与本地 dev/preview 下均可用。
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
});
