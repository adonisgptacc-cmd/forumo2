# Forumo Kubernetes Deployment Guide

## Prerequisites
- Docker Desktop with Kubernetes enabled, OR
- Minikube, OR
- A cloud Kubernetes cluster (GKE, EKS, AKS)

## Quick Start

### 1. Build Docker Images
```bash
# From the project root directory
docker compose build
```

### 2. Create Kubernetes Namespace
```bash
kubectl apply -f k8s/namespace.yaml
```

### 3. Deploy Infrastructure (Database, Redis, MinIO)
```bash
kubectl apply -f k8s/infrastructure/
```

### 4. Wait for infrastructure to be ready
```bash
kubectl -n forumo wait --for=condition=ready pod -l app=postgres --timeout=120s
kubectl -n forumo wait --for=condition=ready pod -l app=redis --timeout=60s
```

### 5. Deploy Applications
```bash
kubectl apply -f k8s/apps/
```

### 6. Check Status
```bash
kubectl -n forumo get pods
kubectl -n forumo get services
```

### 7. Access the Application
```bash
# Port forward the web service
kubectl -n forumo port-forward svc/forumo-web 3000:3000

# Port forward the backend API
kubectl -n forumo port-forward svc/forumo-backend 4000:4000
```

Then open http://localhost:3000 in your browser.

## Using Minikube

If you're using Minikube, you can expose services via:
```bash
minikube service forumo-web -n forumo
```

## Scaling

Scale the deployments as needed:
```bash
kubectl -n forumo scale deployment forumo-web --replicas=3
kubectl -n forumo scale deployment forumo-backend --replicas=3
```

## Cleanup

To remove all resources:
```bash
kubectl delete namespace forumo
```
