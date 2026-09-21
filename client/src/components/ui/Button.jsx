import React from 'react';

export function Button({ children, kind = 'primary', ...props }) {
  return (
    <button className={`button ${kind}`} {...props}>
      {children}
    </button>
  );
}
