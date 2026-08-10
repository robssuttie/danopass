import { onRequestGet as __api_generate_js_onRequestGet } from "C:\\Users\\Rob\\Downloads\\DanoPass\\functions\\api\\generate.js"

export const routes = [
    {
      routePath: "/api/generate",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_generate_js_onRequestGet],
    },
  ]