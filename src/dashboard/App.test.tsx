import App from './App';
import { render, screen } from '@testing-library/react';

describe('App Component', () => {
  it('renders the dashboard title', () => {
    render(<App />);
    const titleElement = screen.getByText(/AI Agent Dashboard/i);
    expect(titleElement).toBeInTheDocument();
  });
});