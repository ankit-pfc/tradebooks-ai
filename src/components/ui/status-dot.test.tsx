// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusDot, TONE_MAP, type StatusDotTone } from './status-dot'

describe('StatusDot', () => {
  it('renders the label text', () => {
    render(<StatusDot tone="pos" label="Reconciled" />)
    expect(screen.getByText('Reconciled')).toBeInTheDocument()
  })

  it('applies the correct tone class for each tone', () => {
    const tones: StatusDotTone[] = ['pos', 'neg', 'warn', 'info', 'neutral']

    for (const tone of tones) {
      const { container, unmount } = render(<StatusDot tone={tone} label="Status" />)
      const dot = container.querySelector('[aria-hidden="true"]')
      expect(dot).toHaveClass(TONE_MAP[tone])
      unmount()
    }
  })

  it('adds sr-only class to label when srOnlyLabel is true', () => {
    render(<StatusDot tone="warn" label="Needs review" srOnlyLabel />)
    const label = screen.getByText('Needs review')
    expect(label).toHaveClass('sr-only')
  })

  it('does not add sr-only class when srOnlyLabel is false (default)', () => {
    render(<StatusDot tone="info" label="In Progress" />)
    const label = screen.getByText('In Progress')
    expect(label).not.toHaveClass('sr-only')
  })

  it('passes additional className to the wrapper', () => {
    const { container } = render(<StatusDot tone="neutral" label="Idle" className="custom-cls" />)
    expect(container.firstChild).toHaveClass('custom-cls')
  })
})
