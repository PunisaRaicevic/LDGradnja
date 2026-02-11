# Stage 1: Build libredwg from source (dwg2dxf tool)
FROM debian:bookworm-slim AS libredwg-build
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc make ca-certificates curl xz-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN curl -L https://github.com/LibreDWG/libredwg/releases/download/0.13.3/libredwg-0.13.3.tar.xz | tar xJ --strip-components=1
RUN ./configure --prefix=/opt/libredwg --disable-shared --disable-write --disable-python && \
    make -j1 dwg2dxf && \
    install -D programs/dwg2dxf /opt/libredwg/bin/dwg2dxf

# Stage 2: Build React frontend (depends on libredwg-build to force sequential execution)
FROM node:20-slim AS frontend-build
# Force BuildKit to finish libredwg-build before starting this stage
COPY --from=libredwg-build /opt/libredwg/bin/dwg2dxf /tmp/.buildorder
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
COPY --from=libredwg-build /opt/libredwg/bin/dwg2dxf /usr/local/bin/dwg2dxf

EXPOSE 8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
