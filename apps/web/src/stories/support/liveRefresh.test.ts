import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_MAX_FAILURES, globalsParam, startLivePolling } from './liveRefresh';

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

describe('startLivePolling: limits', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('stops after 5 consecutive failures (a 404 counts) and never polls again', async () => {
    const fetchVersion = vi.fn(async () => {
      throw new Error('Request failed with status 404');
    });
    const onChange = vi.fn();
    startLivePolling({ initialVersion: 'a', fetchVersion, onChange });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(LIVE_MAX_FAILURES).toBe(5);
    expect(fetchVersion).toHaveBeenCalledTimes(5);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a success resets the failure count', async () => {
    let n = 0;
    const fetchVersion = vi.fn(async () => {
      n++;
      if (n % 4 === 0) return 'a';
      throw new Error('down');
    });
    startLivePolling({ initialVersion: 'a', fetchVersion, onChange: vi.fn() });
    await vi.advanceTimersByTimeAsync(2000 * 20);
    expect(fetchVersion).toHaveBeenCalledTimes(20);
  });

  it('pauses while the tab is hidden: no request, and it still reacts after it is visible', async () => {
    let hidden = true;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    const fetchVersion = vi.fn(async () => 'b');
    const onChange = vi.fn();
    startLivePolling({ initialVersion: 'a', fetchVersion, onChange });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchVersion).not.toHaveBeenCalled();
    hidden = false;
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchVersion).toHaveBeenCalledTimes(1);
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
