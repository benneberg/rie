// packages/ui/tailwind.config.js
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: '#050505',
        paper: '#fafafa',
        cyan: '#00ebf9',
        alert: '#ff3b30',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
        label: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
