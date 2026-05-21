# Kubernetes Workshop — Tools & Technology Overview

> Workshop: 21 May 2026  
> Infrastructure: 5 groups × 3 Ubuntu VMs = 15 nodes  
> Cluster layout: 1 primary (control-plane + worker) + 2 workers per group

---

## Table of Contents

1. [Cluster Infrastructure](#1-cluster-infrastructure)
2. [Platform Tools (deployed in every cluster)](#2-platform-tools-deployed-in-every-cluster)
3. [Student IDE](#3-student-ide)
4. [Application — joke-app](#4-application--joke-app)
5. [GitOps & Deployment Workflow](#5-gitops--deployment-workflow)
6. [Workshop Visualisation — Teafield](#6-workshop-visualisation--teafield)
7. [DNS & TLS](#7-dns--tls)
8. [Recommended Tools for Further Study](#8-recommended-tools-for-further-study)
9. [Recommended Learning Resources](#9-recommended-learning-resources)
10. [Setup Scripts (Sanitised)](#10-setup-scripts-sanitised)

---

## 1. Cluster Infrastructure

| Component | Description |
|---|---|
| **k3s** | Lightweight, production-ready Kubernetes distribution by Rancher. Single binary, minimal footprint — ideal for VMs and learning environments. Replaces kubeadm + containerd setup with one command. |
| **Ubuntu (LTS)** | Operating system on all 15 VMs. |
| **containerd** | Container runtime used by k3s (replaces Docker as the runtime inside the cluster). |
| **kubectl** | Official CLI for interacting with any Kubernetes cluster. The most fundamental tool every student must master. |
| **Helm** | Package manager for Kubernetes. Charts are reusable, versioned templates for deploying applications. Used for both the joke-app and all platform components. |

### Cluster layout per group

```
primary (vm-N)          worker 1 (vm-N+1)     worker 2 (vm-N+2)
  control-plane               worker                worker
  + worker role
  + code-server (IDE)
```

---

## 2. Platform Tools (deployed in every cluster)

### ArgoCD
- **Category:** GitOps / Continuous Delivery
- **What it does:** Watches a Git repository and automatically syncs the desired state declared in YAML/Helm into the cluster. Provides a web UI showing live application health.
- **Why it matters:** GitOps is the industry-standard workflow for managing Kubernetes in production. Changes go through Git instead of manual `kubectl apply`.
- **URL pattern:** `https://argocd.vm-N.k8s.it-scholar.com:<NodePort>`

### Harbor
- **Category:** Container Registry
- **What it does:** Private OCI-compliant image registry. Also acts as a **proxy cache** in front of Docker Hub / ghcr.io, so image pulls are fast and rate-limit-free.
- **Why it matters:** In real clusters you never pull images directly from the internet in production. Harbor provides vulnerability scanning, access control, and replicated storage.
- **URL pattern:** `https://harbor.vm-N.k8s.it-scholar.com:<NodePort>`

### Longhorn
- **Category:** Distributed Block Storage (CSI)
- **What it does:** Turns the local disks of all worker nodes into a replicated, distributed storage pool. Creates `PersistentVolumeClaim` volumes that survive node failures.
- **Why it matters:** Kubernetes itself is stateless — it needs an external storage driver (CSI) to provide durable volumes for databases and stateful workloads. Longhorn is the simplest self-hosted option.
- **URL pattern:** `https://longhorn.vm-N.k8s.it-scholar.com:<NodePort>`

### NGINX Ingress Controller
- **Category:** Ingress / Reverse Proxy
- **What it does:** Reads `Ingress` resources and configures NGINX to route external HTTP/HTTPS traffic to the correct `Service` inside the cluster.
- **Why it matters:** `LoadBalancer` services require a cloud provider. In bare-metal clusters, an Ingress controller + `NodePort` is the standard alternative.

### cert-manager
- **Category:** TLS Certificate Automation
- **What it does:** Watches `Certificate` and `Ingress` resources and automatically requests, renews, and stores TLS certificates. In this workshop it uses the Cloudflare **DNS-01** challenge with Let's Encrypt.
- **Why it matters:** Manual certificate management does not scale. cert-manager eliminates it entirely.

### CloudNativePG (CNPG) Operator
- **Category:** Database Operator
- **What it does:** Manages the full lifecycle of PostgreSQL clusters inside Kubernetes (provisioning, failover, backup, connection secrets). Introduces the `Cluster` CRD.
- **Why it matters:** Operators are the Kubernetes-native way to run stateful services. CNPG is the CNCF-recommended PostgreSQL operator.
- **Helm chart:** `cloudnative-pg` v0.28.2

---

## 3. Student IDE

### code-server
- **Category:** Browser-based IDE
- **What it does:** Runs VS Code entirely in the browser, served from the primary node of each group. Students connect via HTTPS without installing anything locally.
- **Why it matters:** Eliminates local environment differences. Every student starts with the same shell, kubectl, helm, and git available immediately.
- **TLS:** Let's Encrypt certificate via Cloudflare DNS-01 (certbot).
- **URL pattern:** `https://vm-N.k8s.it-scholar.com` (port 443)

---

## 4. Application — joke-app

A deliberately simple three-tier web application used throughout the workshop exercises.

### Architecture

```
Browser
  └─► NGINX Ingress
        └─► Frontend Service (ClusterIP :8080)
              └─► Backend Service (ClusterIP :3000)
                    └─► CloudNativePG Cluster (PostgreSQL :5432)
```

### Components

| Component | Technology | Image Base |
|---|---|---|
| **Frontend** | Node.js 20 + Express — serves an HTML page that calls the backend | `node:20-alpine` |
| **Backend** | Node.js 20 + Express — REST API `/joke` and `/health`; reads from PostgreSQL | `node:20-alpine` |
| **Database** | PostgreSQL 17.5, managed by CNPG operator | `ghcr.io/cloudnative-pg/postgresql:17.5` |

### Key Kubernetes concepts exercised

- `Deployment` with `livenessProbe` and `readinessProbe`
- `Service` (ClusterIP)
- `Ingress` (NGINX)
- `PersistentVolumeClaim` via Longhorn
- `Secret` (database credentials injected via CNPG)
- Pod `securityContext` (non-root, read-only filesystem, dropped capabilities)
- Resource `requests` and `limits`
- Helm `values.yaml` overrides per environment

### Helm chart structure

```
helm/
  Chart.yaml          # chart metadata + CNPG dependency
  values.yaml         # default values
  templates/
    _helpers.tpl
    NOTES.txt
    backend/
      deployment.yaml
      service.yaml
    frontend/
      deployment.yaml
      service.yaml
      ingress.yaml
    database/
      cluster.yaml    # CloudNativePG Cluster CRD
```

---

## 5. GitOps & Deployment Workflow

```
Developer pushes to Git
        │
        ▼
   GitHub Repository
        │
        ▼ (ArgoCD polls / webhook)
   ArgoCD Application
        │  renders Helm chart with values-groupN.yaml
        ▼
   Kubernetes Cluster
        │
        ├── Pulls images from Harbor proxy cache
        └── Creates / updates all resources
```

### Tools involved

| Tool | Role |
|---|---|
| **git** | Source of truth for all cluster state |
| **Helm** | Templating engine — one chart, multiple value files |
| **ArgoCD** | GitOps operator — detects drift and reconciles |
| **Harbor** | Image registry + proxy cache (avoids DockerHub rate limits) |

---

## 6. Workshop Visualisation — Teafield

- **Repository:** [github.com/bcp-technology-ug/teafield](https://github.com/bcp-technology-ug/teafield)
- **What it does:** A SvelteKit-based interactive diagram tool for visualising cluster topology. Each group has a customised diagram configured via `values-groupN.yaml`.
- **Deployment:** Deployed via ArgoCD using the Helm chart at `charts/field`.
- **URL pattern:** `https://teafield.vm-N.k8s.it-scholar.com:<NodePort>`
- **Tech stack:** SvelteKit, TypeScript, Vite, NGINX (inside container)

---

## 7. DNS & TLS

| Component | Role |
|---|---|
| **Cloudflare DNS** | Authoritative DNS for `k8s.it-scholar.com`. Wildcard A records point to each primary VM IP. |
| **Let's Encrypt** | Free, trusted CA. Issues 90-day certificates automatically. |
| **cert-manager** (in-cluster) | Renews certificates before expiry; stores them as Kubernetes `Secret` objects. |
| **certbot** (on primary VM) | Issues the initial TLS certificate for code-server before Kubernetes is ready. |
| **DNS-01 challenge** | Used instead of HTTP-01 because it works for wildcard certificates and does not require inbound port 80. |

---

## 8. Recommended Tools for Further Study

These tools are not part of this workshop but are widely used in real-world Kubernetes environments and are excellent next steps for students.

### CLI & Productivity

| Tool | Description | Install |
|---|---|---|
| **k9s** | Terminal UI for Kubernetes — browse pods, logs, exec, and describe resources without typing kubectl commands. | `brew install k9s` |
| **kubectx / kubens** | Switch between clusters (`kubectx`) and namespaces (`kubens`) instantly. | `brew install kubectx` |
| **stern** | Multi-pod log tailing — streams logs from multiple pods matching a regex, colour-coded by pod. | `brew install stern` |
| **kubecolor** | Wraps kubectl and adds colour to output. | `brew install hidetatz/tap/kubecolor` |
| **kustomize** | Template-free configuration management. Layers patches on top of base YAML. Built into kubectl. | Built into `kubectl` (`kubectl kustomize`) |

### Local Development Clusters

| Tool | Description |
|---|---|
| **k3d** | Runs k3s inside Docker containers — spin up a full multi-node cluster in seconds on a laptop. |
| **kind** (Kubernetes in Docker) | CNCF-maintained local cluster for CI and development. |
| **minikube** | Classic single-node local cluster; good for beginners. |

### Monitoring & Observability

| Tool | Description |
|---|---|
| **Prometheus** | De-facto metrics collection standard in Kubernetes. Scrapes `/metrics` endpoints from pods and the cluster. |
| **Grafana** | Dashboard and visualisation layer on top of Prometheus (and other data sources). |
| **kube-prometheus-stack** | Helm chart that deploys Prometheus, Grafana, Alertmanager, and all necessary exporters in one go. |
| **Loki** | Log aggregation system from Grafana Labs. Integrates with Grafana for unified logs + metrics. |
| **OpenTelemetry** | Vendor-neutral standard for traces, metrics, and logs. Emerging replacement for proprietary APM agents. |

### Security

| Tool | Description |
|---|---|
| **Trivy** | Container image and filesystem vulnerability scanner. Can be integrated into CI pipelines and Harbor. |
| **Kyverno** | Kubernetes-native policy engine — validate, mutate, and generate resources using YAML policies (no Rego required). |
| **OPA / Gatekeeper** | Policy engine using Rego language. More powerful but steeper learning curve than Kyverno. |
| **Falco** | Runtime security — detects unexpected system calls and container behaviour at runtime. |

### Secrets Management

| Tool | Description |
|---|---|
| **Sealed Secrets** | Encrypts Kubernetes Secrets so they can be safely committed to Git. Decrypted only inside the cluster. |
| **External Secrets Operator** | Syncs secrets from external stores (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault) into Kubernetes Secrets. |
| **HashiCorp Vault** | Full-featured secrets management platform. Industry standard for sensitive credential storage. |

### Storage & Backup

| Tool | Description |
|---|---|
| **Velero** | Backs up and restores Kubernetes resources and persistent volume data. Essential for disaster recovery. |
| **Rook / Ceph** | Production-grade distributed storage operator. More complex than Longhorn but more feature-rich. |

### Networking

| Tool | Description |
|---|---|
| **Cilium** | eBPF-based CNI plugin with built-in network policies, load balancing, and observability (replaces kube-proxy). |
| **MetalLB** | Bare-metal `LoadBalancer` implementation — gives `Service type: LoadBalancer` a real IP on non-cloud clusters. |
| **Traefik** | Alternative to NGINX Ingress; has native Let's Encrypt support and a dynamic configuration model. |

### CI/CD

| Tool | Description |
|---|---|
| **GitHub Actions** | Cloud CI/CD. Build images, run tests, push to Harbor, and trigger ArgoCD sync. |
| **Tekton** | Kubernetes-native CI/CD pipeline engine — pipelines run as pods inside the cluster. |
| **Flux** | ArgoCD alternative for GitOps, also CNCF graduated. Lighter weight, more CLI-oriented. |

### Databases & Stateful Workloads

| Tool | Description |
|---|---|
| **CloudNativePG** *(already used)* | Continue exploring: scheduled backups, replicas, connection pooling with PgBouncer. |
| **Redis Operator** | Run Redis (cache / pub-sub) as a managed Kubernetes workload. |
| **MinIO** | S3-compatible object storage that runs inside Kubernetes. Useful for backups, Loki storage, and artefact storage. |

---

## 9. Recommended Learning Resources

| Resource | URL | Notes |
|---|---|---|
| Kubernetes official docs | https://kubernetes.io/docs | Always the authoritative reference |
| CNCF Landscape | https://landscape.cncf.io | Interactive map of the entire cloud-native ecosystem |
| killer.sh / KodeKloud | https://killer.sh | Practice environments for CKA/CKAD/CKS exams |
| ArgoCD docs | https://argo-cd.readthedocs.io | Comprehensive GitOps reference |
| Helm docs | https://helm.sh/docs | Chart authoring, hooks, library charts |
| CloudNativePG docs | https://cloudnative-pg.io/docs | Operator reference for PostgreSQL |
| cert-manager docs | https://cert-manager.io/docs | Issuers, ACME, DNS-01 challenge detail |
| Longhorn docs | https://longhorn.io/docs | Distributed storage, snapshots, backups |
| Harbor docs | https://goharbor.io/docs | Registry, proxy cache, vulnerability scanning |

---

### CNCF Certification Path

| Certification | Focus |
|---|---|
| **KCNA** — Kubernetes and Cloud Native Associate | Broad conceptual overview; good first cert |
| **CKA** — Certified Kubernetes Administrator | Cluster administration, troubleshooting, networking |
| **CKAD** — Certified Kubernetes Application Developer | Deploying and managing applications on Kubernetes |
| **CKS** — Certified Kubernetes Security Specialist | Hardening, policy, runtime security (requires CKA) |

---

## 10. Setup Scripts (Sanitised)

These are the exact scripts used to provision the workshop environment, with all real credentials, tokens, and IP addresses replaced by clearly labelled placeholders. They are intended as study material and as a reusable starting point for future workshops.

> **Before using either script**, replace every value marked `YOUR_*` with real credentials and update any domain/IP values to match your infrastructure.

---

### 10.1 `deploy_k8s_groups.sh` — VM provisioning & IDE setup

**What this script does, step by step:**

1. Reads a CSV file (`k8s_groups.csv`) listing 15 VMs — 5 groups of 3, each with a `role` (`primary` or `worker`), an IP address, and a per-student password.
2. For each group's **primary** node it:
   - Reads the VM's hostname via SSH.
   - Creates or updates a Cloudflare DNS A record pointing `<hostname>.your-domain.com` at that IP.
   - Installs **code-server** (VS Code in the browser).
   - Obtains a TLS certificate from Let's Encrypt using the **Cloudflare DNS-01** challenge (certbot).
   - Creates a `student` user, sets the password, and configures code-server to serve on HTTPS port 443.
   - Generates a fresh **ed25519 SSH keypair** on the primary so it can SSH into its workers without a password.
3. For each group's **worker** nodes it:
   - Creates the `student` user with the CSV password.
   - Installs the primary's public key into `root`'s `authorized_keys`.
4. Adds the worker hostnames to `/etc/hosts` and `~/.ssh/config` on the primary so `ssh root@vm-N+1` works out of the box.
5. Optionally **verifies** the deployment by checking that code-server is active and that SSH from primary to each worker succeeds.

**Prerequisites (run from your local machine):**
- `ssh` access to all 15 VMs as `root` using your local SSH key.
- A Cloudflare account with API token scoped to `Zone:DNS:Edit`.
- `python3` available locally (used to parse Cloudflare API JSON responses).

**Input file format — `k8s_groups.csv`:**
```
# role,ip,password
primary,203.0.113.1,SomePassword1
worker,203.0.113.2,SomePassword2
worker,203.0.113.3,SomePassword3
primary,203.0.113.4,SomePassword4
...
```
Three rows per group; groups are sequential. The first row of each triple is the primary.

```bash
#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# deploy_k8s_groups.sh
#
# Provisions N groups of 3 Ubuntu VMs from a CSV file.
# Each group gets:
#   primary  — code-server (VS Code in browser) + TLS via Let's Encrypt
#   workers  — student user + authorised SSH key from primary
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Configuration ─────────────────────────────────────────────────────────────
SSH_USER="root"
SSH_KEY="${HOME}/.ssh/id_rsa"         # local private key used to reach VMs

GROUPS_FILE="${SCRIPT_DIR}/k8s_groups.csv"

DOMAIN_SUFFIX="your-domain.com"       # ← replace with your domain

IDE_USER="student"
IDE_PORT="443"

# Cloudflare credentials — pass as environment variables, never hardcode.
# Generate an API token at https://dash.cloudflare.com/profile/api-tokens
# Required permissions: Zone > DNS > Edit
CF_API_TOKEN="${CF_API_TOKEN:-}"      # export CF_API_TOKEN=<your token>
CF_ZONE_ID="${CF_ZONE_ID:-}"          # export CF_ZONE_ID=<your zone id>
                                      # Zone ID is on the Cloudflare dashboard
                                      # Overview page for your domain.

DRY_RUN="false"
PARALLEL="false"
PARALLEL_JOBS="3"
VERIFY="false"

# ── CLI argument parsing ──────────────────────────────────────────────────────
usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --dry-run         Print what would be done, without making changes
  --parallel        Deploy groups in parallel (uses background subshells)
  --jobs N          Max parallel jobs (default: 3; requires --parallel)
  --verify          SSH-verify connectivity after deployment
  -h, --help        Show this help

Environment variables:
  CF_API_TOKEN      Cloudflare API token  (Zone:DNS:Edit)
  CF_ZONE_ID        Cloudflare Zone ID for your domain
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)  DRY_RUN="true";  shift ;;
    --parallel) PARALLEL="true"; shift ;;
    --verify)   VERIFY="true";   shift ;;
    --jobs)
      [[ $# -lt 2 ]] && { echo "[ERROR] --jobs requires a number"; exit 1; }
      PARALLEL_JOBS="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "[ERROR] Unknown option: $1"; usage; exit 1 ;;
  esac
done

# ── Pre-flight checks ─────────────────────────────────────────────────────────
# Abort early rather than fail halfway through provisioning.

[[ -f "$GROUPS_FILE" ]] || { echo "[ERROR] Missing file: $GROUPS_FILE"; exit 1; }

# Strip .pub suffix if the user accidentally pointed at the public key
if [[ "$SSH_KEY" == *.pub ]]; then
  maybe="${SSH_KEY%.pub}"; [[ -f "$maybe" ]] && SSH_KEY="$maybe"
fi

if [[ "$DRY_RUN" != "true" ]]; then
  [[ -f "$SSH_KEY" ]]      || { echo "[ERROR] SSH key not found: $SSH_KEY"; exit 1; }
  [[ -n "$CF_API_TOKEN" ]] || { echo "[ERROR] CF_API_TOKEN is not set"; exit 1; }
  [[ -n "$CF_ZONE_ID" ]]   || { echo "[ERROR] CF_ZONE_ID is not set"; exit 1; }
fi

command -v python3 >/dev/null 2>&1 || { echo "[ERROR] python3 required for Cloudflare API JSON"; exit 1; }

# SSH options used for every remote connection:
#   BatchMode=yes           — never prompt for a password (fail fast instead)
#   ConnectTimeout=15       — do not hang forever if a VM is unreachable
#   StrictHostKeyChecking=accept-new — trust new host keys, reject changed ones
SSH_OPTS=(-i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new)

# ── CSV parsing ───────────────────────────────────────────────────────────────
# Populates three parallel arrays: ROLES, IPS, PASSWORDS
# Lines starting with # and blank lines are ignored.

ROLES=()
IPS=()
PASSWORDS=()

while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
  line="$(echo "$raw_line" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
  [[ -z "$line" || "$line" == \#* ]] && continue

  IFS=',' read -r raw_role raw_ip raw_pass <<<"$line"

  role="$(echo "$raw_role" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
  ip="$(echo "$raw_ip"   | tr -d '[:space:]')"
  pass="$(echo "$raw_pass" | tr -d '[:space:]')"

  [[ "$role" == "primary" || "$role" == "worker" ]] || {
    echo "[WARN] Unknown role '$role' — skipping"; continue; }
  [[ -n "$ip" ]]   || { echo "[ERROR] Empty IP in: $line";   exit 1; }
  [[ -n "$pass" ]] || { echo "[ERROR] Empty pass in: $line"; exit 1; }

  ROLES+=("$role")
  IPS+=("$ip")
  PASSWORDS+=("$pass")
done < "$GROUPS_FILE"

TOTAL="${#IPS[@]}"
# Each group has exactly 3 VMs; total must be a multiple of 3.
(( TOTAL % 3 == 0 && TOTAL > 0 )) || {
  echo "[ERROR] Expected a multiple of 3 VMs in $GROUPS_FILE, got $TOTAL"; exit 1; }

NUM_GROUPS=$(( TOTAL / 3 ))
echo "[INFO] Loaded $TOTAL VMs ($NUM_GROUPS groups) from $GROUPS_FILE"

# ── Cloudflare DNS helper ─────────────────────────────────────────────────────
# Creates or updates an A record via the Cloudflare REST API.
# Uses python3 to build and parse JSON (no jq dependency required).
cf_dns_upsert() {
  local ip="$1" fqdn="$2"
  local api="https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records"
  local auth_header="Authorization: Bearer ${CF_API_TOKEN}"

  # Check whether a record already exists for this name
  local response record_id
  response=$(curl -sS -X GET "${api}?type=A&name=${fqdn}" \
    -H "$auth_header" -H "Content-Type: application/json")

  record_id=$(echo "$response" | python3 -c "
import json, sys
d = json.load(sys.stdin)
if not d.get('success'):
    print('[ERROR] CF API: ' + json.dumps(d.get('errors',[])), file=sys.stderr)
    sys.exit(1)
r = d.get('result', [])
print(r[0]['id'] if r else '')")

  local payload
  payload=$(python3 -c "
import json
print(json.dumps({'type':'A','name':'${fqdn}','content':'${ip}','ttl':1,'proxied':False}))")

  if [[ -n "$record_id" ]]; then
    # Record exists — update it (PUT)
    curl -sS -X PUT "${api}/${record_id}" \
      -H "$auth_header" -H "Content-Type: application/json" \
      --data "$payload" | python3 -c "
import json, sys
d = json.load(sys.stdin)
if not d.get('success'):
    print('[ERROR] DNS update failed: ' + json.dumps(d.get('errors',[])), file=sys.stderr)
    sys.exit(1)" || return 1
    echo "[DNS] Updated  A: $fqdn -> $ip"
  else
    # Record does not exist — create it (POST)
    curl -sS -X POST "$api" \
      -H "$auth_header" -H "Content-Type: application/json" \
      --data "$payload" | python3 -c "
import json, sys
d = json.load(sys.stdin)
if not d.get('success'):
    print('[ERROR] DNS create failed: ' + json.dumps(d.get('errors',[])), file=sys.stderr)
    sys.exit(1)" || return 1
    echo "[DNS] Created   A: $fqdn -> $ip"
  fi
}

# ── SSH helper: read a VM's short hostname ────────────────────────────────────
get_vm_hostname() {
  local ip="$1"
  ssh -n "${SSH_OPTS[@]}" "$SSH_USER@$ip" "hostname -s" 2>/dev/null | tr -d '[:space:]'
}

# ── deploy_group ──────────────────────────────────────────────────────────────
# Provisions one complete group (primary + 2 workers).
deploy_group() {
  local group_num="$1"
  local primary_ip="$2"   primary_pass="$3"
  local worker1_ip="$4"   worker1_pass="$5"
  local worker2_ip="$6"   worker2_pass="$7"

  local tag="[GROUP-${group_num}]"
  echo ""
  echo "$tag ════════════════════════════════════════════════"
  echo "$tag primary=$primary_ip  worker1=$worker1_ip  worker2=$worker2_ip"

  # ── Step 1: Resolve hostnames ─────────────────────────────────────────────
  # We read the OS hostname of each VM so we can set a meaningful DNS record
  # and configure /etc/hosts entries without hardcoding hostnames in the CSV.
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "$tag [DRY-RUN] Would SSH to each node and call 'hostname -s'"
    echo "$tag [DRY-RUN] Would create DNS, deploy code-server, keypair, student users"
    return 0
  fi

  local primary_hostname worker1_hostname worker2_hostname
  primary_hostname=$(get_vm_hostname "$primary_ip")
  worker1_hostname=$(get_vm_hostname "$worker1_ip")
  worker2_hostname=$(get_vm_hostname "$worker2_ip")

  [[ -n "$primary_hostname" ]] || { echo "$tag [ERROR] Could not read hostname from primary"; return 1; }
  [[ -n "$worker1_hostname" ]] || { echo "$tag [ERROR] Could not read hostname from worker1"; return 1; }
  [[ -n "$worker2_hostname" ]] || { echo "$tag [ERROR] Could not read hostname from worker2"; return 1; }

  local fqdn="${primary_hostname}.${DOMAIN_SUFFIX}"
  echo "$tag FQDN: $fqdn | worker1: $worker1_hostname | worker2: $worker2_hostname"

  # ── Step 2: Cloudflare DNS A record for primary ───────────────────────────
  echo "$tag Creating DNS record $fqdn -> $primary_ip ..."
  cf_dns_upsert "$primary_ip" "$fqdn" || { echo "$tag [ERROR] DNS upsert failed"; return 1; }

  # ── Step 3: code-server + TLS on primary ─────────────────────────────────
  # The entire block below runs as a heredoc on the remote VM.
  # Key steps inside the remote script:
  #   a) Install code-server via the official install script.
  #   b) Create the 'student' user with the CSV password and sudo rights.
  #   c) Obtain a TLS cert via certbot + Cloudflare DNS-01 (no port 80 needed).
  #   d) Configure code-server to use the cert and listen on port 443.
  #   e) Enable and start code-server as a systemd service.
  echo "$tag Installing code-server on $primary_ip ..."
  ssh "${SSH_OPTS[@]}" "$SSH_USER@$primary_ip" \
      "IDE_USER='$IDE_USER' IDE_PORT='$IDE_PORT' IDE_PASS='$primary_pass' \
       CF_API_TOKEN='$CF_API_TOKEN' FQDN='$fqdn' bash -s" <<'REMOTE_PRIMARY'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y curl sudo git ca-certificates certbot python3-certbot-dns-cloudflare

# Install code-server if not already present
if ! command -v code-server >/dev/null 2>&1; then
  curl -fsSL https://code-server.dev/install.sh | sh
fi

# Create the student user
if ! id -u "$IDE_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$IDE_USER"
fi
usermod -aG sudo "$IDE_USER"
echo "$IDE_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$IDE_USER"
chmod 440 "/etc/sudoers.d/$IDE_USER"
echo "$IDE_USER:$IDE_PASS" | chpasswd

# Store Cloudflare credentials for certbot DNS-01 challenge
install -d -m 700 /etc/letsencrypt
cat > /etc/letsencrypt/cloudflare.ini <<EOINI
dns_cloudflare_api_token = $CF_API_TOKEN
EOINI
chmod 600 /etc/letsencrypt/cloudflare.ini

# Request TLS certificate if it doesn't already exist
# DNS-01 is used so port 80 never needs to be open; Cloudflare proves ownership.
if [[ ! -d "/etc/letsencrypt/live/$FQDN" ]]; then
  certbot certonly \
    --dns-cloudflare \
    --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
    --dns-cloudflare-propagation-seconds 30 \
    -d "$FQDN" \
    --non-interactive --agree-tos \
    --register-unsafely-without-email
fi

# Copy certificates into the code-server config directory
CERT_SRC="/etc/letsencrypt/live/$FQDN"
CERT_DST="/home/$IDE_USER/.config/code-server"
install -d -m 700 -o "$IDE_USER" -g "$IDE_USER" "$CERT_DST"
cp "$CERT_SRC/fullchain.pem" "$CERT_DST/cert.pem"
cp "$CERT_SRC/privkey.pem"   "$CERT_DST/key.pem"
chown "$IDE_USER:$IDE_USER"  "$CERT_DST/cert.pem" "$CERT_DST/key.pem"
chmod 600                     "$CERT_DST/key.pem"

# Deploy hook: re-copy certs whenever certbot auto-renews them
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/code-server.sh <<HOOK
#!/bin/bash
cp "$CERT_SRC/fullchain.pem" "$CERT_DST/cert.pem"
cp "$CERT_SRC/privkey.pem"   "$CERT_DST/key.pem"
chown "$IDE_USER:$IDE_USER"  "$CERT_DST/cert.pem" "$CERT_DST/key.pem"
chmod 600                     "$CERT_DST/key.pem"
systemctl restart "code-server@$IDE_USER"
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/code-server.sh

# Write the code-server configuration file
cat > "$CERT_DST/config.yaml" <<EOCFG
bind-addr: 0.0.0.0:$IDE_PORT
auth: password
password: $IDE_PASS
cert: $CERT_DST/cert.pem
cert-key: $CERT_DST/key.pem
EOCFG
chown "$IDE_USER:$IDE_USER" "$CERT_DST/config.yaml"

# Allow code-server to bind the privileged port 443
mkdir -p /etc/systemd/system/code-server@.service.d
cat > /etc/systemd/system/code-server@.service.d/override.conf <<EOOV
[Service]
AmbientCapabilities=CAP_NET_BIND_SERVICE
EOOV

systemctl daemon-reload
systemctl enable --now "code-server@$IDE_USER"
systemctl restart "code-server@$IDE_USER"

# Open port 443 if ufw is active
command -v ufw >/dev/null 2>&1 && ufw allow 443/tcp || true
# Enable automatic cert renewal timer
systemctl enable --now certbot.timer 2>/dev/null || true

echo "[OK] code-server ready at https://$FQDN"
REMOTE_PRIMARY

  echo "$tag [OK] code-server deployed -> https://$fqdn"

  # ── Step 4: Generate SSH keypair on primary ───────────────────────────────
  # Creates /root/.ssh/k8s_group_key (ed25519) on the primary.
  # This key is used so the primary can SSH into its workers as root
  # without a password — essential for Kubernetes node joining.
  echo "$tag Generating ed25519 SSH keypair on $primary_ip ..."
  local primary_pubkey
  primary_pubkey=$(ssh "${SSH_OPTS[@]}" "$SSH_USER@$primary_ip" '
    KEY=/root/.ssh/k8s_group_key
    if [[ ! -f "$KEY" ]]; then
      ssh-keygen -q -t ed25519 -N "" -C "k8s-group-primary" -f "$KEY"
    fi
    cat "${KEY}.pub"')

  [[ -n "$primary_pubkey" ]] || { echo "$tag [ERROR] Failed to read keypair"; return 1; }

  # ── Step 5: Configure worker nodes ───────────────────────────────────────
  # Each worker gets:
  #   - a 'student' user with the CSV password
  #   - the primary's public key in root's authorized_keys
  local worker_num=1
  for worker_ip in "$worker1_ip" "$worker2_ip"; do
    local worker_pass
    worker_pass="$(if [[ $worker_num -eq 1 ]]; then echo "$worker1_pass"; else echo "$worker2_pass"; fi)"

    echo "$tag Configuring worker$worker_num ($worker_ip) ..."
    ssh "${SSH_OPTS[@]}" "$SSH_USER@$worker_ip" \
        "IDE_USER='$IDE_USER' IDE_PASS='$worker_pass' PRIMARY_PUBKEY='$primary_pubkey' bash -s" <<'REMOTE_WORKER'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get install -y sudo

if ! id -u "$IDE_USER" >/dev/null 2>&1; then useradd -m -s /bin/bash "$IDE_USER"; fi
usermod -aG sudo "$IDE_USER"
echo "$IDE_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$IDE_USER"
chmod 440 "/etc/sudoers.d/$IDE_USER"
echo "$IDE_USER:$IDE_PASS" | chpasswd

# Authorise the primary's key so 'ssh root@worker' works from the primary
install -d -m 700 /root/.ssh
AUTH_KEYS=/root/.ssh/authorized_keys
touch "$AUTH_KEYS" && chmod 600 "$AUTH_KEYS"
if ! grep -qF "$PRIMARY_PUBKEY" "$AUTH_KEYS" 2>/dev/null; then
  echo "$PRIMARY_PUBKEY" >> "$AUTH_KEYS"
fi
echo "[OK] Worker configured"
REMOTE_WORKER
    echo "$tag [OK] worker$worker_num configured"
    worker_num=$(( worker_num + 1 ))
  done

  # ── Step 6: Register worker hostnames on primary ──────────────────────────
  # Adds /etc/hosts entries and ~/.ssh/config Host blocks on the primary so
  # the student can type 'ssh root@vm-2' instead of 'ssh root@203.0.113.2'.
  echo "$tag Adding worker hostnames to /etc/hosts on primary ..."
  ssh "${SSH_OPTS[@]}" "$SSH_USER@$primary_ip" \
    "W1_IP='$worker1_ip' W1_HOST='$worker1_hostname' \
     W2_IP='$worker2_ip' W2_HOST='$worker2_hostname' bash -s" <<'REMOTE_HOSTS'
set -euo pipefail
HOSTS=/etc/hosts

add_host() {
  local ip="$1" hostname="$2"
  sed -i "/[[:space:]]${hostname}\([[:space:]]\|$\)/d" "$HOSTS"
  echo "${ip} ${hostname}" >> "$HOSTS"
}
add_host "$W1_IP" "$W1_HOST"
add_host "$W2_IP" "$W2_HOST"

# Write SSH client config so the dedicated group key is used automatically
SSH_CONF=/root/.ssh/config
touch "$SSH_CONF" && chmod 600 "$SSH_CONF"

configure_ssh_host() {
  local hostname="$1"
  grep -q "^Host ${hostname}$" "$SSH_CONF" 2>/dev/null && \
    perl -i -0pe "s/^Host ${hostname}\n(  [^\n]*\n)*//gm" "$SSH_CONF" 2>/dev/null || true
  cat >> "$SSH_CONF" <<SSHEOF

Host ${hostname}
  HostName ${hostname}
  User root
  IdentityFile /root/.ssh/k8s_group_key
  StrictHostKeyChecking accept-new
SSHEOF
}
configure_ssh_host "$W1_HOST"
configure_ssh_host "$W2_HOST"
REMOTE_HOSTS

  echo "$tag [DONE] Group $group_num complete"
  echo "$tag   IDE  : https://$fqdn  (user: $IDE_USER)"
  echo "$tag   SSH  : ssh root@$worker1_hostname | ssh root@$worker2_hostname"
}

# ── verify_group ──────────────────────────────────────────────────────────────
# Smoke-tests a deployed group:
#   1. Checks that code-server systemd unit is active on the primary.
#   2. Curls the primary's HTTPS endpoint to confirm TLS is working.
#   3. SSHes from the primary to each worker using the group key.
verify_group() {
  local group_num="$1" primary_ip="$2" worker1_ip="$3" worker2_ip="$4"
  local tag="[VERIFY-GROUP-${group_num}]"

  if ssh -n "${SSH_OPTS[@]}" "$SSH_USER@$primary_ip" \
      "systemctl is-active --quiet 'code-server@${IDE_USER}' && \
       curl -fsSk --max-time 5 'https://127.0.0.1:${IDE_PORT}' >/dev/null 2>&1"; then
    echo "$tag [OK] code-server active"
  else
    echo "$tag [FAIL] code-server not healthy"
    return 1
  fi

  local w1h w2h
  w1h=$(get_vm_hostname "$worker1_ip")
  w2h=$(get_vm_hostname "$worker2_ip")

  for whost in "$w1h" "$w2h"; do
    if ssh -n "${SSH_OPTS[@]}" "$SSH_USER@$primary_ip" \
        "ssh -o BatchMode=yes -o ConnectTimeout=5 \
             -i /root/.ssh/k8s_group_key \
             -o StrictHostKeyChecking=accept-new \
             root@${whost} 'echo ok'" 2>/dev/null | grep -q ok; then
      echo "$tag [OK] SSH primary -> $whost"
    else
      echo "$tag [FAIL] SSH primary -> $whost"
      return 1
    fi
  done
}

# ── Main loop ─────────────────────────────────────────────────────────────────
# Iterates over all groups. With --parallel, each group is deployed in a
# background subshell; --jobs limits concurrency to avoid overloading the
# Cloudflare API and the local SSH connection pool.

FAILURES_FILE="$(mktemp)"
cleanup() { rm -f "$FAILURES_FILE"; }
trap cleanup EXIT

run_group() {
  local g="$1"
  local base=$(( (g - 1) * 3 ))
  deploy_group "$g" \
    "${IPS[$base]}"        "${PASSWORDS[$base]}" \
    "${IPS[$(( base+1 ))]}" "${PASSWORDS[$(( base+1 ))]}" \
    "${IPS[$(( base+2 ))]}" "${PASSWORDS[$(( base+2 ))]}" || {
      echo "$g" >> "$FAILURES_FILE"; return 1; }
  [[ "$VERIFY" == "true" ]] && \
    verify_group "$g" "${IPS[$base]}" "${IPS[$(( base+1 ))]}" "${IPS[$(( base+2 ))]}" || \
    echo "$g" >> "$FAILURES_FILE"
}

echo ""
echo "[INFO] Starting deployment"
echo "[INFO] Domain: $DOMAIN_SUFFIX | IDE user: $IDE_USER | Dry-run: $DRY_RUN"
echo ""

for g in $(seq 1 "$NUM_GROUPS"); do
  if [[ "$PARALLEL" == "true" ]]; then
    ( run_group "$g" 2>&1 | sed "s/^/[group-$g] /" ) &
    while [[ "$(jobs -rp | wc -l | tr -d ' ')" -ge "$PARALLEL_JOBS" ]]; do sleep 0.2; done
  else
    run_group "$g"
  fi
done

[[ "$PARALLEL" == "true" ]] && wait

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════"
if [[ -s "$FAILURES_FILE" ]]; then
  echo "[SUMMARY] Failed groups:"
  while IFS= read -r gnum; do echo "  - Group $gnum"; done < "$FAILURES_FILE"
  exit 1
else
  echo "[SUMMARY] All $NUM_GROUPS groups deployed successfully."
fi
echo "══════════════════════════════════════════════"
```

---

### 10.2 `deploy-teafield.sh` — Teafield deployment via ArgoCD

**What this script does, step by step:**

1. Iterates over all 5 group clusters (or a single named group if one is passed as an argument).
2. For each cluster it:
   - Logs into that cluster's ArgoCD instance using the admin password.
   - Creates or updates an ArgoCD `Application` resource pointing at the Teafield Helm chart in GitHub.
   - Passes the group-specific `values-groupN.yaml` file to customise the diagram shown in each cluster.
   - Sets `--sync-policy automated` with `--self-heal` and `--auto-prune` so ArgoCD keeps the live state in sync with Git automatically.
   - Triggers an immediate sync and waits up to 5 minutes for it to complete.
3. Prints the live URL for each deployed cluster.

**Prerequisites:**
- `argocd` CLI installed (`brew install argocd` on macOS).
- ArgoCD already running in each cluster (installed as part of the platform setup).
- A `values-groupN.yaml` file for each group in the same directory as this script.

**Values file** (`values-groupN.yaml`) — minimum required fields:
```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: teafield.vm-N.your-domain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: teafield-vm-N-tls
      hosts:
        - teafield.vm-N.your-domain.com
```

```bash
#!/usr/bin/env bash
# deploy-teafield.sh — Deploy Teafield to all Kubernetes clusters via ArgoCD
#
# Usage:
#   ./deploy-teafield.sh              # deploy to all groups
#   ./deploy-teafield.sh group2       # deploy to one group only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_URL="https://github.com/bcp-technology-ug/teafield"
CHART_PATH="charts/field"
CHART_REVISION="main"
NAMESPACE="teafield"

# ── Cluster registry ──────────────────────────────────────────────────────────
# Parallel indexed arrays — one entry per group.
# Replace the placeholder values with your real ArgoCD addresses and passwords.
# The NodePort varies per cluster; find it with:
#   kubectl get svc -n argocd argocd-server

CLUSTER_GROUPS=(group1 group2 group3 group4 group5)

# ArgoCD server addresses (host:port — NodePort of the argocd-server Service)
ARGOCD_SERVERS=(
  "argocd.vm-1.your-domain.com:NODEPORT_GROUP1"   # ← replace NodePorts
  "argocd.vm-4.your-domain.com:NODEPORT_GROUP2"
  "argocd.vm-7.your-domain.com:NODEPORT_GROUP3"
  "argocd.vm-10.your-domain.com:NODEPORT_GROUP4"
  "argocd.vm-13.your-domain.com:NODEPORT_GROUP5"
)

# ArgoCD admin passwords — retrieve with:
#   kubectl get secret argocd-initial-admin-secret \
#     -n argocd -o jsonpath='{.data.password}' | base64 -d
# Store these in a secrets manager rather than in the script for production use.
ARGOCD_PASSWORDS=(
  "YOUR_ARGOCD_PASSWORD_GROUP1"   # ← replace with real passwords
  "YOUR_ARGOCD_PASSWORD_GROUP2"
  "YOUR_ARGOCD_PASSWORD_GROUP3"
  "YOUR_ARGOCD_PASSWORD_GROUP4"
  "YOUR_ARGOCD_PASSWORD_GROUP5"
)

# Expected Teafield URLs after deployment (used only for the summary output)
TEAFIELD_URLS=(
  "https://teafield.vm-1.your-domain.com:NODEPORT_GROUP1"
  "https://teafield.vm-4.your-domain.com:NODEPORT_GROUP2"
  "https://teafield.vm-7.your-domain.com:NODEPORT_GROUP3"
  "https://teafield.vm-10.your-domain.com:NODEPORT_GROUP4"
  "https://teafield.vm-13.your-domain.com:NODEPORT_GROUP5"
)

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%H:%M:%S')] $*"; }
ok()   { echo "[$(date '+%H:%M:%S')] OK    $*"; }
err()  { echo "[$(date '+%H:%M:%S')] ERROR $*" >&2; }

# Returns the 0-based array index for a group name, or -1 if not found.
group_index() {
  local needle="$1" i
  for i in "${!CLUSTER_GROUPS[@]}"; do
    [[ "${CLUSTER_GROUPS[$i]}" == "$needle" ]] && echo "$i" && return
  done
  echo "-1"
}

require_cmd() {
  command -v "$1" &>/dev/null || {
    err "Required command '$1' not found. Install with: brew install $1"
    exit 1
  }
}

# ── deploy_group ──────────────────────────────────────────────────────────────
deploy_group() {
  local group="$1"
  local idx; idx="$(group_index "$group")"
  local server="${ARGOCD_SERVERS[$idx]}"
  local password="${ARGOCD_PASSWORDS[$idx]}"
  local values_file="${SCRIPT_DIR}/values-${group}.yaml"
  local url="${TEAFIELD_URLS[$idx]}"

  [[ -f "$values_file" ]] || { err "Values file not found: $values_file"; return 1; }

  log "──────────────────────────────────────────"
  log "Deploying to ${group} → ${server}"
  log "──────────────────────────────────────────"

  # Log in to this group's ArgoCD.
  # --insecure skips TLS verification for the ArgoCD API — acceptable here
  # because we are using NodePort (not a production-grade HTTPS endpoint).
  log "Logging in to ArgoCD ..."
  argocd login "${server}" \
    --username admin \
    --password "${password}" \
    --insecure

  # Create or update the ArgoCD Application.
  # --upsert means: create if it does not exist, update (patch) if it does.
  # --sync-policy automated + --self-heal: ArgoCD will auto-apply any drift.
  # --auto-prune: resources removed from Git are also removed from the cluster.
  # --sync-option "CreateNamespace=true": ArgoCD creates the namespace if absent.
  log "Upserting ArgoCD Application 'teafield' ..."
  argocd app create teafield \
    --repo "${REPO_URL}" \
    --path "${CHART_PATH}" \
    --revision "${CHART_REVISION}" \
    --dest-server "https://kubernetes.default.svc" \
    --dest-namespace "${NAMESPACE}" \
    --values-literal-file "${values_file}" \
    --sync-policy automated \
    --self-heal \
    --auto-prune \
    --sync-option "CreateNamespace=true" \
    --upsert \
    --insecure

  # Trigger an immediate sync and block until it completes (or times out).
  # This ensures the script does not return before the pods are running.
  log "Syncing application (timeout: 300s) ..."
  argocd app sync teafield \
    --insecure \
    --timeout 300

  ok "Teafield deployed to ${group}!"
  ok "URL: ${url}"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────
require_cmd argocd

# Accept an optional list of group names; default to all groups.
if [[ $# -gt 0 ]]; then
  TARGET_GROUPS=("$@")
else
  TARGET_GROUPS=("${CLUSTER_GROUPS[@]}")
fi

# Validate all requested group names before starting any deployment.
for group in "${TARGET_GROUPS[@]}"; do
  [[ "$(group_index "$group")" != "-1" ]] || {
    err "Unknown group: '${group}'. Valid: ${CLUSTER_GROUPS[*]}"; exit 1; }
done

FAILED=()
for group in "${TARGET_GROUPS[@]}"; do
  deploy_group "${group}" || FAILED+=("${group}")
done

echo ""
if [[ ${#FAILED[@]} -eq 0 ]]; then
  ok "All clusters deployed successfully!"
  echo ""
  echo "Teafield URLs:"
  for group in "${TARGET_GROUPS[@]}"; do
    idx="$(group_index "$group")"
    echo "  ${group}: ${TEAFIELD_URLS[$idx]}"
  done
else
  err "Failed groups: ${FAILED[*]}"
  exit 1
fi
```

---

### 10.3 Input file — `k8s_groups.csv`

The CSV file that drives `deploy_k8s_groups.sh`. Three rows per group, always in the order `primary, worker, worker`. Lines starting with `#` are ignored.

```csv
# role,ip,password
# Group 1
primary,203.0.113.1,ReplaceWithStrongPassword
worker,203.0.113.2,ReplaceWithStrongPassword
worker,203.0.113.3,ReplaceWithStrongPassword
# Group 2
primary,203.0.113.4,ReplaceWithStrongPassword
worker,203.0.113.5,ReplaceWithStrongPassword
worker,203.0.113.6,ReplaceWithStrongPassword
# ... (one triple per group)
```

> Use RFC 5737 documentation addresses (203.0.113.x) as examples. Replace with the real IPs assigned by your cloud or hosting provider.
