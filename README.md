# Growing Women in Business — website

The site for [growingwomeninbusiness.com](https://growingwomeninbusiness.com/).
Push to GitHub → Railway automatically builds and deploys. No CLI, no secrets in the repo.

## What's here

| File | Purpose |
|------|---------|
| `public/index.html` | Home page placeholder. Replace with the real site. |
| `public/css/site.css` | Shared styles. |
| `index.js` | Small Node server that serves `/public`. Binds to `process.env.PORT` and `0.0.0.0` for Railway. |
| `package.json` | Defines `npm start` — Railway runs this to launch the app. |
| `railway.json` | Tells Railway how to build (Nixpacks) and start the app. |
| `.gitignore` | Keeps `node_modules`, `.env`, and secrets out of git. |

## Run it locally

```bash
npm start          # then open http://localhost:3000
PORT=4173 npm start # or pick your own port
```

## The pipeline (one-time setup)

1. Create a GitHub repo and push this code to it.
2. Connect the repo to Railway (railway.app → New Project → Deploy from GitHub repo).
3. Railway builds + deploys on every push to `main` from then on.
4. Add the `growingwomeninbusiness.com` domain in Railway → Settings → Domains, then point the DNS
   at your registrar to what Railway gives you.

## After setup: the daily loop

```bash
git add .
git commit -m "your change"
git push
```

Railway detects the push and redeploys automatically. Watch it in the Railway dashboard → Deployments.

## Important: environment variables & secrets

Never commit secrets. Add them in **Railway → your service → Variables**. Railway also injects `PORT` at
runtime — your app must bind to `process.env.PORT` and host `0.0.0.0` (the placeholder already does).
