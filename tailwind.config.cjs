/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        // Landing page: Cinzel echoes the classical capitals of the "MR & MS" logotype
        crown: ['Cinzel', 'Georgia', 'serif'],
        stage: ['Manrope', 'system-ui', 'sans-serif']
      },
      colors: {
        // Sampled from the pageant logo: black field, crown gold, sunset arch
        stage: {
          night: '#0d0907',
          velvet: '#1a120d',
          line: '#2e2219',
          gold: '#f2b33d',
          sunset: '#ef7a2b',
          ember: '#d8461f',
          alert: '#f3906f',
          ivory: '#f6eedf',
          muted: '#b3a690'
        }
      }
    }
  },
  plugins: []
};



