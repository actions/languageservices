module.exports = {
  extends: "../.eslintrc.json",
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // Conflicts with the expression data Array class
    "@typescript-eslint/no-array-constructor": "off",
  },
}