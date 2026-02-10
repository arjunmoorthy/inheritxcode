/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: ['selector', '[data-theme="dark"]'], // Enable dark mode using data-theme attribute
    theme: {
        extend: {
            colors: {
                // OncoLife Patient Portal Brand Colors (Healing Teal + Soft Lavender)
                primary: {
                    DEFAULT: '#00897B',      // Healing Teal
                    light: '#4DB6AC',
                    dark: '#00695C',
                },
                secondary: {
                    DEFAULT: '#7E57C2',      // Soft Lavender
                    light: '#B388FF',
                    dark: '#5E35B1',
                },
                background: '#F5F7FA',
                paper: '#FFFFFF',
            },
            fontFamily: {
                sans: ['Source Sans Pro', 'sans-serif'],
                serif: ['Georgia', 'serif'],
            },
        },
    },
    plugins: [],
    // Important: This prevents Tailwind from conflicting with styled-components
    corePlugins: {
        preflight: true,
    },
}
