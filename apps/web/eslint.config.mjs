import coreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...coreWebVitals,
  {
    rules: {
      // Deliberate patterns: next-themes mounted gate, fetch-then-setState loaders.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
