# Stage 1: Build React frontend
FROM node:20-slim AS frontend-build
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=384
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ENV VITE_SUPABASE_URL=https://jcrqwldljyiyaiogjspt.supabase.co
ENV VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjcnF3bGRsanlpeWFpb2dqc3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NjcxMjAsImV4cCI6MjA4NjM0MzEyMH0.st50bMyt78cV144cBzf_-0pZ-FWtnL23YWLyF2TBQ5k

RUN npm run build

# Stage 2: Python backend + serve built frontend
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

# Build dwg2dxf from source in a single layer (runs AFTER frontend build is done = no parallel OOM)
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libc6-dev make curl xz-utils ca-certificates && \
    curl -L https://github.com/LibreDWG/libredwg/releases/download/0.13.3/libredwg-0.13.3.tar.xz | tar xJ && \
    cd libredwg-0.13.3 && \
    ./configure --disable-shared --disable-write --disable-python && \
    make -j1 programs/dwg2dxf && \
    install programs/dwg2dxf /usr/local/bin/ && \
    cd / && rm -rf libredwg-0.13.3 && \
    apt-get purge -y gcc libc6-dev make curl xz-utils && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

EXPOSE 8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
