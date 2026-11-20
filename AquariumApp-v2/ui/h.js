/** JSX-like templates without a build step (htm + React.createElement). */
import React from 'react';
import htm from 'htm';

export const html = htm.bind(React.createElement);
