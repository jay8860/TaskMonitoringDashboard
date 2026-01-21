/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Outfit', 'sans-serif'],
            },
            colors: {
                primary: {
                    light: '#4f46e5', // Indigo 600
                    DEFAULT: '#4f46e5',
                    dark: '#3730a3',
                },
                dark: {
                    bg: '#000000',    // Pitch Black
                    card: '#121212',  // Very Dark Grey
                    text: '#f8fafc',  // Slate 50
                }
            }
        },
    },
    plugins: [],
}
