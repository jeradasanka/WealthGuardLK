import { describe, it, expect } from 'vitest';
import { getTaxConfig } from '../taxEngine';

describe('getTaxConfig', () => {
  it('should return correct config for a known year (2024)', () => {
    const config = getTaxConfig('2024');
    expect(config).toBeDefined();
    expect(config.personalRelief).toBe(1200000);
  });

  it('should return 2025 config for future years (e.g., 2030)', () => {
    const config = getTaxConfig('2030');
    expect(config).toBeDefined();
    // Assuming 2025 config is the fallback for future
    const config2025 = getTaxConfig('2025');
    expect(config).toEqual(config2025);
  });

  it('should return 2020 config for past years (e.g., 2015)', () => {
    const config = getTaxConfig('2015');
    expect(config).toBeDefined();
    // Assuming 2020 config is the fallback for past
    const config2020 = getTaxConfig('2020');
    expect(config).toEqual(config2020);
  });
});
