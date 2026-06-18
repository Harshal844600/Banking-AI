Security init notes for insight-bank-ai

What I added:

- Content Security Policy (CSP) meta tag injected in the root head (`src/routes/__root.tsx`).
- `.env.example` with common runtime variables and guidance.
- `security:audit` and `security:fix` scripts in `package.json`.
- `eslint-plugin-security` added to `devDependencies` and local ESLint config (`.eslintrc.cjs`).

Next recommended steps:

1. Review the CSP and add explicit host entries (supabase, third-party APIs) as needed.
2. Add runtime server-side security headers when serving production (hosting provider config or server middleware).
3. Store secrets in CI / hosting env variables, not in git.
4. Consider adding automated scans (Snyk or GitHub Dependabot) and a CI step to run `npm audit`.
