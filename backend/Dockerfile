# Stage 1: Build only dwg2dxf from libredwg
FROM python:3.11-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    git build-essential pkg-config \
    autoconf automake libtool texinfo \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch 0.12.5 https://github.com/LibreDWG/libredwg.git /tmp/libredwg \
    && cd /tmp/libredwg \
    && autoreconf -fi \
    && ./configure --prefix=/usr/local --disable-json --disable-python --disable-bindings CFLAGS="-O2 -w" \
    && make -C src -j$(nproc) \
    && make -C programs dwg2dxf LDFLAGS="-L../src/.libs" \
    || (cd /tmp/libredwg && make -k || true) \
    && cp /tmp/libredwg/programs/dwg2dxf /usr/local/bin/ 2>/dev/null || true \
    && cp /tmp/libredwg/src/.libs/libredwg* /usr/local/lib/ 2>/dev/null || true \
    && ls -la /usr/local/bin/dwg2dxf

# Stage 2: Runtime
FROM python:3.11-slim

# Copy libredwg binaries and libraries
COPY --from=builder /usr/local/bin/dwg2dxf /usr/local/bin/
COPY --from=builder /usr/local/lib/libredwg* /usr/local/lib/
RUN ldconfig

# Install Python dependencies
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
