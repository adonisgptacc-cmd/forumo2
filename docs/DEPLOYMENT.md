# Forumo Deployment Guide

Production deployment to Kubernetes. All manifests live under [`k8s/`](../k8s/).

---

## 1. Prerequisites

### Cloud services

| Service                      | Purpose                                               | Where to provision                                                                               |
| ---------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| AWS EKS (or equivalent)      | Kubernetes cluster                                    | AWS console → EKS                                                                                |
| AWS Secrets Manager          | Secret storage synced by External Secrets Operator    | AWS console → Secrets Manager                                                                    |
| PostgreSQL 16                | Primary database                                      | RDS (`db.t4g.medium` minimum), or in-cluster via `k8s/infrastructure/postgres.yaml`              |
| Redis 7                      | Session cache, OTP rate-limiting, throttle counters   | ElastiCache (Serverless or `cache.t4g.small`), or in-cluster via `k8s/infrastructure/redis.yaml` |
| MinIO / AWS S3               | User-uploaded file storage                            | Self-hosted MinIO (via `k8s/infrastructure/minio.yaml`) or an S3 bucket                          |
| Stripe                       | USD/EUR/GBP payments + Connect seller payouts         | dashboard.stripe.com                                                                             |
| Paystack                     | NGN/GHS/KES/ZAR payments                              | dashboard.paystack.com                                                                           |
| Mailgun                      | Transactional email (OTP, order receipts, etc.)       | app.mailgun.com                                                                                  |
| AWS SNS                      | SMS OTP delivery                                      | AWS console → SNS → Text messaging                                                               |
| Google Cloud                 | OAuth 2.0 social login                                | console.cloud.google.com → APIs & Services → Credentials                                         |
| Shippo                       | Shipping label creation + tracking webhooks           | goshippo.com                                                                                     |
| Sentry                       | Error tracking — two separate projects (backend, web) | sentry.io                                                                                        |
| cert-manager + Let's Encrypt | Automatic TLS certificate provisioning                | Installed in cluster (see §3)                                                                    |

### Required CLI tools

- `kubectl` ≥ 1.28
- `helm` ≥ 3.12
- `docker` ≥ 24
- `pnpm` 9.1.4
- `node` 20+
- `aws` CLI (for Secrets Manager seeding)

### Environment variable reference

Secrets are stored in AWS Secrets Manager and synced into cluster Kubernetes Secrets by [`k8s/secrets/external-secrets.yaml`](../k8s/secrets/external-secrets.yaml). Populate the three secret paths before deploying.

> **`NEXT_PUBLIC_*` build-time note:** Next.js bakes `NEXT_PUBLIC_` variables into the bundle at image build time. Pass them as Docker `--build-arg` in your CI pipeline _in addition_ to providing them as runtime Kubernetes secrets.

#### Backend — `forumo/production/backend`

