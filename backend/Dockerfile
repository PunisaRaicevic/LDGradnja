# Stage 1: Build libredwg from source
FROM python:3.11-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    git cmake build-essential pkg-config \
    autoconf automake libtool texinfo \
    libpcre2-dev swig \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch 0.13.3 https://github.com/LibreDWG/libredwg.git /tmp/libredwg \
    && cd /tmp/libredwg \
    && mkdir build && cd build \
    && cmake .. -DCMAKE_INSTALL_PREFIX=/usr/local \
    && make -j$(nproc) \
    && make install

# Stage 2: Runtime
FROM python:3.11-slim

# Copy libredwg binaries and libraries
COPY --from=builder /usr/local/bin/dwg2dxf /usr/local/bin/
COPY --from=builder /usr/local/bin/dwgread /usr/local/bin/
COPY --from=builder /usr/local/lib/libredwg* /usr/local/lib/
RUN ldconfig

# Install Python dependencies
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
