import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

const ProblemChild = () => {
  throw new Error('Error thrown from problem child');
};

describe('ErrorBoundary Component', () => {
  // Suppress console.error for expected errors
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  it('catches errors and displays fallback UI', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );
    const fallbackElement = screen.getByText(/Something went wrong./i);
    expect(fallbackElement).toBeInTheDocument();
  });
}); 