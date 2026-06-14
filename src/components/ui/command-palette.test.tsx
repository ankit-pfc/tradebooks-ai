// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommandPalette } from './command-palette';

// ─── Mock next/navigation ─────────────────────────────────────────────────────

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ─── Mock app-theme-provider (avoids window.matchMedia in jsdom) ──────────────

const mockToggleDensity = vi.fn();

vi.mock('@/components/app/app-theme-provider', () => ({
  AppThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDensity: () => ({
    density: 'comfortable',
    setDensity: vi.fn(),
    toggleDensity: mockToggleDensity,
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPalette(extraItems = []) {
  return render(<CommandPalette extraItems={extraItems} />);
}

function pressMetaK() {
  fireEvent.keyDown(window, { key: 'k', metaKey: true });
}

function pressCtrlK() {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
}

function getSearchInput(): HTMLInputElement {
  return screen.getByRole('textbox', { name: /search commands/i }) as HTMLInputElement;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockPush.mockClear();
  mockToggleDensity.mockClear();
});

describe('CommandPalette', () => {
  it('is closed by default — no built-in labels visible', () => {
    renderPalette();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('opens on Meta+K and shows built-in commands', async () => {
    renderPalette();
    pressMetaK();
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('opens on Ctrl+K as well', async () => {
    renderPalette();
    pressCtrlK();
    await waitFor(() => {
      expect(screen.getByText('Upload')).toBeInTheDocument();
    });
  });

  it('toggles closed on a second Meta+K', async () => {
    renderPalette();
    pressMetaK();
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    pressMetaK();
    await waitFor(() => expect(screen.queryByText('Dashboard')).not.toBeInTheDocument());
  });

  it('filters list when user types in the search input', async () => {
    renderPalette();
    pressMetaK();

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());

    const input = getSearchInput();
    fireEvent.change(input, { target: { value: 'Settings' } });

    // "Settings" should still be visible
    expect(screen.getByText('Settings')).toBeInTheDocument();
    // "Dashboard" should be filtered out
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('shows "No results" when filter matches nothing', async () => {
    renderPalette();
    pressMetaK();

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());

    const input = getSearchInput();
    fireEvent.change(input, { target: { value: 'xyzzy-no-match' } });

    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('presses Enter on a filtered single item and calls router.push', async () => {
    renderPalette();
    pressMetaK();

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());

    const input = getSearchInput();
    // Type "Settings" — only one match remains
    fireEvent.change(input, { target: { value: 'Settings' } });
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();

    // Press Enter — should call push('/settings') and close the palette
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/settings');
    });

    // Palette should close after selection
    await waitFor(() => {
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });
  });

  it('clicking an item invokes onSelect and closes the palette', async () => {
    renderPalette();
    pressMetaK();

    await waitFor(() => expect(screen.getByText('Upload')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/upload');
    });

    await waitFor(() => {
      expect(screen.queryByText('Upload')).not.toBeInTheDocument();
    });
  });

  it('ArrowDown moves selection to the second item', async () => {
    renderPalette();
    pressMetaK();

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());

    const input = getSearchInput();

    // Initial active index = 0 (Dashboard)
    const dashboardItem = screen.getByRole('option', { name: /Dashboard/i });
    expect(dashboardItem).toHaveAttribute('data-active', 'true');

    // Arrow down once → index 1 (Upload)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const uploadItem = screen.getByRole('option', { name: /Upload/i });
    expect(uploadItem).toHaveAttribute('data-active', 'true');
    expect(dashboardItem).toHaveAttribute('data-active', 'false');
  });

  it('ArrowUp wraps from first item to last', async () => {
    renderPalette();
    pressMetaK();

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());

    const input = getSearchInput();

    // Arrow up from first item should wrap to last ("Toggle density")
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    const lastItem = screen.getByRole('option', { name: /Toggle density/i });
    expect(lastItem).toHaveAttribute('data-active', 'true');
  });

  it('renders extraItems after built-ins', async () => {
    const extraItems = [
      {
        id: 'custom-1',
        label: 'Custom Action',
        hint: 'custom',
        onSelect: vi.fn(),
      },
    ];

    renderPalette(extraItems);
    pressMetaK();

    await waitFor(() => expect(screen.getByText('Custom Action')).toBeInTheDocument());
  });

  it('extra item onSelect is called when clicked', async () => {
    const onSelect = vi.fn();
    const extraItems = [
      {
        id: 'custom-2',
        label: 'My Custom Command',
        onSelect,
      },
    ];

    renderPalette(extraItems);
    pressMetaK();

    await waitFor(() => expect(screen.getByText('My Custom Command')).toBeInTheDocument());

    fireEvent.click(screen.getByText('My Custom Command'));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('calls toggleDensity when Toggle density item is selected', async () => {
    renderPalette();
    pressMetaK();

    await waitFor(() => expect(screen.getByText('Toggle density')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Toggle density'));

    expect(mockToggleDensity).toHaveBeenCalledOnce();
  });
});
