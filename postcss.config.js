// Tailwind 4 is wired via @tailwindcss/vite in vite.config.ts and handles
// vendor prefixing internally, so this is a no-op config kept only so tooling
// that probes for PostCSS finds a valid (empty) pipeline.
export default {
  plugins: {},
};
