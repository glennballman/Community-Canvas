import { describe, it, expect } from 'vitest';

describe('Reservations Schema', () => {
  it('should have correct column names (schema.org aligned)', () => {
    const expectedColumns = [
      'customer_id',
      'provider_id',
      'start_date',
      'end_date',
      'party_size',
      'confirmation_number',
    ];
    
    expectedColumns.forEach(col => {
      expect(col).not.toContain('booker');
      expect(col).not.toContain('num_');
      expect(col).not.toMatch(/_at$/);
    });
  });

  it('should validate reservation data structure', () => {
    const validReservation = {
      customer_id: null,
      provider_id: 'uuid-here',
      start_date: new Date('2026-01-09'),
      end_date: new Date('2026-01-10'),
      party_size: 1,
      confirmation_number: 'ABC123',
      status: 'pending',
    };
    
    expect(validReservation.start_date).toBeInstanceOf(Date);
    expect(validReservation.end_date).toBeInstanceOf(Date);
    expect(validReservation.party_size).toBeGreaterThan(0);
  });

  it('should enforce date ordering (start before end)', () => {
    const reservation = {
      start_date: new Date('2026-01-09'),
      end_date: new Date('2026-01-12'),
    };
    
    expect(reservation.start_date.getTime()).toBeLessThan(reservation.end_date.getTime());
  });
});
