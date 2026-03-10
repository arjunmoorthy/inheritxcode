# OncoLife - Unified Nginx Proxy Dockerfile
# =========================================
FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy unified config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create directories for ACME challenges and web content
RUN mkdir -p /var/www/certbot && \
    mkdir -p /usr/share/nginx/html/doctor-web && \
    mkdir -p /usr/share/nginx/html/patient-web

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