| Variable                        | Description                                                    | Source / value                                                                          |
| ------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | PostgreSQL connection string                                   | `postgresql://forumo:<pw>@<host>:5432/forumo?schema=public` — set after DB provisioning |
| `DATABASE_POOL_MIN`             | Prisma connection pool minimum                                 | `2`                                                                                     |
| `DATABASE_POOL_MAX`             | Prisma connection pool maximum                                 | `10`                                                                                    |
| `REDIS_URL`                     | Redis connection string                                        | `redis://<host>:6379` — set after Redis provisioning                                    |
| `REDIS_TTL_SECONDS`             | Default cache TTL (seconds)                                    | `3600`                                                                                  |
| `JWT_SECRET`                    | HMAC signing secret for access tokens (32+ random bytes)       | `openssl rand -base64 32`                                                               |
| `JWT_EXPIRES_IN`                | Access token lifetime                                          | `15m`                                                                                   |
| `REFRESH_TOKEN_EXPIRES_IN`      | Refresh token lifetime                                         | `30d`                                                                                   |
| `MINIO_ENDPOINT`                | MinIO/S3 hostname (no protocol)                                | MinIO host or S3 regional endpoint (e.g. `s3.amazonaws.com`)                            |
| `MINIO_PORT`                    | MinIO port                                                     | `9000` for MinIO, `443` for S3                                                          |
| `MINIO_ACCESS_KEY`              | MinIO root user or IAM access key                              | MinIO console / AWS IAM                                                                 |
| `MINIO_SECRET_KEY`              | MinIO root password or IAM secret key                          | MinIO console / AWS IAM                                                                 |
| `MINIO_USE_SSL`                 | Enable TLS for object storage                                  | `true` in production                                                                    |
| `UPLOADS_BUCKET`                | Object storage bucket name                                     | `forumo-uploads` (created in §2)                                                        |
| `GOOGLE_CLIENT_ID`              | OAuth 2.0 client ID                                            | GCP console → Credentials → OAuth 2.0 Client IDs                                        |
| `GOOGLE_CLIENT_SECRET`          | OAuth 2.0 client secret                                        | Same                                                                                    |
| `GOOGLE_CALLBACK_URL`           | OAuth redirect URI                                             | `https://forumo.africa/api/v1/auth/google/callback`                                     |
| `FRONTEND_URL`                  | Canonical frontend URL (used in email links)                   | `https://forumo.africa`                                                                 |
| `ALLOWED_ORIGINS`               | Comma-separated CORS origins                                   | `https://forumo.africa`                                                                 |
| `STRIPE_SECRET_KEY`             | Live secret key                                                | Stripe dashboard → Developers → API keys → `sk_live_…`                                  |
| `STRIPE_WEBHOOK_SECRET`         | Signing secret for `/payments/webhook/stripe`                  | Stripe dashboard → Developers → Webhooks → `whsec_…` (see §2)                           |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Signing secret for `/payments/webhook/stripe-connect`          | Stripe Connect webhook endpoint (see §2)                                                |
| `PAYSTACK_SECRET_KEY`           | Live secret key                                                | Paystack dashboard → Settings → API Keys → `sk_live_…`                                  |
| `PAYSTACK_PUBLIC_KEY`           | Live public key                                                | Same → `pk_live_…`                                                                      |
| `PAYSTACK_WEBHOOK_SECRET`       | HMAC-SHA512 webhook secret                                     | Paystack dashboard → Settings → Webhooks (see §2)                                       |
| `MAILGUN_API_KEY`               | Sending API key                                                | Mailgun dashboard → Settings → API Keys                                                 |
| `MAILGUN_DOMAIN`                | Verified sending domain                                        | `mg.forumo.africa` (see §2)                                                             |
| `MAILGUN_EMAIL_FROM`            | From address                                                   | `noreply@forumo.africa`                                                                 |
| `MAILGUN_API_BASE`              | Mailgun API base URL                                           | `https://api.mailgun.net` (US) or `https://api.eu.mailgun.net` (EU)                     |
| `SNS_REGION`                    | AWS region for SMS                                             | `us-east-1` (or your region)                                                            |
| `SNS_ACCESS_KEY_ID`             | IAM access key for SNS                                         | AWS IAM → Users → Security credentials                                                  |
| `SNS_SECRET_ACCESS_KEY`         | IAM secret key for SNS                                         | Same                                                                                    |
| `SNS_SMS_SENDER_ID`             | SMS sender ID shown to recipients                              | `Forumo`                                                                                |
| `ADMIN_NOTIFICATION_EMAIL`      | Email address for admin alerts                                 | Your ops email                                                                          |
| `SHIPPO_API_KEY`                | Shippo live API key                                            | goshippo.com → API                                                                      |
| `SHIPPO_WEBHOOK_SECRET`         | Shippo webhook signing secret                                  | goshippo.com → Webhooks                                                                 |
| `ESCROW_AUTO_RELEASE_DAYS`      | Days after delivery before escrow auto-releases                | `5`                                                                                     |
| `MODERATION_SERVICE_URL`        | Internal URL of the moderation microservice                    | `http://forumo-moderation:5005`                                                         |
| `TOS_VERSION`                   | Current TOS date string — must match `NEXT_PUBLIC_TOS_VERSION` | e.g. `2024-01-01`                                                                       |
| `SENTRY_DSN`                    | Backend Sentry DSN                                             | sentry.io → Project → Settings → Client Keys                                            |
| `OTEL_EXPORTER_OTLP_ENDPOINT`   | OTLP trace collector endpoint                                  | Your Jaeger/Tempo endpoint                                                              |
| `OTEL_SERVICE_NAME`             | Service name in traces                                         | `forumo-backend`                                                                        |
| `LOG_LEVEL`                     | Pino log level                                                 | `info` in production                                                                    |
| `METRICS_API_KEY`               | API key sent as `x-api-key` to `/api/v1/metrics`               | `openssl rand -hex 32`                                                                  |
| `PORT`                          | HTTP port                                                      | `4000`                                                                                  |
| `NODE_ENV`                      | Node environment                                               | `production`                                                                            |
| `OTP_TTL`                       | OTP validity window (seconds)                                  | `300`                                                                                   |
| `OTP_DEVICE_RATE_LIMIT`         | Max OTP requests per device per window                         | `5`                                                                                     |
| `OTP_DEVICE_RATE_WINDOW`        | OTP rate-limit window (seconds)                                | `300`                                                                                   |
| `AUTH_RATE_LIMIT`               | Max auth requests per IP per window                            | `10`                                                                                    |
| `AUTH_RATE_WINDOW_MS`           | Auth rate-limit window (ms)                                    | `60000`                                                                                 |
| `LOGIN_ATTEMPT_LIMIT`           | Max failed login attempts before lockout                       | `5`                                                                                     |
| `LOGIN_ATTEMPT_WINDOW_MS`       | Login lockout window (ms)                                      | `900000`                                                                                |
| `RESEND_RATE_LIMIT`             | Max OTP resend requests per window                             | `3`                                                                                     |
| `RESEND_RATE_WINDOW_MS`         | OTP resend rate-limit window (ms)                              | `3600000`                                                                               |
| `PAYMENT_RATE_LIMIT`            | Max payment requests per IP per window                         | `30`                                                                                    |
| `PAYMENT_RATE_WINDOW_MS`        | Payment rate-limit window (ms)                                 | `60000`                                                                                 |
| `CACHE_TTL_SECONDS`             | Response cache TTL                                             | `30`                                                                                    |

