// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stat } from './stat';

describe('Stat', () => {
  it('renders the label and value', () => {
    render(<Stat label="Vouchers generated" value={287} />);
    expect(screen.getByText('Vouchers generated')).toBeInTheDocument();
    expect(screen.getByText('287')).toBeInTheDocument();
  });

  it('renders a string value', () => {
    render(<Stat label="Status" value="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders sub text when provided', () => {
    render(<Stat label="Vouchers" value={10} sub="Tally-ready" />);
    expect(screen.getByText('Tally-ready')).toBeInTheDocument();
  });

  it('does not render sub when not provided', () => {
    render(<Stat label="Vouchers" value={10} />);
    expect(screen.queryByText('Tally-ready')).not.toBeInTheDocument();
  });

  it('renders delta value text', () => {
    render(<Stat label="Revenue" value={1000} delta={{ value: '+12%', direction: 'up' }} />);
    expect(screen.getByText('+12%')).toBeInTheDocument();
  });

  it('applies text-pos class for delta direction up', () => {
    const { container } = render(
      <Stat label="Revenue" value={1000} delta={{ value: '+12%', direction: 'up' }} />
    );
    const deltaEl = container.querySelector('.text-pos');
    expect(deltaEl).toBeInTheDocument();
    expect(deltaEl).toHaveTextContent('+12%');
  });

  it('applies text-neg class for delta direction down', () => {
    const { container } = render(
      <Stat label="Revenue" value={1000} delta={{ value: '-5%', direction: 'down' }} />
    );
    const deltaEl = container.querySelector('.text-neg');
    expect(deltaEl).toBeInTheDocument();
    expect(deltaEl).toHaveTextContent('-5%');
  });

  it('does not render delta section when delta is not provided', () => {
    const { container } = render(<Stat label="Revenue" value={1000} />);
    expect(container.querySelector('.text-pos')).not.toBeInTheDocument();
    expect(container.querySelector('.text-neg')).not.toBeInTheDocument();
  });

  it('renders with both delta and sub together', () => {
    render(
      <Stat
        label="Vouchers"
        value={287}
        sub="Tally-ready"
        delta={{ value: '+12%', direction: 'up' }}
      />
    );
    expect(screen.getByText('+12%')).toBeInTheDocument();
    expect(screen.getByText('Tally-ready')).toBeInTheDocument();
  });
});
