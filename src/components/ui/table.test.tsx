// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SortableHeader } from './table'

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderInTable(ui: React.ReactElement) {
  return render(
    <table>
      <thead>
        <tr>{ui}</tr>
      </thead>
    </table>
  )
}

// ── SortableHeader tests ──────────────────────────────────────────────────────

describe('SortableHeader', () => {
  it('renders children as the column label', () => {
    const { container } = renderInTable(<SortableHeader>Amount</SortableHeader>)
    expect(within(container).getByText('Amount')).toBeInTheDocument()
  })

  it('sets aria-sort="none" when not active', () => {
    const { container } = renderInTable(
      <SortableHeader active={false}>Date</SortableHeader>
    )
    expect(container.querySelector('th')).toHaveAttribute('aria-sort', 'none')
  })

  it('sets aria-sort="ascending" when active with direction asc', () => {
    const { container } = renderInTable(
      <SortableHeader active direction="asc">
        Date
      </SortableHeader>
    )
    expect(container.querySelector('th')).toHaveAttribute('aria-sort', 'ascending')
  })

  it('sets aria-sort="descending" when active with direction desc', () => {
    const { container } = renderInTable(
      <SortableHeader active direction="desc">
        Date
      </SortableHeader>
    )
    expect(container.querySelector('th')).toHaveAttribute('aria-sort', 'descending')
  })

  it('calls onSort when the button is clicked', async () => {
    const user = userEvent.setup()
    const onSort = vi.fn()
    const { container } = renderInTable(
      <SortableHeader active direction="asc" onSort={onSort}>
        Amount
      </SortableHeader>
    )
    await user.click(within(container).getByRole('button'))
    expect(onSort).toHaveBeenCalledOnce()
  })

  it('does not throw when onSort is undefined and button is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderInTable(
      <SortableHeader active direction="asc">
        Amount
      </SortableHeader>
    )
    const btn = within(container).getByRole('button')
    await expect(user.click(btn)).resolves.not.toThrow()
  })

  it('renders a button inside the th in inactive state', () => {
    const { container } = renderInTable(
      <SortableHeader active={false}>Status</SortableHeader>
    )
    expect(container.querySelector('th')).toHaveAttribute('aria-sort', 'none')
    expect(container.querySelector('button')).toBeInTheDocument()
  })

  it('applies text-right on the th when align="right"', () => {
    const { container } = renderInTable(
      <SortableHeader align="right">Amount</SortableHeader>
    )
    expect(container.querySelector('th')?.className).toContain('text-right')
  })

  it('applies text-left on the th when align is default', () => {
    const { container } = renderInTable(
      <SortableHeader>Ledger</SortableHeader>
    )
    expect(container.querySelector('th')?.className).toContain('text-left')
  })

  it('icon has text-primary class when active', () => {
    const { container } = renderInTable(
      <SortableHeader active direction="asc">
        Amount
      </SortableHeader>
    )
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('text-primary')
  })

  it('icon has text-ink-3 class when inactive', () => {
    const { container } = renderInTable(
      <SortableHeader active={false}>Amount</SortableHeader>
    )
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('text-ink-3')
  })
})
