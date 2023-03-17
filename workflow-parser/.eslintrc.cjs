module.exports = {
  extends: "../.eslintrc.json",
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // TypeScript doesn't correctly detect toString() implementations on the token classes
    "@typescript-eslint/restrict-template-expressions": "off",
  }
}