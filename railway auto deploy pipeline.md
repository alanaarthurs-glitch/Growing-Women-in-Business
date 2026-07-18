# Railway Auto-Deploy Pipeline

Push to GitHub → Railway automatically builds and deploys. No CLI, no secrets in the repo.

## What's here

| File | Purpose |
|------|---------|
| `index.js` | Placeholder web service. Replace with your real app. |
| `package.json` | Defines `npm start` — Railway runs this to launch the app. |
| `railway.json` | Tells Railway how to build (Nixpacks) and start the app. |
| `.gitignore` | Keeps `node_modules`, `.env`, and secrets out of git. |

## The pipeline (one-time setup)

1. **Create a GitHub repo** and push this code to it.
2. **Connect the repo to Railway** (railway.app → New Project → Deploy from GitHub repo).
3. Railway builds + deploys on every push to `main` from then on.

See the full step-by-step below.

## After setup: the daily loop

```bash
# make changes, then:
git add .
git commit -m "your change"
git push
```

Railway detects the push and redeploys automatically. Watch it in the Railway dashboard → Deployments.

## Important: environment variables & secrets

Never commit secrets. Add them in **Railway → your service → Variables**. Railway also injects `PORT` at
runtime — your app must bind to `process.env.PORT` and host `0.0.0.0` (the placeholder already does).

## Replacing the placeholder with your real app

- Node app: overwrite `index.js` / add your source, and update the `start` script in `package.json`.
- Other language (Python, Go, etc.): remove the Node files and add your project. Railway's Nixpacks
  auto-detects most stacks. Set the start command in `railway.json` or the Railway dashboard.
