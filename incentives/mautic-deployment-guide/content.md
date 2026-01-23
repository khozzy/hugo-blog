# Mautic 5.x on Kubernetes

## Deployment Guide & Checklist

**Supplementary material for**: [How to Set Up Mautic 5.x on Kubernetes: A Step-by-Step Guide](https://kozlov.ski/mautic-5x-kubernetes-setup/)

---

## Overview

This guide walks you through deploying Mautic 5.x on a local Kubernetes cluster using Minikube. By the end, you'll have a fully functional Mautic instance with MariaDB for data persistence and Mailhog for email testing.

**Estimated completion time**: 30-45 minutes

---

## Checkpoint 0: Prerequisites

### System Requirements

Ensure your system meets the following requirements before proceeding:

- [ ] Docker installed and running
- [ ] At least 4GB RAM available for Minikube
- [ ] At least 20GB free disk space

### Install Required Tools

Install the Kubernetes CLI tools using Homebrew:

```bash
brew install kubectl
brew install minikube
brew install helm
```

### Verify Installation

- [ ] Verify kubectl: `kubectl version --client`
- [ ] Verify minikube: `minikube version`
- [ ] Verify helm: `helm version`

### Start Minikube Cluster

```bash
minikube start --driver=docker
```

### Enable Required Addons

```bash
minikube addons enable metrics-server
minikube addons enable ingress
```

**Verification checklist:**

- [ ] Minikube cluster is running (`minikube status`)
- [ ] Metrics server addon is enabled
- [ ] Ingress addon is enabled

---

## Checkpoint 1: Configure Helm Repositories

Add the required Helm chart repositories:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add codecentric https://codecentric.github.io/helm-charts
helm repo add mautic https://mautic.github.io/helm-charts
helm repo update
```

**Verification checklist:**

- [ ] Bitnami repo added successfully
- [ ] Codecentric repo added successfully
- [ ] Mautic repo added successfully
- [ ] All repos updated (`helm repo list` shows all three)

---

## Checkpoint 2: Deploy MariaDB

MariaDB serves as the database backend for Mautic.

### Install MariaDB

```bash
helm install mariadb bitnami/mariadb -f mariadb-values.yaml
```

### Optional: External Database Access

To connect to the database from outside the cluster (useful for debugging):

```bash
kubectl apply -f mariadb-nodeport-service.yaml
minikube service mariadb-nodeport --url
```

**Verification checklist:**

- [ ] MariaDB pod is running (`kubectl get pods | grep mariadb`)
- [ ] MariaDB service is available (`kubectl get svc | grep mariadb`)

---

## Checkpoint 3: Deploy Mailhog

Mailhog captures outgoing emails for testing purposes.

### Install Mailhog

```bash
helm install mailhog codecentric/mailhog -f mailhog-values.yaml
```

**Verification checklist:**

- [ ] Mailhog pod is running (`kubectl get pods | grep mailhog`)
- [ ] Mailhog service is available (`kubectl get svc | grep mailhog`)

---

## Checkpoint 4: Deploy Mautic

### Step 4.1: Create Custom Favicon ConfigMap

Before installing the Helm chart, create the required Kubernetes ConfigMap for the custom favicon:

```bash
kubectl apply -f ct-favicon-configmap.yaml
```

- [ ] ConfigMap created successfully

### Step 4.2: Configure MaxMind IP Lookup (Optional)

Mautic uses MaxMind GeoLite2 for IP geolocation to identify visitor locations. To enable this feature:

1. Create a free MaxMind account at [maxmind.com/en/geolite2/signup](https://www.maxmind.com/en/geolite2/signup)
2. Generate a license key in your account dashboard under **Manage License Keys**
3. Update `mautic-values.yaml` with your credentials:

```yaml
MAUTIC_IP_LOOKUP_AUTH: "<ACCOUNT_ID>:<LICENSE_KEY>"
```

> **Note:** This step is optional. Mautic will function without IP lookup, but you won't have geographic data for your contacts.

- [ ] MaxMind account created (optional)
- [ ] License key configured in values file (optional)

### Step 4.3: Install Mautic via Helm

```bash
helm install mautic mautic/mautic -f mautic-values.yaml --version 5.1.71
```

**Useful commands for managing Mautic:**

```bash
# Upgrade existing installation
helm upgrade mautic mautic/mautic --version 5.1.71 --dry-run

# Remove installation completely
helm delete mautic
```

- [ ] Mautic Helm release installed

### Step 4.4: Resolve Health-Check Issues

After installation, clear the cache and fix permissions to resolve potential 500 errors:

```bash
# Clear application cache
kubectl exec -it $(kubectl get pod -l app.kubernetes.io/name=mautic -o jsonpath='{.items[0].metadata.name}') \
  -- php bin/console cache:clear

# Sync database migrations metadata
kubectl exec -it $(kubectl get pod -l app.kubernetes.io/name=mautic -o jsonpath='{.items[0].metadata.name}') \
  -- php bin/console doctrine:migrations:sync-metadata-storage

# Fix file ownership
kubectl exec -it $(kubectl get pod -l app.kubernetes.io/name=mautic -o jsonpath='{.items[0].metadata.name}') \
  -- chown -R www-data:www-data var
```

**Verification checklist:**

- [ ] Cache cleared successfully
- [ ] Migrations metadata synced
- [ ] File ownership corrected
- [ ] Mautic pod is running without restarts (`kubectl get pods | grep mautic`)

---

## Checkpoint 5: Access Services

### Enable Network Tunnel

Start the Minikube tunnel to expose services locally (requires sudo):

```bash
sudo minikube tunnel
```

> **Note:** Keep this terminal window open while accessing the services.

### Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Mautic | [http://mautic.local](http://mautic.local) | `admin` / `Maut1cR0cks!` |
| Mailhog | [http://mailhog.local](http://mailhog.local) | — |

**Verification checklist:**

- [ ] Minikube tunnel is running
- [ ] Mailhog web interface is accessible
- [ ] Mautic login page loads
- [ ] Successfully logged into Mautic admin panel

---

## Checkpoint 6: Verify API Access (Optional)

Test the Mautic API to ensure everything is working correctly.

### Generate Authorization Header

```bash
echo "Authorization: Basic $(echo -n "admin:Maut1cR0cks!" | base64)"
```

### Test API Endpoints

**Create a new stage:**

```bash
curl -X POST \
  'http://mautic.local/api/stages/new' \
  -H "Authorization: Basic YWRtaW46TWF1dDFjUjBja3Mh" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Top of Funnel",
    "description": "Stage for newly acquired customers",
    "weight": 1,
    "isPublished": true
  }'
