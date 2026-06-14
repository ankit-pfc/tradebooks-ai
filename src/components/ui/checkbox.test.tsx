// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('renders an accessible checkbox input', () => {
    render(<Checkbox aria-label="Select row" />);
    expect(screen.getByRole('checkbox', { name: 'Select row' })).toBeInTheDocument();
  });

  it('reflects the checked prop as checked state', () => {
    render(<Checkbox aria-label="Select" checked={true} onCheckedChange={() => {}} />);
    const input = screen.getByRole('checkbox') as HTMLInputElement;
    expect(input.checked).toBe(true);
  });

  it('reflects the checked prop as unchecked state', () => {
    render(<Checkbox aria-label="Select" checked={false} onCheckedChange={() => {}} />);
    const input = screen.getByRole('checkbox') as HTMLInputElement;
    expect(input.checked).toBe(false);
  });

  it('calls onCheckedChange with true when toggled from unchecked', () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox aria-label="Select" checked={false} onCheckedChange={onCheckedChange} />
    );
    const input = screen.getByRole('checkbox');
    fireEvent.click(input);
    expect(onCheckedChange).toHaveBeenCalledOnce();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('calls onCheckedChange with false when toggled from checked', () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox aria-label="Select" checked={true} onCheckedChange={onCheckedChange} />
    );
    const input = screen.getByRole('checkbox');
    fireEvent.click(input);
    expect(onCheckedChange).toHaveBeenCalledOnce();
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it('does not throw when onCheckedChange is not provided', () => {
    const { getByRole } = render(<Checkbox aria-label="Select-no-handler" />);
    const input = getByRole('checkbox');
    expect(() => fireEvent.click(input)).not.toThrow();
  });

  it('sets the indeterminate DOM property when indeterminate=true', () => {
    render(<Checkbox aria-label="Select all" indeterminate={true} />);
    const input = screen.getByRole('checkbox') as HTMLInputElement;
    expect(input.indeterminate).toBe(true);
  });

  it('clears the indeterminate DOM property when indeterminate=false', () => {
    render(<Checkbox aria-label="Select all" indeterminate={false} />);
    const input = screen.getByRole('checkbox') as HTMLInputElement;
    expect(input.indeterminate).toBe(false);
  });

  it('forwards extra props like disabled', () => {
    render(<Checkbox aria-label="Select" disabled />);
    const input = screen.getByRole('checkbox') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('applies additional className', () => {
    const { container } = render(<Checkbox aria-label="Select" className="extra-class" />);
    expect(container.querySelector('input')?.classList).toContain('extra-class');
  });
});