#### Web — `forumo/production/web`

| Variable                             | Description                                    | Source / value                   |
| ------------------------------------ | ---------------------------------------------- | -------------------------------- |
| `NEXTAUTH_SECRET`                    | NextAuth JWT signing secret (32+ bytes)        | `openssl rand -base64 32`        |
| `NEXTAUTH_URL`                       | Canonical URL of the web app                   | `https://forumo.africa`          |
| `NEXT_PUBLIC_SITE_URL`               | Used for OG tags and sitemap                   | `https://forumo.africa`          |
| `NEXT_PUBLIC_API_URL`                | Backend API base URL                           | `https://forumo.africa/api/v1`   |
| `NEXT_PUBLIC_API_BASE_URL`           | Same as above (both must be set)               | `https://forumo.africa/api/v1`   |
| `NEXT_PUBLIC_WS_URL`                 | WebSocket URL                                  | `wss://forumo.africa`            |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe live publishable key                    | `pk_live_…` — Stripe dashboard   |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`    | Paystack live public key                       | `pk_live_…` — Paystack dashboard |
| `NEXT_PUBLIC_ENVIRONMENT`            | Environment identifier                         | `production`                     |
| `NEXT_PUBLIC_USE_API_MOCKS`          | Must be `false` in production                  | `false`                          |
| `NEXT_PUBLIC_SENTRY_DSN`             | Web Sentry DSN (separate project from backend) | sentry.io → web project          |
| `NEXT_PUBLIC_TOS_VERSION`            | Must match backend `TOS_VERSION`               | e.g. `2024-01-01`                |

#### Admin — `forumo/production/admin`

| Variable                   | Description                                   | Source / value                                  |
| -------------------------- | --------------------------------------------- | ----------------------------------------------- |
| `NEXTAUTH_SECRET`          | NextAuth JWT signing secret                   | `openssl rand -base64 32` (can differ from web) |
| `NEXTAUTH_URL`             | Full NextAuth API URL for the admin base path | `https://forumo.africa/admin/api/auth`          |
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL                          | `https://forumo.africa/api/v1`                  |

