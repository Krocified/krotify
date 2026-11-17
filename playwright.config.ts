// Playwright only auto-discovers a config in the working directory. Keep the
// suite configuration in e2e/ and re-export it so `npx playwright test` and
// `npm run e2e` both work from the repository root.
export { default } from './e2e/playwright.config';
