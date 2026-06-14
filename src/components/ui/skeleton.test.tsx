// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton, SkeletonRows } from './skeleton'

describe('Skeleton', () => {
  it('has animate-pulse class', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toHaveClass('animate-pulse')
  })

  it('has bg-surface-2 class', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toHaveClass('bg-surface-2')
  })

  it('has rounded-md class', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toHaveClass('rounded-md')
  })

  it('merges additional className', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />)
    const el = container.firstChild as HTMLElement
    expect(el).toHaveClass('h-4')
    expect(el).toHaveClass('w-32')
  })
})

describe('SkeletonRows', () => {
  it('renders the correct number of rows', () => {
    const { container } = render(
      <table>
        <tbody>
          <SkeletonRows rows={3} cols={4} />
        </tbody>
      </table>
    )
    const rows = container.querySelectorAll('tr')
    expect(rows).toHaveLength(3)
  })

  it('renders rows * cols skeleton cells', () => {
    const rows = 3
    const cols = 4
    const { container } = render(
      <table>
        <tbody>
          <SkeletonRows rows={rows} cols={cols} />
        </tbody>
      </table>
    )
    const cells = container.querySelectorAll('td')
    expect(cells).toHaveLength(rows * cols)
  })

  it('each cell contains a Skeleton with animate-pulse', () => {
    const { container } = render(
      <table>
        <tbody>
          <SkeletonRows rows={2} cols={3} />
        </tbody>
      </table>
    )
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons).toHaveLength(2 * 3)
  })

  it('defaults to 5 rows and 4 cols', () => {
    const { container } = render(
      <table>
        <tbody>
          <SkeletonRows />
        </tbody>
      </table>
    )
    const rows = container.querySelectorAll('tr')
    const cells = container.querySelectorAll('td')
    expect(rows).toHaveLength(5)
    expect(cells).toHaveLength(5 * 4)
  })
})