---

## 2. First-time setup

Complete these steps once before the first deploy. They do not repeat on subsequent deploys.

### Database provisioning

1. Provision a PostgreSQL 16 instance (RDS `db.t4g.medium` or larger recommended for production).
2. Create the application user and database:
   ```sql
   CREATE USER forumo WITH PASSWORD '<strong-password>';
   CREATE DATABASE forumo OWNER forumo;
   GRANT ALL PRIVILEGES ON DATABASE forumo TO forumo;
   ```
3. Set `DATABASE_URL` in AWS Secrets Manager:
   ```bash
   # Update the forumo/production/backend secret with the real connection string
   aws secretsmanager put-secret-value \
     --secret-id forumo/production/backend \
     --secret-string "$(aws secretsmanager get-secret-value \
       --secret-id forumo/production/backend --query SecretString --output text \
       | jq '.DATABASE_URL = "postgresql://forumo:<pw>@<rds-host>:5432/forumo?schema=public"')"
   ```
4. Run migrations from a one-off Kubernetes pod (after the `forumo-backend-secrets` Secret exists in the cluster):
   ```bash
   kubectl run migrate --rm -it \
     --image=<account>.dkr.ecr.<region>.amazonaws.com/forumo-backend:<git-sha> \
     --restart=Never \
     --namespace=forumo \
     --env="DATABASE_URL=$(kubectl get secret forumo-backend-secrets -n forumo \
       -o jsonpath='{.data.DATABASE_URL}' | base64 -d)" \
     -- npx prisma migrate deploy --schema prisma/schema.prisma
   ```
   Expect output ending with `All migrations have been successfully applied.`

### MinIO / S3 CORS and bucket setup

**For self-hosted MinIO:**

1. Access the MinIO console at `https://<minio-host>:9001` and log in with root credentials.
2. Create a bucket named `forumo-uploads`.
3. Apply the CORS policy (MinIO console → Bucket → Configuration → CORS):
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedOrigins": ["https://forumo.africa"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. Apply a bucket policy granting the backend service account read/write:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": { "AWS": ["arn:aws:iam:::user/forumo-backend"] },
         "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
         "Resource": ["arn:aws:s3:::forumo-uploads/*"]
       }
     ]
   }
   ```

**For AWS S3:**

1. Create the bucket and block public access.
2. Apply the CORS config via CLI:
   ```bash
   aws s3api put-bucket-cors --bucket forumo-uploads \
     --cors-configuration '{
       "CORSRules": [{
         "AllowedHeaders": ["*"],
         "AllowedMethods": ["GET","PUT","POST","DELETE"],
         "AllowedOrigins": ["https://forumo.africa"],
         "ExposeHeaders": ["ETag"],
         "MaxAgeSeconds": 3600
       }]
     }'
   ```
3. Create an IAM user or role for the backend with `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on `arn:aws:s3:::forumo-uploads/*`. Set `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, and `MINIO_ENDPOINT` accordingly.

### Stripe Connect setup

1. In the Stripe dashboard (live mode), go to **Connect → Settings**:
   - Set the platform name, logo, and support email.
   - Configure the application fee percentage for marketplace transactions.
   - Enable OAuth if sellers onboard via the OAuth flow.
2. Register two webhook endpoints under **Developers → Webhooks**:

   | Endpoint URL                                                   | Events to enable                                                                                         |
   | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
   | `https://forumo.africa/api/v1/payments/webhook/stripe`         | `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created` |
   | `https://forumo.africa/api/v1/payments/webhook/stripe-connect` | `transfer.paid`, `transfer.failed`, `account.updated`, `payout.paid`, `payout.failed`                    |

