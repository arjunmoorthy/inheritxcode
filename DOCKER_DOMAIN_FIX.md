# Docker Domain Configuration Fix

## Problem
The Docker setup was missing an nginx reverse proxy service to handle custom domain routing for the patient and doctor APIs.

## Solution
Added an nginx reverse proxy service to the `docker-compose.yml` that routes traffic based on domain names.
The nginx startup now auto-selects:
- `http.conf` before certificates exist
- `https.conf` after a shared multi-domain certificate is present

## Changes Made

### 1. Updated `docker-compose.yml`
- Added `nginx` service using `nginx:alpine` image
- Configured ports 80 and 443 for HTTP/HTTPS traffic
- Mounted nginx configuration and SSL certificate volumes
- Set up dependencies on `patient-api` and `doctor-api` services
- Changed API service ports from `127.0.0.1` binding to public binding (`8000:8000`, `8001:8001`)
- Updated CORS settings to include custom domains

### 2. Updated `nginx/nginx.conf`
- Added health check endpoint for nginx itself
- Configured domain-based routing for:
  - `oncolife-patient-api.inheritxdev.in` → `patient-api:8000`
  - `oncolife-doctor-api.inheritxdev.in` → `doctor-api:8001`
  - `oncolife-patient.inheritxdev.in` → patient web frontend
  - `oncolife-doctor.inheritxdev.in` → doctor web frontend
- Enabled HTTP to HTTPS redirect for production
- Added direct proxy for local testing without SSL

## Usage

### Start All Services
```bash
docker compose up -d
```

### Start Specific Services
```bash
docker compose up -d postgres patient-api doctor-api nginx
```

### Test Domain Routing
```bash
# Test Patient API
curl -H "Host: api.patient.healthai.global" http://localhost/health

# Test Doctor API
curl -H "Host: api.doctor.healthai.global" http://localhost/health

# Test with actual domains after DNS is live
curl -I http://api.patient.healthai.global/health
curl -I http://api.doctor.healthai.global/health
```

### View Logs
```bash
docker compose logs -f nginx
docker compose logs -f patient-api
docker compose logs -f doctor-api
```

### Stop Services
```bash
docker compose down
```

### Validate Configuration
```bash
docker compose config
```

## Service URLs

| Service | Local URL | Domain URL |
|---------|-----------|------------|
| Patient API | http://localhost:8000 | https://api.patient.healthai.global |
| Doctor API | http://localhost:8001 | https://api.doctor.healthai.global |
| Patient Web | http://localhost:5173 | https://patient.healthai.global |
| Doctor Web | http://localhost:5174 | https://doctor.healthai.global |
| Nginx Proxy | http://localhost | - |

## Production Deployment

For production with SSL certificates:

1. Ensure DNS points all four domains to the EC2 public IP
2. Create the ACME webroot directory on the host:
```bash
sudo mkdir -p /var/www/certbot
```
3. Start Docker so nginx serves HTTP and ACME challenges:
```bash
docker compose up -d nginx
```
4. Issue one shared certificate for all four names.
If you keep `patient.healthai.global` as the first `-d`, certbot's default lineage path will be `/etc/letsencrypt/live/patient.healthai.global/`, and nginx now supports that automatically.
If you prefer a cleaner lineage name, add `--cert-name healthai.global`.
```bash
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d patient.healthai.global \
  -d doctor.healthai.global \
  -d api.patient.healthai.global \
  -d api.doctor.healthai.global \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive
```
5. Restart nginx so it switches to the HTTPS config:
```bash
docker compose restart nginx
```

## Troubleshooting

### Nginx not starting
```bash
docker compose logs nginx
docker compose config  # Validate configuration
```

If the log shows `cannot load certificate`, nginx is trying to start in HTTPS mode before the shared cert exists at either `/etc/letsencrypt/live/patient.healthai.global/` or `/etc/letsencrypt/live/healthai.global/`.

### Domain not resolving
- Check DNS settings
- Verify `/etc/hosts` for local testing
- Ensure nginx container is running: `docker ps | grep nginx`

### SSL certificate errors
- Verify the shared certificate exists:
  `ls -la /etc/letsencrypt/live/patient.healthai.global/`
  or `ls -la /etc/letsencrypt/live/healthai.global/`
- Check certificate permissions
- Renew certificates: `certbot renew`

### Restart Services
```bash
docker compose restart nginx
docker compose restart patient-api
docker compose restart doctor-api
```

## Notes

- The nginx startup script automatically chooses HTTP bootstrap mode until it finds a shared SAN certificate in `/etc/letsencrypt/live/patient.healthai.global/` or `/etc/letsencrypt/live/healthai.global/`
- All services are on the same Docker network (`oncolife-network`) for internal communication
