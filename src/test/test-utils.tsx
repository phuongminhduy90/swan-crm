import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';

/**
 * Lightweight render wrapper. Tests that need providers (AuthProvider, ToastProvider)
 * should compose them here. Story A.1 (Tabs) needs no providers.
 */
function Wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: Wrapper, ...options });
}

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';