3. Copy the signing secrets (`whsec_…`) into `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET` in AWS Secrets Manager.
4. Set `STRIPE_SECRET_KEY` (live `sk_live_…`) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (live `pk_live_…`) in the respective secrets.

### Paystack live keys and webhook registration

1. In the Paystack dashboard, switch to **Live** mode.
2. Go to **Settings → API Keys** and copy the live secret and public keys into `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`.
3. Go to **Settings → Webhooks** and add:
   - URL: `https://forumo.africa/api/v1/payments/webhook/paystack`
   - Events: all charge and transfer events
4. Copy the webhook secret token into `PAYSTACK_WEBHOOK_SECRET`. The backend verifies every incoming event using HMAC-SHA512 over the raw body with this secret — reject events will be dropped silently without a matching secret.
5. Set `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` to the live public key in the web secrets.

### Mailgun domain verification

1. In Mailgun, go to **Sending → Domains → Add New Domain** and add `mg.forumo.africa`.
2. Mailgun will provide DNS records to create:
   - Two **TXT** records (SPF and DKIM signing)
   - One **MX** record (bounce handling)
   - One **CNAME** record (click/open tracking — optional)
3. Add these records at your DNS provider. Propagation can take up to 48 hours.
4. Click **Verify DNS Settings** in Mailgun once propagation completes. The domain status must show **Active** before emails will send.
5. Retrieve the sending API key from **Settings → API Keys** and set `MAILGUN_API_KEY`.
6. Set `MAILGUN_DOMAIN=mg.forumo.africa` and `MAILGUN_EMAIL_FROM=noreply@forumo.africa`.
7. If your Mailgun account is on the EU region, set `MAILGUN_API_BASE=https://api.eu.mailgun.net`.

---

## 3. Deploy steps (Kubernetes)

### Cluster prerequisites

Install these once into the cluster before applying Forumo manifests:

```bash
# NGINX Ingress Controller
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# cert-manager (Let's Encrypt TLS)
helm upgrade --install cert-manager cert-manager \
  --repo https://charts.jetstack.io \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

# External Secrets Operator (syncs from AWS Secrets Manager via IRSA)
helm upgrade --install external-secrets external-secrets \
  --repo https://charts.external-secrets.io \
  --namespace external-secrets --create-namespace
```

After cert-manager is running, create the `ClusterIssuer` for Let's Encrypt:

```bash
kubectl apply -f - <<'EOF'
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ops@forumo.africa
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

Seed AWS Secrets Manager with production values before the next step:

```bash
aws secretsmanager create-secret --name forumo/production/backend \
  --secret-string file://secrets/backend.json
aws secretsmanager create-secret --name forumo/production/web \
  --secret-string file://secrets/web.json
aws secretsmanager create-secret --name forumo/production/admin \
  --secret-string file://secrets/admin.json
