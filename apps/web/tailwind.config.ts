import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", "class"],
  content: [
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			abyss: '#10192a',
  			midnight: '#12223b',
  			'siphon-teal': '#6af5d6',
  			'deep-violet': '#2dbfbc',
  			foam: '#d5f4ff',
  			ghost: '#7ca4bb',
  			ember: '#ffd66b',
  			current: '#ff8f70'
  		},
  		fontFamily: {
  			sans: [
  				'VT323',
  				'ui-monospace',
  				'monospace'
  			],
  			display: [
  				'Press Start 2P',
  				'ui-monospace',
  				'monospace'
  			],
  			mono: [
  				'JetBrains Mono',
  				'monospace'
  			]
  		},
  		animation: {
  			'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
  			'drift': 'drift 20s linear infinite',
  			'float': 'float 6s ease-in-out infinite',
  			'shimmer': 'shimmer 2s linear infinite',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
  		keyframes: {
  			'glow-pulse': {
  				'0%, 100%': {
  					opacity: '0.4',
  					filter: 'blur(8px)'
  				},
  				'50%': {
  					opacity: '0.8',
  					filter: 'blur(12px)'
  				}
  			},
  			drift: {
  				'0%': {
  					transform: 'translate(0, 0)'
  				},
  				'25%': {
  					transform: 'translate(10px, -20px)'
  				},
  				'50%': {
  					transform: 'translate(-5px, -10px)'
  				},
  				'75%': {
  					transform: 'translate(-15px, 5px)'
  				},
  				'100%': {
  					transform: 'translate(0, 0)'
  				}
  			},
  			float: {
  				'0%, 100%': {
  					transform: 'translateY(0)'
  				},
  				'50%': {
  					transform: 'translateY(-10px)'
  				}
  			},
  			shimmer: {
  				'0%': {
  					backgroundPosition: '-200% 0'
  				},
  				'100%': {
  					backgroundPosition: '200% 0'
  				}
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
