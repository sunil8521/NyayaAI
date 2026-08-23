import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rocky Legal — AI Legal Assistant for Advocates",
    short_name: "Rocky Legal",
    description: "India's First Free AI Legal Assistant for Advocates and Legal Professionals",
    start_url: "/",
    display: "standalone",
    background_color: "#0C0A09",
    theme_color: "#C7A064",
    icons: [
      {
        src: "/heroimg.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/heroimg.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
