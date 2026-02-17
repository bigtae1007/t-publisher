# Repository Guidelines

## Project Structure & Module Organization
Core source lives in `src/`:
- `src/server.ts`: Express API (`GET /`, `POST /publish`) for on-demand publishing.
- `src/publishBatch.ts`: batch entry point that fetches content from `SERVER_URI`.
- `src/publisher.ts`: Playwright-based Tistory automation flow.
- `src/s3.ts`: S3 helpers for downloading/uploading `auth.json`.

Compiled output is written to `dist/` via TypeScript (`tsc`). CI workflow is in `.github/workflows/publish.yml`.

## Build, Test, and Development Commands
- `npm run dev`: run the API server with `ts-node` for local development.
- `npm run dev:p`: run the batch publisher directly from TypeScript.
- `npm run build`: compile `src/` to `dist/`.
- `npm run start`: run compiled server (`dist/server.js`).
- `npm run batch`: run compiled batch job (`dist/publishBatch.js`).

Example local flow: `npm run build && npm run batch`.

## Coding Style & Naming Conventions
- Language: TypeScript with `strict` mode enabled (`tsconfig.json`).
- Indentation: 4 spaces; keep existing brace/spacing style consistent.
- Naming: `camelCase` for variables/functions, `PascalCase` for interfaces/types, descriptive file names matching responsibility (for example `publishBatch.ts`).
- Prefer small, focused modules in `src/`; keep side effects (env loading, process exit) near entry points.

## Testing Guidelines
There is currently no dedicated test framework configured (`npm test` is not defined).  
Until tests are added:
- Validate changes by running relevant scripts (`npm run build`, `npm run dev`, `npm run batch`).
- For automation changes, verify Playwright login/publish flow in a safe environment before merging.
- If adding tests, place them under `src/` or a new `tests/` folder and document the command in `package.json`.

## Commit & Pull Request Guidelines
Recent history uses short, task-focused commits (often Korean). Follow that pattern with one clear change per commit.
- Good format: `<area>: <what changed>` (for example `publisher: handle expired session`).
- Keep commit messages specific; avoid combining unrelated refactors and behavior changes.

PRs should include:
- Purpose and scope.
- Environment/secret changes (`.env`, GitHub Actions secrets).
- How you validated the change (commands run, manual checks).

## Security & Configuration Tips
- Never commit real secrets in `.env` or credentials in `auth.json`.
- Use GitHub Actions secrets for production automation.
- Confirm required env vars before running batch jobs: `KAKAO_ID`, `KAKAO_PW`, `URL_T`, `AWS_*`, `S3_*`, `SERVER_URI`.
