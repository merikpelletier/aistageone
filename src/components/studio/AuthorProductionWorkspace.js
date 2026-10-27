import React from 'react';
import AuthorProductionWorkspacePage from './AuthorProductionWorkspacePage.jsx';

const mobileStyles = `
@media (max-width: 767px) {
  .fotoplay-current-workspace > div {
    padding-left: 6px !important;
    padding-right: 6px !important;
    padding-bottom: 84px !important;
  }

  .fotoplay-current-workspace header {
    display: grid !important;
    grid-template-columns: 42px minmax(0, 1fr) !important;
    gap: 8px !important;
    padding: 8px !important;
  }

  .fotoplay-current-workspace header > button:first-child {
    grid-column: 1 !important;
    grid-row: 1 !important;
  }

  .fotoplay-current-workspace header > div:first-of-type {
    grid-column: 2 !important;
    grid-row: 1 !important;
  }

  .fotoplay-current-workspace header > button:not(:first-child),
  .fotoplay-current-workspace header > a {
    min-height: 40px !important;
    padding: 8px 10px !important;
    font-size: 11px !important;
  }

  .fotoplay-current-workspace [class*="grid-cols-9"] {
    display: flex !important;
    gap: 7px !important;
    overflow-x: auto !important;
    padding: 7px !important;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .fotoplay-current-workspace [class*="grid-cols-9"]::-webkit-scrollbar {
    display: none;
  }

  .fotoplay-current-workspace [class*="grid-cols-9"] > button {
    flex: 0 0 42px !important;
    width: 42px !important;
    height: 40px !important;
  }

  .fotoplay-current-workspace [class*="h-[calc(100vh-230px)]"] {
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
  }

  .fotoplay-current-workspace [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] {
    display: flex !important;
    flex-direction: column !important;
    height: auto !important;
  }

  .fotoplay-current-workspace [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > aside {
    position: relative !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 6px !important;
    width: 100% !important;
    min-height: 56px !important;
    padding: 6px !important;
    overflow-x: auto !important;
    border-left: 0 !important;
    border-right: 0 !important;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .fotoplay-current-workspace [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > aside::-webkit-scrollbar {
    display: none;
  }

  .fotoplay-current-workspace [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > aside:first-child {
    order: 1 !important;
    border-bottom: 1px solid rgba(255,255,255,.1) !important;
  }

  .fotoplay-current-workspace [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > main {
    order: 2 !important;
    width: 100% !important;
    min-height: 58dvh !important;
    padding: 8px !important;
    overflow: visible !important;
  }

  .fotoplay-current-workspace [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > aside:last-child {
    order: 3 !important;
    border-top: 1px solid rgba(255,255,255,.1) !important;
  }

  .fotoplay-current-workspace [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > aside button {
    flex: 0 0 auto !important;
  }

  .fotoplay-current-workspace [class*="w-[430px]"][class*="absolute"] {
    position: fixed !important;
    inset: 56px 0 64px 0 !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    z-index: 8000 !important;
    border-left: 0 !important;
    border-right: 0 !important;
  }

  .fotoplay-current-workspace input,
  .fotoplay-current-workspace textarea,
  .fotoplay-current-workspace select {
    font-size: 16px !important;
  }
}
`;

export default function AuthorProductionWorkspace(props) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('style', null, mobileStyles),
    React.createElement(
      'div',
      { className: 'fotoplay-current-workspace' },
      React.createElement(AuthorProductionWorkspacePage, props),
    ),
  );
}
