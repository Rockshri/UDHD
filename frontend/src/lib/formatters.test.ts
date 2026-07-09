import { describe, expect, it } from 'vitest';
import {
  clampPct,
  daysBetween,
  formatCurrencyCr,
  formatDate,
  formatInteger,
  formatPercent,
} from './formatters';

describe('formatters', () => {
  describe('formatCurrencyCr', () => {
    it('formats numbers as ₹ Cr with Indian grouping', () => {
      expect(formatCurrencyCr(1234.5)).toBe('₹ 1,234.50 Cr');
      expect(formatCurrencyCr(8076.62)).toBe('₹ 8,076.62 Cr');
    });
    it('handles null/undefined with em-dash', () => {
      expect(formatCurrencyCr(null)).toBe('—');
      expect(formatCurrencyCr(undefined)).toBe('—');
    });
    it('handles zero as 0.00', () => {
      expect(formatCurrencyCr(0)).toBe('₹ 0.00 Cr');
    });
  });

  describe('formatPercent', () => {
    it('rounds to 1 decimal by default', () => {
      expect(formatPercent(59.5)).toBe('59.5%');
      expect(formatPercent(42.34)).toBe('42.3%');
    });
    it('respects a custom digit count', () => {
      expect(formatPercent(42.34, 2)).toBe('42.34%');
      expect(formatPercent(42.34, 0)).toBe('42%');
    });
    it('handles null/undefined with em-dash', () => {
      expect(formatPercent(null)).toBe('—');
      expect(formatPercent(undefined)).toBe('—');
    });
  });

  describe('formatInteger', () => {
    it('uses Indian grouping', () => {
      expect(formatInteger(298)).toBe('298');
      expect(formatInteger(12345)).toBe('12,345');
      expect(formatInteger(1234567)).toBe('12,34,567');
    });
    it('handles null/undefined with em-dash', () => {
      expect(formatInteger(null)).toBe('—');
    });
  });

  describe('formatDate', () => {
    it('formats ISO strings in dd Mon yyyy en-IN', () => {
      expect(formatDate('2026-07-05')).toBe('05 Jul 2026');
    });
    it('handles null/invalid', () => {
      expect(formatDate(null)).toBe('—');
      expect(formatDate('not-a-date')).toBe('—');
    });
  });

  describe('daysBetween', () => {
    it('computes whole-day difference (positive when to > from)', () => {
      expect(daysBetween('2026-07-01', '2026-07-10')).toBe(9);
    });
    it('is negative when the range flips', () => {
      expect(daysBetween('2026-07-10', '2026-07-01')).toBe(-9);
    });
  });

  describe('clampPct', () => {
    it('clamps into [0, 100]', () => {
      expect(clampPct(-5)).toBe(0);
      expect(clampPct(50)).toBe(50);
      expect(clampPct(129.41)).toBe(100);
    });
    it('nulls to 0', () => {
      expect(clampPct(null)).toBe(0);
      expect(clampPct(undefined)).toBe(0);
    });
  });
});
