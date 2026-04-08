// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileUploadStatus, type FileUploadStatusProps } from './file-upload-status';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProps(overrides: Partial<FileUploadStatusProps> = {}): FileUploadStatusProps {
  return {
    fileName: 'tradebook.csv',
    sizeBytes: 1024,
    status: 'pending',
    detectedType: null,
    errorMessage: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FileUploadStatus', () => {
  it('renders filename and formatted size for all status values', () => {
    const statuses: FileUploadStatusProps['status'][] = ['pending', 'uploading', 'uploaded', 'failed'];

    for (const status of statuses) {
      const { unmount } = render(
        <FileUploadStatus {...makeProps({ status, detectedType: status === 'uploaded' ? 'tradebook' : null })} />
      );
      expect(screen.getByText('tradebook.csv')).toBeInTheDocument();
      expect(screen.getByText('1.0 KB')).toBeInTheDocument();
      unmount();
    }
  });

  it('shows animate-spin spinner when status is uploading', () => {
    const { container } = render(<FileUploadStatus {...makeProps({ status: 'uploading' })} />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows detected type badge when status is uploaded', () => {
    render(
      <FileUploadStatus
        {...makeProps({ status: 'uploaded', detectedType: 'tradebook' })}
      />
    );
    expect(screen.getByText('Tradebook')).toBeInTheDocument();
  });

  it('shows Retry button for failed status and calls onRetry on click', () => {
    const onRetry = vi.fn();
    render(
      <FileUploadStatus
        {...makeProps({ status: 'failed', errorMessage: 'Upload error', onRetry })}
      />
    );
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders the pnl-not-needed badge for the generic P&L file type', () => {
    render(
      <FileUploadStatus
        {...makeProps({
          fileName: 'pnl-FC9134.xlsx',
          status: 'uploaded',
          detectedType: 'pnl',
        })}
      />,
    );
    // The label communicates that this file is recognised but optional —
    // distinct from the alarming "Unknown" badge.
    expect(screen.getByText('P&L (not needed)')).toBeInTheDocument();
  });

  it('calls onRemove when Remove button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <FileUploadStatus
        {...makeProps({ status: 'uploaded', detectedType: 'tradebook', onRemove })}
      />
    );
    const removeBtn = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
