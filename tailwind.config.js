/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,html,jsx}",
    "./piapp/**/*.{js,html,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Compiled version colors
        'background': 'hsl(var(--background))',
        'foreground': 'hsl(var(--foreground))',
        'card': 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        'border': 'hsl(var(--border))',
        'input': 'hsl(var(--input))',
        'ring': 'hsl(var(--ring))',
        'primary': 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        'secondary': 'hsl(var(--secondary))',
        'secondary-foreground': 'hsl(var(--secondary-foreground))',
        'muted': 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        'accent': 'hsl(var(--accent))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        'destructive': 'hsl(var(--destructive))',
        'destructive-foreground': 'hsl(var(--destructive-foreground))',
        // Brand colors from the app
        'brand-dark': '#1a2140',
        'brand-darker': '#0f1529',
        'brand-accent': '#6366f1',
        'bg-cream': '#f5f2eb',
        'bg-light': '#ffffff',
        'text-primary': '#1a1a1a',
        'text-secondary': '#666666',
        'accent-green': '#10b981',
        'accent-blue': '#3b82f6',
        'accent-purple': '#8b5cf6',
        'accent-orange': '#f59e0b',
        'accent-red': '#ef4444',
      },
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      }
    },
  },
  plugins: [],
}