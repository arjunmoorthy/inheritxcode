/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // OncoLife Doctor Portal Brand Colors
                primary: {
                    DEFAULT: '#1E3A5F',
                    light: '#2E5077',
                    dark: '#0F2942',
                },
                secondary: {
                    DEFAULT: '#2563EB',
                    light: '#3B82F6',
                },
                accent: '#0D9488',
                background: '#F8FAFC',
                paper: '#FFFFFF',
            },
            fontFamily: {
                sans: ['DM Sans', 'sans-serif'],
                serif: ['Fraunces', 'Georgia', 'serif'],
            },
        },
    },
    plugins: [],
    // Important: This prevents Tailwind from conflicting with styled-components
    corePlugins: {
        preflight: true, // Keep this true for basic resets, but be aware it might affect styled-components slightly
    },
}
