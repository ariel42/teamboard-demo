import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { globalsParam, startLivePolling } from './liveRefresh';

describe('startLivePolling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('polls about every 2s and fires once when the version changes', async () => {
    const versions = ['a', 'a', 'b', 'c'];
    const fetchVersion = vi.fn(async () => versions.shift() ?? 'c');
    const onChange = vi.fn();
    startLivePolling({ initialVersion: 'a', fetchVersion, onChange });
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchVersion).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchVersion).toHaveBeenCalledTimes(2);
    expect(onChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(onChange).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchVersion).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('stop() ends polling, and failed polls are ignored', async () => {
    let fail = true;
    const fetchVersion = vi.fn(async () => {
      if (fail) throw new Error('down');
      return 'a';
    });
    const stop = startLivePolling({ initialVersion: 'a', fetchVersion, onChange: vi.fn() });
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetchVersion).toHaveBeenCalledTimes(2);
    fail = false;
    stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchVersion).toHaveBeenCalledTimes(2);
  });

  it('without an initial version (load failed): keeps polling through 503, reloads once on success', async () => {
    let up = false;
    const fetchVersion = vi.fn(async () => {
      if (!up) throw new Error('503');
      return 'x';
    });
    const onChange = vi.fn();
    startLivePolling({ fetchVersion, onChange });
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchVersion).toHaveBeenCalledTimes(3);
    expect(onChange).not.toHaveBeenCalled();
    up = true;
    await vi.advanceTimersByTimeAsync(2000);
    expect(onChange).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('globalsParam', () => {
  it('keeps the current globals in the URL and keeps unknown ones', () => {
    expect(
      globalsParam('viewport.value:mobile;theme:light', {
        theme: 'dark',
        dir: 'rtl',
        o: {},
      }),
    ).toBe('viewport.value:mobile;theme:dark;dir:rtl');
    expect(globalsParam(null, { dir: 'rtl' })).toBe('dir:rtl');
  });
});
