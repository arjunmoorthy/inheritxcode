# Docker Domain Configuration Fix

## Problem
The Docker setup was missing an nginx reverse proxy service to handle custom domain routing for the patient and doctor APIs.

## Solution
Added an nginx reverse proxy service to the `docker-compose.yml` that routes traffic based on domain names.

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
curl -H "Host: oncolife-patient-api.inheritxdev.in" http://localhost/health

# Test Doctor API
curl -H "Host: oncolife-doctor-api.inheritxdev.in" http://localhost/health

# Test with actual domain (requires DNS and SSL setup)
curl https://oncolife-patient-api.inheritxdev.in/health
curl https://oncolife-doctor-api.inheritxdev.in/health
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
| Patient API | http://localhost:8000 | https://oncolife-patient-api.inheritxdev.in |
| Doctor API | http://localhost:8001 | https://oncolife-doctor-api.inheritxdev.in |
| Patient Web | http://localhost:5173 | https://oncolife-patient.inheritxdev.in |
| Doctor Web | http://localhost:5174 | https://oncolife-doctor.inheritxdev.in |
| Nginx Proxy | http://localhost | - |

## Production Deployment

For production with SSL certificates:

1. Ensure SSL certificates are installed in `/etc/letsencrypt/live/`
2. Update nginx.conf to use HTTPS redirects instead of direct proxy
3. Configure DNS to point domains to the server IP
4. Open ports 80 and 443 in the firewall

## Troubleshooting

### Nginx not starting
```bash
docker compose logs nginx
docker compose config  # Validate configuration
```

### Domain not resolving
- Check DNS settings
- Verify `/etc/hosts` for local testing
- Ensure nginx container is running: `docker ps | grep nginx`

### SSL certificate errors
- Verify certificates exist: `ls -la /etc/letsencrypt/live/`
- Check certificate permissions
- Renew certificates: `certbot renew`

### Restart Services
```bash
docker compose restart nginx
docker compose restart patient-api
docker compose restart doctor-api
```

## Notes

- The nginx configuration supports both HTTP (for local testing) and HTTPS (for production)
- For local testing without SSL, the configuration proxies directly without redirect
- For production, uncomment the HTTPS redirect lines in nginx.conf
- All services are on the same Docker network (`oncolife-network`) for internal communication
