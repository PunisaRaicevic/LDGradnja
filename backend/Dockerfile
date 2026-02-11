FROM python:3.11-slim

# Install libredwg-tools from Debian testing (pre-built package)
RUN echo "deb http://deb.debian.org/debian trixie main" > /etc/apt/sources.list.d/trixie.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends -t trixie libredwg-tools \
    && rm -rf /var/lib/apt/lists/* /etc/apt/sources.list.d/trixie.list \
    && dwg2dxf --version

# Install Python dependencies
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
