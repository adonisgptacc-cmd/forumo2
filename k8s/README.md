# Forumo Kubernetes Manifests

All production Kubernetes resources for Forumo. Every resource lives in the `forumo` namespace.

## Directory structure

```
k8s/
├── backend/
│   ├── deployment.yaml   # Deployment (2 replicas) + ClusterIP Service (port 4000)
│   └── hpa.yaml          # HPA: 2-10 replicas, CPU 70% / memory 80%
├── web/
│   ├── deployment.yaml   # web + admin Deployments + Services (ports 3000/3001)
│   └── hpa.yaml          # HPA for web and admin
├── secrets/
│   └── external-secrets.yaml  # ClusterSecretStore + ExternalSecrets (ESO + AWS SM)
├── ingress.yaml          # nginx Ingress: / -> web, /api -> backend, /admin -> admin
└── README.md
```

## Prerequisites

| Tool | Install |
|---|---|
| External Secrets Operator | `helm install eso external-secrets/external-secrets -n external-secrets --create-namespace` |
| cert-manager | `helm install cert-manager jetstack/cert-manager -n cert-manager --create-namespace --set installCRDs=true` |
| nginx ingress controller | `helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace` |

### cert-manager ClusterIssuer

Apply once after cert-manager is ready:

```yaml
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
```
## AWS Secrets Manager setup

Each app reads runtime config from a flat JSON secret. Create three secrets,
populating them with production values matching each .env.example:

```bash
aws secretsmanager create-secret --name forumo/production/backend --secret-string file://secrets/backend.json
aws secretsmanager create-secret --name forumo/production/web    --secret-string file://secrets/web.json
aws secretsmanager create-secret --name forumo/production/admin  --secret-string file://secrets/admin.json
```

The IRSA role attached to the ESO service account needs `secretsmanager:GetSecretValue`
on `arn:aws:secretsmanager:<REGION>:<ACCOUNT>:secret:forumo/*`.

## Deploy order

Apply in this exact order; each step depends on the previous completing successfully.

### 1. Namespace

```bash
kubectl apply -f k8s/backend/deployment.yaml   # first doc creates the forumo namespace
```

### 2. Secrets

```bash
kubectl apply -f k8s/secrets/external-secrets.yaml
kubectl get externalsecret -n forumo
kubectl get secret forumo-backend-secrets forumo-web-secrets forumo-admin-secrets -n forumo
```

### 3. PostgreSQL

Provision RDS PostgreSQL 16. Set DATABASE_URL in the forumo/backend AWS secret, then run migrations.

```bash
kubectl run migrations --rm -it --restart=Never --image=<ECR>/forumo-backend:<tag> --env-from=secret/forumo-backend-secrets -n forumo -- npx prisma migrate deploy --schema prisma/schema.prisma
```

### 4. Redis
Provision ElastiCache Redis 7. Set REDIS_URL in the forumo/backend AWS secret.

### 5. Backend

```bash
IMAGE=<account>.dkr.ecr.<region>.amazonaws.com/forumo-backend:<git-sha>
sed -i "s|forumo/backend:latest|$IMAGE|" k8s/backend/deployment.yaml
kubectl apply -f k8s/backend/deployment.yaml && kubectl apply -f k8s/backend/hpa.yaml
kubectl rollout status deployment/forumo-backend -n forumo
```

### 6. Web (buyer/seller frontend)

```bash
IMAGE=<account>.dkr.ecr.<region>.amazonaws.com/forumo-web:<git-sha>
sed -i "s|forumo/web:latest|$IMAGE|" k8s/web/deployment.yaml
kubectl apply -f k8s/web/deployment.yaml && kubectl apply -f k8s/web/hpa.yaml
kubectl rollout status deployment/forumo-web -n forumo
```

### 7. Admin dashboard

```bash
IMAGE=<account>.dkr.ecr.<region>.amazonaws.com/forumo-admin:<git-sha>
sed -i "s|forumo/admin:latest|$IMAGE|" k8s/web/deployment.yaml
kubectl rollout status deployment/forumo-admin -n forumo
```

> **Note:** Build the admin app with basePath: "/admin" in apps/admin/next.config.js so that
> Next.js assets and server routes resolve correctly under the /admin subpath.

### 8. Ingress

```bash
kubectl apply -f k8s/ingress.yaml
kubectl describe ingress forumo-ingress -n forumo
```

## Resource summary

| Deployment | Replicas | CPU req/limit | Memory req/limit | HPA range |
|---|---|---|---|---|
| forumo-backend | 2 | 250m / 500m | 256Mi / 512Mi | 2-10 |
| forumo-web     | 2 | 250m / 500m | 256Mi / 512Mi | 2-10 |
| forumo-admin   | 2 | 250m / 500m | 256Mi / 512Mi | 2-10 |

HPA scales out at **CPU >= 70%** or **memory >= 80%** with a 5-minute scale-down
stabilisation window to prevent flapping.

## Rotating secrets

Update the value in AWS Secrets Manager. ESO re-syncs every hour. To force an immediate refresh:

```bash
kubectl annotate externalsecret forumo-backend-secrets -n forumo force-sync=$(date +%s) --overwrite
kubectl rollout restart deployment/forumo-backend -n forumo
```
