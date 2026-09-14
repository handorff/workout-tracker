export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                ink: "#000000",
                mist: "#ffffff",
                muted: "#000000",
                card: "#ffffff",
                line: "#d4d4d4",
                accent: "#f7da21",
            },
            fontFamily: {
                sans: ["Arial", "Helvetica", "sans-serif"],
                display: ["Arial", "Helvetica", "sans-serif"],
            },
            borderRadius: {
                card: "8px",
            },
        },
    },
    plugins: [],
};
