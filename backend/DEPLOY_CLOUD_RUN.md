# Deploying the backend to Google Cloud Run

The backend runs as one container on Cloud Run. Cloud Run shuts it down after a
few minutes with no requests, so an app this size normally stays inside the
free allowance. The first request after an idle period takes a few seconds while
the container starts.

The frontend stays on Vercel and the database stays on MongoDB Atlas.

Every command below runs from the **repository root** (`E:\Eye care ERP`).
Replace `PROJECT_ID`, `PROJECT_NUMBER` and `REGION` with your own values.

## 1. One-time Google Cloud setup

1. Create a project at <https://console.cloud.google.com/projectcreate> and link
   a billing account. Cloud Run needs a card on file even for free usage.
2. Go to **Billing → Budgets & alerts** and create a budget of **$1** with email
   alerts. A budget only sends alerts: it never stops spending, so
   `--max-instances` in step 4 is your real cap.
3. Install the gcloud CLI from <https://cloud.google.com/sdk/docs/install>, then:

```bash
gcloud init
```

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

## 2. Choose the region and open Atlas

- In Atlas, open your cluster and note its **cloud provider and region**. Run
  Cloud Run in the same region, or the nearest one. Every page load runs many
  database queries, and on startup the app also creates its indexes one by one,
  so a backend far from the database is slow.
  Examples: Atlas AWS Mumbai (`ap-south-1`) → `asia-south1`. Atlas GCP or AWS
  Singapore → `asia-southeast1`. Atlas US East → `us-east1`.
- Asian regions are "Tier 2" and cost more per unit than US regions. The free
  allowance still covers a small app, but check
  <https://cloud.google.com/run/pricing> if traffic grows.
- In Atlas, open **Network Access** and add `0.0.0.0/0`. Cloud Run has no fixed
  outgoing IP address unless you pay for a NAT, so use a strong database
  password.

## 3. Store the secrets

Open **Security → Secret Manager** in the console and create these three
secrets. Copy the values from Railway's **Variables** tab.

| Secret name     | Value                                                    |
|-----------------|----------------------------------------------------------|
| `mongodb-url`   | `MONGODB_URL`                                            |
| `jwt-secret`    | `SECRET_KEY` (keep Railway's value so users stay signed in) |
| `smtp-password` | `SMTP_PASSWORD` (the Gmail App Password)                 |

Let Cloud Run's service account read them. Your project number is on the
console home page.

```bash
gcloud projects add-iam-policy-binding PROJECT_ID --member=serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com --role=roles/secretmanager.secretAccessor
```

## 4. Deploy

```bash
gcloud run deploy eye-care-api --source backend --region REGION --allow-unauthenticated --memory 512Mi --cpu 1 --cpu-boost --min-instances 0 --max-instances 2 --concurrency 40 --set-env-vars ENVIRONMENT=production,MONGODB_DB_NAME=eye_care_institute --set-secrets MONGODB_URL=mongodb-url:latest,SECRET_KEY=jwt-secret:latest,SMTP_PASSWORD=smtp-password:latest
```

- The first time, gcloud asks to create an Artifact Registry repository called
  `cloud-run-source-deploy`. Answer **yes**.
- Cloud Build builds `backend/Dockerfile`. Files listed in `backend/.gcloudignore`
  are not uploaded, and that list includes `.env`.
- If any other variable on Railway differs from the defaults in
  `app/config/settings.py` (for example `MONGODB_DB_NAME`, `CORS_ORIGINS` or
  `SMTP_USER`), add it to `--set-env-vars`.
- Leave `--min-instances 0` as it is. Setting it to 1 keeps an instance running
  all the time, and that is billed.

The command prints a URL like `https://eye-care-api-xxxxx.REGION.run.app`. Check it:

```bash
curl https://eye-care-api-xxxxx.REGION.run.app/health
```

To redeploy after code changes, run the same `gcloud run deploy` command again.

## 5. Keep image storage inside the free 0.5 GB

Each deploy stores an image of a few hundred MB. Keep only the newest two:

```bash
gcloud artifacts repositories set-cleanup-policies cloud-run-source-deploy --location=REGION --policy=backend/artifact-cleanup-policy.json
```

## 6. Point the frontend at the new backend

1. In Vercel, open **Project → Settings → Environment Variables** and set
   `VITE_API_BASE_URL` to `https://eye-care-api-xxxxx.REGION.run.app/api/v1`.
   Then redeploy, because Vite only reads this variable at build time.
2. Change `HOSTED_API_BASE_URL` in `Frontend/src/api/axios.ts`. It still points
   at Railway and is used whenever the env variable is missing.
3. Sign in, open an invoice PDF and request a password reset to confirm the
   database, PDFs and email all work.
4. Shut down the Railway service only after everything works.

## What can still cost money

| Item | Free allowance | Notes |
|------|----------------|-------|
| Cloud Run requests and CPU | 2M requests, 180k vCPU-seconds per month | A small clinic stays far below this |
| Artifact Registry | 0.5 GB | Covered by the cleanup policy in step 5 |
| Outbound data | Small monthly allowance | JSON responses are tiny. PDFs add a little |
| Cloud Build | 2,500 build-minutes per month | A deploy takes about 3–5 minutes |
| Source upload bucket | 5 GB only in US regions | The source upload is a few MB, so cents at most |
| Secret Manager | 6 secret versions, 10k reads per month | 3 secrets, read only when an instance starts |
