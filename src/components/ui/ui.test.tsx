import { describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';
import { Freshness } from './Freshness';
import { LanguageSwitch } from './LanguageSwitch';
import { StatusBadge, type BadgeStatus } from './StatusBadge';

describe('StatusBadge', () => {
  const cases: [BadgeStatus, string][] = [
    ['available', 'متوفر'],
    ['limited', 'كمية محدودة'],
    ['needs_update', 'يحتاج تحديث'],
    ['unconfirmed', 'غير مؤكد'],
    ['unavailable', 'غير متوفر'],
    ['pending_review', 'قيد المراجعة'],
  ];

  it.each(cases)('%s shows an icon and text, not color alone', (status, label) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('Freshness', () => {
  it('shows relative time with a machine-readable date', () => {
    const at = new Date(Date.now() - 12 * 60_000);
    render(<Freshness at={at} />);
    const el = screen.getByText(/حُدّث/);
    expect(el.tagName).toBe('TIME');
    expect(el).toHaveAttribute('datetime', at.toISOString());
    expect(el.textContent).toContain('12');
  });
});

describe('LanguageSwitch', () => {
  it('flips document direction between RTL and LTR', async () => {
    await act(() => i18n.changeLanguage('ar'));
    expect(document.documentElement.dir).toBe('rtl');
    render(<LanguageSwitch />);
    await userEvent.click(screen.getByRole('button'));
    // English loads on demand the first time (it is not in the first page's bundle).
    await waitFor(() => expect(document.documentElement.dir).toBe('ltr'));
    expect(document.documentElement.lang).toBe('en');
    expect(i18n.t('nav.login')).not.toBe('nav.login');
    await act(() => i18n.changeLanguage('ar'));
  });
});
