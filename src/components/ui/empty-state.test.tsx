// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No batches yet" />)
    expect(screen.getByText('No batches yet')).toBeInTheDocument()
  })

  it('renders the description when provided', () => {
    render(<EmptyState title="No batches yet" description="Upload a file to get started." />)
    expect(screen.getByText('Upload a file to get started.')).toBeInTheDocument()
  })

  it('renders the action node when provided', () => {
    render(
      <EmptyState
        title="No batches yet"
        action={<button>Upload now</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'Upload now' })).toBeInTheDocument()
  })

  it('renders the icon when provided', () => {
    render(
      <EmptyState
        title="No batches yet"
        icon={<span data-testid="icon-node" />}
      />
    )
    expect(screen.getByTestId('icon-node')).toBeInTheDocument()
  })

  it('omits description when not provided', () => {
    const { container } = render(<EmptyState title="Empty" />)
    // Only one <p> — the title
    const paras = container.querySelectorAll('p')
    expect(paras).toHaveLength(1)
    expect(paras[0]).toHaveTextContent('Empty')
  })

  it('applies extra className to wrapper', () => {
    const { container } = render(<EmptyState title="Empty" className="custom-empty" />)
    expect(container.firstChild).toHaveClass('custom-empty')
  })
})
