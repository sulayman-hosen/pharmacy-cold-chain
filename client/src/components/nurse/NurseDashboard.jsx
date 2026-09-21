import React from 'react';
import { Worklist } from '../orders/Worklist';

export function NurseDashboard({ rows, search, setSearch, filter, setFilter, user, onOpenSelected, onOpenNewRequest, t }) {
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
      onNew={onOpenNewRequest}
    />
  );
}
