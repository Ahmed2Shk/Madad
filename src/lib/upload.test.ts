import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, validateUpload } from './upload';

describe('validateUpload', () => {
  it('accepts PDF and images up to 5MB', () => {
    expect(validateUpload({ type: 'application/pdf', size: 1000 })).toBeNull();
    expect(validateUpload({ type: 'image/jpeg', size: MAX_UPLOAD_BYTES })).toBeNull();
  });

  it('rejects other types', () => {
    expect(validateUpload({ type: 'application/msword', size: 10 })).toBe('fileType');
  });

  it('rejects files over 5MB', () => {
    expect(validateUpload({ type: 'image/png', size: MAX_UPLOAD_BYTES + 1 })).toBe('fileSize');
  });
});
