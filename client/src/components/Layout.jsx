import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';

export default function Layout() {
  return (
    <div className="brutalist-app">
      <Header />
      <main className="brutalist-main">
        <Outlet />
      </main>
    </div>
  );
}
