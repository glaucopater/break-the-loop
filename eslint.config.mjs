import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", ".yarn/**", "data/**", ".pnp.cjs", ".pnp.loader.mjs", "scripts/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
);
