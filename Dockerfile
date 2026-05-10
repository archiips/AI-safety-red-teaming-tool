# ── Stage 1: C++ Build ────────────────────────────────────────────────────────
FROM python:3.11-slim AS cpp-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    build-essential \
    libre2-dev \
    libicu-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir pybind11

WORKDIR /build/cpp
COPY cpp/ .

# BUILD_DIR is the cmake binary dir; CMAKE_SOURCE_DIR becomes /build/cpp
# LIBRARY_OUTPUT_DIRECTORY in CMakeLists is set to ${CMAKE_SOURCE_DIR}/..  = /build/
RUN mkdir build && cd build && \
    cmake .. \
        -DCMAKE_BUILD_TYPE=Release \
        -Dpybind11_DIR=$(python3 -m pybind11 --cmakedir) && \
    cmake --build . --config Release && \
    mkdir -p /output && \
    find /build -maxdepth 1 -name "crucible_policy*.so" -exec cp {} /output/ \;

# ── Stage 2: Python Dependency Build ─────────────────────────────────────────
# Separate stage with Rust toolchain — needed for base2048 (PyRIT dep, no ARM64 wheel)
FROM python:3.11-slim AS python-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    rustc \
    cargo \
    && rm -rf /var/lib/apt/lists/*

COPY requirements/base.txt requirements/pinned.txt requirements/
RUN pip install --no-cache-dir --prefix=/install \
    -r requirements/base.txt \
    -r requirements/pinned.txt

# ── Stage 3: Final Application Image ─────────────────────────────────────────
FROM python:3.11-slim

# Runtime shared libraries needed by the C++ module
RUN apt-get update && apt-get install -y --no-install-recommends \
    libre2-11 \
    libicu76 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python packages from build stage (no Rust toolchain in final image)
COPY --from=python-builder /install /usr/local

# C++ extension module from build stage
COPY --from=cpp-builder /output/ ./

# Application source
COPY . .

EXPOSE 8000
CMD ["uvicorn", "crucible.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
