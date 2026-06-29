/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// IMPORTANT (GitHub Pages): the app is served from a repo subpath, so `base`
// must match the repository name exactly, surrounded by slashes. If you fork or
// rename the repo, change this string. For a user/organization page served from
// the domain root, set base to '/'.
const REPO_BASE = '/annual-leave-accural-calculator/';

export default defineConfig({
  base: REPO_BASE,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
