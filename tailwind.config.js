/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'void':     '#05070a',   // true black canvas — page background
        'base':     '#0b0e13',   // app shell bg
        'surface':  '#111620',   // card background
        'raised':   '#181e2c',   // elevated card / modal
        'overlay':  '#1f2738',   // dropdown / tooltip bg
        'border':   'rgba(255,255,255,0.08)',
        'accent':   '#4f8ef7',   // electric cobalt — primary CTA
        'ok':       '#3dd68c',   // available / success
        'warn':     '#f5a623',   // rating / warning / due soon
        'danger':   '#f05252',   // overdue / error / delete
        'waitlist': '#c084fc',   // waitlist / queue status
        'muted':    'rgba(255,255,255,0.45)', // secondary text
        'ghost':    'rgba(255,255,255,0.18)', // tertiary text
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],    // book titles, hero headings
        ui:      ['DM Sans', 'system-ui', 'sans-serif'], // all UI labels
        mono:    ['IBM Plex Mono', 'monospace'],      // ratings, IDs, audit log
      },
      borderRadius: {
        'card': '12px',
        'pill': '999px',
      },
    },
  },
  plugins: [],
}
