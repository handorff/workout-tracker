export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                ink: "#172126",
                mist: "#f6f4ef",
                muted: "#5c665e",
                card: "#ffffff",
                line: "rgba(23, 33, 38, 0.08)",
                success: "#3e8a58",
                accent: "#c8833f",
            },
            fontFamily: {
                sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
                display: ["Space Grotesk", "IBM Plex Sans", "sans-serif"],
            },
            boxShadow: {
                card: "0 12px 30px rgba(23, 33, 38, 0.06)",
            },
            borderRadius: {
                card: "24px",
            },
        },
    },
    plugins: [],
};