```

The IRSA role attached to the ESO service account needs `secretsmanager:GetSecretValue` on `arn:aws:secretsmanager:<REGION>:<ACCOUNT>:secret:forumo/*`.

### Apply order

Apply manifests in this exact order — each step must reach a healthy state before the next.

```bash
# 1. Namespace
kubectl apply -f k8s/namespace.yaml

# 2. External Secrets — creates forumo-*-secrets Kubernetes Secrets from AWS SM
kubectl apply -f k8s/secrets/external-secrets.yaml

# Wait for all three ExternalSecrets to reach Ready status
kubectl get externalsecret -n forumo --watch
# Expected: forumo-backend-secrets, forumo-web-secrets, forumo-admin-secrets — all Ready

# Confirm the Kubernetes Secrets were created
kubectl get secret forumo-backend-secrets forumo-web-secrets forumo-admin-secrets -n forumo

# 3. Managed infrastructure
# Confirm DATABASE_URL, REDIS_URL, and object-storage values in
# forumo/production/backend point at the provisioned production services.
# The k8s/infrastructure manifests are development/self-hosting examples and
# are intentionally not part of the production apply path.

# 4. Run database migrations (one-off pod)
kubectl run migrate --rm -it \
  --image=<account>.dkr.ecr.<region>.amazonaws.com/forumo-backend:<git-sha> \
  --restart=Never --namespace=forumo \
  --env="DATABASE_URL=$(kubectl get secret forumo-backend-secrets -n forumo \
    -o jsonpath='{.data.DATABASE_URL}' | base64 -d)" \
  -- npx prisma migrate deploy --schema prisma/schema.prisma

# 5. Applications
kubectl apply -f k8s/apps/moderation.yaml
kubectl apply -f k8s/backend/deployment.yaml
kubectl apply -f k8s/web/deployment.yaml

# 6. HPAs
kubectl apply -f k8s/backend/hpa.yaml
kubectl apply -f k8s/web/hpa.yaml

# 7. Ingress (apply last — cert-manager issues TLS cert after this)
kubectl apply -f k8s/ingress.yaml
```

### Health verification per service

```bash
# Postgres
kubectl exec -n forumo deploy/forumo-postgres -- pg_isready -U forumo

# Redis
kubectl exec -n forumo deploy/forumo-redis -- redis-cli ping

# MinIO
kubectl exec -n forumo deploy/forumo-minio -- \
  curl -sf http://localhost:9000/minio/health/live && echo "ok"

# Moderation service
kubectl exec -n forumo deploy/forumo-moderation -- \
  curl -sf http://localhost:5005/health && echo "ok"

# Backend (health endpoint)
kubectl exec -n forumo deploy/forumo-backend -- \
  curl -sf http://localhost:4000/api/v1/health && echo "ok"

# Web (Next.js)
kubectl exec -n forumo deploy/forumo-web -- \
  curl -sf http://localhost:3000/ -o /dev/null -w "%{http_code}" && echo ""

# Admin (Next.js, mounted under /admin)
kubectl exec -n forumo deploy/forumo-admin -- \
  curl -sf http://localhost:3001/admin -o /dev/null -w "%{http_code}" && echo ""

# Rollout status for all deployments
kubectl rollout status deployment/forumo-backend   -n forumo
kubectl rollout status deployment/forumo-web       -n forumo
kubectl rollout status deployment/forumo-admin     -n forumo
kubectl rollout status deployment/forumo-moderation -n forumo

# End-to-end from public URL (after TLS cert issues — may take 1-2 min)
curl -sf https://forumo.africa/api/v1/health | jq .
```

All deployments should show `successfully rolled out`. Verify that the configured replica count for each deployment is Running and Ready.

### Zero-downtime migration steps

The backend `Deployment` runs 2 replicas with `maxUnavailable: 0` and a readiness probe on `/api/v1/health/ready`. Kubernetes will not route traffic to a pod until the probe passes, making additive schema changes safe to deploy with no downtime:

1. **Apply the migration before deploying the new image.** Old pods continue running; Postgres ignores new columns they don't reference.

   ```bash
   kubectl run migrate --rm -it \
     --image=<account>.dkr.ecr.<region>.amazonaws.com/forumo-backend:<new-sha> \
     --restart=Never --namespace=forumo \
     --env="DATABASE_URL=$(kubectl get secret forumo-backend-secrets -n forumo \
       -o jsonpath='{.data.DATABASE_URL}' | base64 -d)" \
     -- npx prisma migrate deploy --schema prisma/schema.prisma
   ```

2. **Deploy the new backend image** (rolling update — one pod at a time):

   ```bash
   kubectl set image deployment/forumo-backend \
     backend=<account>.dkr.ecr.<region>.amazonaws.com/forumo-backend:<new-sha> \
     -n forumo
   kubectl rollout status deployment/forumo-backend -n forumo
   ```

3. **Deploy the new web image:**
   ```bash
   kubectl set image deployment/forumo-web \
     web=<account>.dkr.ecr.<region>.amazonaws.com/forumo-web:<new-sha> \
     -n forumo
   kubectl rollout status deployment/forumo-web -n forumo
   ```

> **Destructive migrations** (column drops, type changes, renames) must span two releases. Never remove a column in the same release that removes the code reading it. Always take a manual RDS snapshot before any production migration, even when automated snapshots are enabled.

---

## 4. Rollback procedure

### Rolling back a bad deploy

Kubernetes retains the previous ReplicaSet. Roll back without rebuilding an image:

```bash
# Inspect rollout history first
kubectl rollout history deployment/forumo-backend -n forumo
kubectl rollout history deployment/forumo-web     -n forumo

# Roll back to the previous revision
kubectl rollout undo deployment/forumo-backend -n forumo
kubectl rollout undo deployment/forumo-web     -n forumo

# Confirm rollback completed
kubectl rollout status deployment/forumo-backend -n forumo
kubectl rollout status deployment/forumo-web     -n forumo
kubectl get pods -n forumo

# Smoke test
curl -sf https://forumo.africa/api/v1/health | jq .
```

To roll back to a specific revision (e.g. two deployments ago):

```bash
kubectl rollout undo deployment/forumo-backend --to-revision=<N> -n forumo
```

### Rolling back a bad migration

Prisma does not auto-generate down migrations. Use one of the two options below.

**Option A — restore from RDS snapshot (required for destructive migrations):**

1. Scale the backend to zero to stop writes:
   ```bash
   kubectl scale deployment/forumo-backend --replicas=0 -n forumo
   ```
2. Restore the RDS snapshot taken immediately before the migration was applied.
3. If the restored instance has a new hostname, update `DATABASE_URL` in AWS Secrets Manager and force-resync the ExternalSecret:
   ```bash
   kubectl annotate externalsecret forumo-backend-secrets -n forumo \
     force-sync=$(date +%s) --overwrite
   ```
4. Roll back the backend image and scale back up:
   ```bash
   kubectl rollout undo deployment/forumo-backend -n forumo
   kubectl scale deployment/forumo-backend --replicas=2 -n forumo
   kubectl rollout status deployment/forumo-backend -n forumo
   ```

**Option B — manual down migration (additive migrations only):**

1. Write a SQL script reversing the migration (e.g. `ALTER TABLE … DROP COLUMN …`).
2. Apply it against the production database:
   ```bash
   kubectl exec -it -n forumo deploy/forumo-postgres -- \
     psql -U forumo -d forumo -c "<your SQL here>"
   ```
3. Remove the migration record so Prisma no longer considers it applied:
   ```sql
   DELETE FROM "_prisma_migrations" WHERE migration_name = '<migration-name>';
   ```
4. Roll back the backend image:
   ```bash
   kubectl rollout undo deployment/forumo-backend -n forumo
   ```

---

## 5. Monitoring

### Log locations

All applications log to stdout. Logs are collected by your cluster log aggregator (Fluent Bit → CloudWatch Logs / OpenSearch).

| Service       | Live tail command                                        | Format               |
| ------------- | -------------------------------------------------------- | -------------------- |
| Backend       | `kubectl logs -n forumo -l app=backend -f --tail=200`    | Pino structured JSON |
| Web (Next.js) | `kubectl logs -n forumo -l app=web -f --tail=200`        | Next.js text         |
| Admin         | `kubectl logs -n forumo -l app=admin -f --tail=200`      | Next.js text         |
| Moderation    | `kubectl logs -n forumo -l app=moderation -f --tail=200` | Uvicorn text         |
| Postgres      | `kubectl logs -n forumo -l app=postgres -f --tail=100`   | PostgreSQL text      |
| Redis         | `kubectl logs -n forumo -l app=redis -f --tail=100`      | Redis text           |

Useful backend log filters (pipe through `jq`):

```bash
# Errors only (Pino level >= 50)
kubectl logs -n forumo -l app=backend -f | jq 'select(.level >= 50)'

# Trace a specific request by ID
kubectl logs -n forumo -l app=backend | jq 'select(.reqId == "<id>")'

# Payment-related log lines
kubectl logs -n forumo -l app=backend | jq 'select(.context | test("payment|stripe|paystack"; "i"))'

# Escrow or order state transitions
kubectl logs -n forumo -l app=backend | jq 'select(.context | test("escrow|order"; "i"))'
```

### Prometheus metrics

The backend exposes Prometheus-format metrics at `/api/v1/metrics`, protected by the `x-api-key: <METRICS_API_KEY>` header.

Add the following scrape config to your Prometheus deployment:

```yaml
scrape_configs:
  - job_name: forumo-backend
    scheme: http
    metrics_path: /api/v1/metrics
    http_headers:
      x-api-key:
        secrets: [<METRICS_API_KEY>]
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: [forumo]
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: backend
        action: keep
```

**Dashboard:** Import [`monitoring/dashboards/observability.json`](../monitoring/dashboards/observability.json) into Grafana via **Dashboards → Import → Upload JSON file**. Once imported, the dashboard is accessible at:

```
https://<your-grafana-host>/d/forumo-observability
```

**Pre-configured alert rule** ([`monitoring/alerts/high_error_rate.yml`](../monitoring/alerts/high_error_rate.yml)):

| Alert           | PromQL expression                                                                        | Threshold       | Severity |
| --------------- | ---------------------------------------------------------------------------------------- | --------------- | -------- |
| `HighErrorRate` | `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))` | > 5 % for 5 min | critical |

### Sentry alerts and triage

Two separate Sentry projects must exist: one for the backend (`SENTRY_DSN`) and one for the web frontend (`NEXT_PUBLIC_SENTRY_DSN`). Do not share DSNs between projects.

**Key alert rules to configure in Sentry:**

| Alert                             | Project | Trigger condition                                                     | Routing                                                             |
| --------------------------------- | ------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Unhandled exception spike         | backend | Error count > 10 in 5 min                                             | Page on-call                                                        |
| Payment webhook signature failure | backend | Event matching `StripeWebhookException` or `PaystackWebhookException` | Page on-call — likely a rotated secret not yet synced               |
| TOS interceptor 403 spike         | backend | HTTP 403 count > 50 in 5 min                                          | Alert — possible `TOS_VERSION` / `NEXT_PUBLIC_TOS_VERSION` mismatch |
| Refresh token failure             | web     | Event matching `"token refresh failed"`                               | Alert — users being logged out unexpectedly                         |
| Unhandled Next.js crash           | web     | Any unhandled error                                                   | Notify frontend team                                                |
| Account deletion cron failure     | backend | Event matching `AccountDeletionService`                               | Notify — GDPR compliance risk                                       |

**Triage workflow for a 5xx spike:**

1. Check the `HighErrorRate` Prometheus alert to identify scope: which endpoints, what rate, since when.
2. Open Sentry (backend project) → filter by `level:error` in the affected time window.
3. Note the exception type, stack trace, and the `reqId` field.
4. Correlate with raw logs using the request ID:
   ```bash
   kubectl logs -n forumo -l app=backend | jq 'select(.reqId == "<id>")'
   ```
5. **If database-related** (Prisma `P2xxx` error codes): check Postgres logs for locks or connection saturation. Consider increasing `DATABASE_POOL_MAX`.
6. **If payment-related**: open the Stripe or Paystack dashboard and confirm whether corresponding failures appear there. Verify that `STRIPE_WEBHOOK_SECRET` / `PAYSTACK_WEBHOOK_SECRET` are current — a recent secret rotation that wasn't propagated to the cluster is a common cause.
7. **If auth-related** (`JwtAuthGuard` failures or 401 spikes): check whether `JWT_SECRET` was rotated without a rolling restart of the backend pods.
8. Resolve the issue or execute the rollback procedure (§4). Mark Sentry issues as resolved once confirmed fixed in production.
