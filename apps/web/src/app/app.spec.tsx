import { render } from '@testing-library/react';
import App from './app';

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<App />);
    expect(baseElement).toBeTruthy();
  });

  it('should have a greeting as the title', async () => {
    const { findByText } = render(<App />);
    expect(await findByText(/Split the bill, snap it/i)).toBeTruthy();
  });
});
