import concurrent.futures
import time
import crucible_policy


def test_parallel_faster_than_sequential():
    N = 500
    # Sequential
    t0 = time.perf_counter()
    for _ in range(N):
        crucible_policy.add(1000000, 1)
    seq = time.perf_counter() - t0

    # Parallel (8 threads)
    t0 = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as p:
        [f.result() for f in [p.submit(crucible_policy.add, 1000000, 1) for _ in range(N)]]
    par = time.perf_counter() - t0

    speedup = seq / par
    assert speedup >= 3.0, f"GIL not released! Speedup: {speedup:.2f}×"
    print(f"\nGIL confirmed released. Speedup: {speedup:.2f}×")