```

**Create a new segment:**

```bash
curl -X POST \
  'http://mautic.local/api/segments/new' \
  -H "Authorization: Basic YWRtaW46TWF1dDFjUjBja3Mh" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Top of Funnel",
    "description": "Top of Funnel Users",
    "isPublished": 1,
    "filters": [
      {
        "glue": "and",
        "object": "lead",
        "field": "stage",
        "type": "stage",
        "operator": "=",
        "properties": {"filter": 1}
      }
    ]
  }'
```

**Create a new contact:**

```bash
curl -X POST \
  'http://mautic.local/api/contacts/new' \
  -H "Authorization: Basic YWRtaW46TWF1dDFjUjBja3Mh" \
  -H 'Content-Type: application/json' \
  -d '{
    "firstname": "John",
    "lastname": "Doe",
    "email": "john.doe@example.com",
    "points": 10
  }'
```

**Verification checklist:**

- [ ] Stage created successfully
- [ ] Segment created successfully
- [ ] Contact created successfully
- [ ] Test email sent to contact appears in Mailhog

---

## Checkpoint 7: Cleanup

When you're finished, clean up the local environment:

```bash
minikube stop
minikube delete
```

- [ ] Minikube stopped
- [ ] Minikube cluster deleted

---

## Appendix: Troubleshooting

### Manual Configuration Updates

To manually update the Mautic configuration in the `config/local.php` file:

1. Access the Mautic pod:

   ```bash
   kubectl exec -it $(kubectl get pod -l app.kubernetes.io/name=mautic -o jsonpath='{.items[0].metadata.name}') -- /bin/bash
   ```

2. Fix file permissions:

   ```bash
   chmod 664 config/local.php
   chown www-data:www-data config/local.php
   ```

3. Edit the configuration file as needed, then update `mautic-values.yaml` accordingly.

### Common Issues

| Issue | Solution |
|-------|----------|
| Mautic returns 500 error | Run cache clear and permissions fix commands from Checkpoint 4.4 |
| Cannot access `*.local` domains | Ensure `minikube tunnel` is running with sudo |
| Pods stuck in pending state | Check available resources with `kubectl describe pod <pod-name>` |

---

## Quick Reference

### Essential Commands

```bash
# Check pod status
kubectl get pods

# View pod logs
kubectl logs <pod-name>

# Access pod shell
kubectl exec -it <pod-name> -- /bin/bash

# List all services
kubectl get svc

# Check Helm releases
helm list
```

---

**Questions or issues?** Refer to the [full blog post](https://kozlov.ski/mautic-5x-kubernetes-setup/) for detailed explanations and troubleshooting tips.
