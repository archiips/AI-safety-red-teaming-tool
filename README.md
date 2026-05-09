# Crucible

AI Safety Red-Teaming Platform — automatically generates, executes, and scores adversarial attacks against LLM applications, producing a severity heatmap and regression-ready CI/CD harness.

## Quick Start

```bash
# 1. Clone and set up environment
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements/dev.txt

# 2. Build the C++ policy engine
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release -DPYTHON_EXECUTABLE=$(which python3.11)
cmake --build . --config Release
cd ..

# 3. After any C++ change (from project root)
cmake --build build --config Release

# 4. Verify Python can import the module
python3 -c "from crucible_policy import PolicyEngine; print('ok')"

# 5. Run tests
pytest tests/unit/ tests/contracts/ -v          # fast (no network)
pytest tests/performance/ -v -s                  # GIL verification
```

## System Dependencies

```bash
brew install cmake re2
pip install pybind11
```

## Architecture

See `PRD.md` for the full product spec and `CLAUDE.md` for development guidelines.
