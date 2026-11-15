# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim
WORKDIR /opt/studentexchange-adapter
ENV NODE_ENV=production PORT=8080 SE_ENABLE_BACKEND_TRAFFIC=false WEB_CONCURRENCY=1
# Explicit allowlist: no source checkout, tests, .env, mock or website in the image.
COPY --chown=node:node package.json ./
COPY --chown=node:node server/api.mjs server/app.mjs server/admin.mjs server/marketplace.mjs server/mobile-contracts.mjs server/images.mjs server/backend-policy.mjs server/deployment-config.mjs server/limits.mjs server/deployed.mjs ./server/
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD ["node", "--input-type=module", "-e", "import http from 'node:http';const r=http.get({hostname:'127.0.0.1',port:process.env.PORT||8080,path:'/healthz',timeout:2000},s=>{s.resume();if(s.statusCode!==200)process.exitCode=1});r.on('timeout',()=>r.destroy());r.on('error',()=>{process.exitCode=1})"]
CMD ["node", "server/deployed.mjs"]
