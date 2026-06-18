module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  extends: ["eslint:recommended", "plugin:react/recommended", "plugin:prettier/recommended"],
  plugins: ["react", "prettier", "security"],
  rules: {
    // project-specific rules
    "security/detect-object-injection": "off",
  },
};
