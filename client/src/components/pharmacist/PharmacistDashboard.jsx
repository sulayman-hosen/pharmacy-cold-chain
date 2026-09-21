import React from 'react';
import { Worklist } from '../orders/Worklist';

export function PharmacistDashboard({ rows, search, setSearch, filter, setFilter, user, onOpenSelected, t }) {
  return (
    <Worklist
      rows={rows}
      search={search}
      setSearch={setSearch}
      filter={filter}
      setFilter={setFilter}
      user={user}
      t={t}
      onOpen={onOpenSelected}
    />
  );
}
