# Stage 1: Get dwg2dxf from openSUSE (has libredwg-tools in repos)
FROM opensuse/tumbleweed AS libredwg
RUN zypper --non-interactive install libredwg-tools
# Bundle dwg2dxf with all its shared libraries so it works on Debian
RUN mkdir -p /dwg2dxf-bundle && \
    cp /usr/bin/dwg2dxf /dwg2dxf-bundle/ && \
    ldd /usr/bin/dwg2dxf | grep "=> /" | awk '{print $3}' | xargs -I{} cp {} /dwg2dxf-bundle/

# Stage 2: Build React frontend (depends on libredwg to force sequential build)
FROM node:20-slim AS frontend-build
COPY --from=libredwg /dwg2dxf-bundle/dwg2dxf /tmp/.buildorder
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=384
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ENV VITE_SUPABASE_URL=https://jcrqwldljyiyaiogjspt.supabase.co
ENV VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjcnF3bGRsanlpeWFpb2dqc3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NjcxMjAsImV4cCI6MjA4NjM0MzEyMH0.st50bMyt78cV144cBzf_-0pZ-FWtnL23YWLyF2TBQ5k

RUN npm run build

# Stage 3: Python backend + serve built frontend
FROM python:3.11-slim
WORKDIR /app

RUN pip install --no-cache-dir fastapi==0.115.0
RUN pip install --no-cache-dir uvicorn[standard]==0.30.0
RUN pip install --no-cache-dir python-multipart==0.0.9
RUN pip install --no-cache-dir ezdxf==1.4.3
RUN pip install --no-cache-dir matplotlib==3.9.0
RUN pip install --no-cache-dir httpx==0.27.0

COPY backend/ .
COPY --from=frontend-build /app/dist ./static

# Copy dwg2dxf binary + its shared libraries
COPY --from=libredwg /dwg2dxf-bundle/ /usr/local/lib/dwg2dxf/
RUN ln -s /usr/local/lib/dwg2dxf/dwg2dxf /usr/local/bin/dwg2dxf
ENV LD_LIBRARY_PATH=/usr/local/lib/dwg2dxf

EXPOSE 8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
