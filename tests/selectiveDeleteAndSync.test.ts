import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldAcceptCloudItem,
  classifyLocalMissingFromServer,
  recordHardDeletes,
  readHardDeletedMap,
  clearHardDeleteEntry,
  markCategoriesWiped,
  readCategoryWipeMap,
  clearCategoryWipes,
  mergeCloudHardDeletedMap,
  getCappedCloudHardDeletedMap,
  hydrateLocalStorageFromEdmDataDoc
} from '../services/db';

const installMockLocalStorage = () => {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    }
  };
  const prevDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: mockStorage
  });
  return () => {
    if (prevDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', prevDescriptor);
    } else {
      delete (globalThis as any).localStorage;
    }
  };
};

test('shouldAcceptCloudItem — blocks resurrection of hard-deleted or wiped items', () => {
  const hardDeletedAtMap = {
    'farmers:f-old': '2026-05-10T10:00:00.000Z',
    'prescriptions:REC-2026-0001': '2026-05-10T10:00:00.000Z'
  };
  const categoryWipedAtMap = {
    inventory: '2026-05-12T08:00:00.000Z'
  };

  // 1. Stale cloud doc for hard-deleted farmer is rejected
  const staleFarmer = shouldAcceptCloudItem({
    col: 'farmers',
    docId: 'f-old',
    incoming: { lastUpdated: '2026-05-09T12:00:00.000Z' },
    localExisting: undefined,
    hardDeletedAtMap,
    categoryWipedAtMap
  });
  assert.equal(staleFarmer.accept, false);
  assert.equal(staleFarmer.reason, 'HARD_DELETED');

  // 2. Cloud doc with missing timestamp is also rejected when hard-deleted
  const untimestampedFarmer = shouldAcceptCloudItem({
    col: 'farmers',
    docId: 'f-old',
    incoming: {},
    localExisting: undefined,
    hardDeletedAtMap,
    categoryWipedAtMap
  });
  assert.equal(untimestampedFarmer.accept, false);
  assert.equal(untimestampedFarmer.reason, 'HARD_DELETED');

  // 3. Old inventory item before category wipe is rejected
  const oldInv = shouldAcceptCloudItem({
    col: 'inventory',
    docId: 'inv-1',
    incoming: { lastUpdated: '2026-05-11T23:59:59.000Z' },
    localExisting: undefined,
    hardDeletedAtMap,
    categoryWipedAtMap
  });
  assert.equal(oldInv.accept, false);
  assert.equal(oldInv.reason, 'WIPED');

  // 4. Fresh inventory item created AFTER category wipe is accepted
  const newInvAfterWipe = shouldAcceptCloudItem({
    col: 'inventory',
    docId: 'inv-2',
    incoming: { lastUpdated: '2026-05-12T09:00:00.000Z' },
    localExisting: undefined,
    hardDeletedAtMap,
    categoryWipedAtMap
  });
  assert.equal(newInvAfterWipe.accept, true);

  // 5. Re-created sequential prescription strictly AFTER hard-delete is accepted
  const recreatedRx = shouldAcceptCloudItem({
    col: 'prescriptions',
    docId: 'REC-2026-0001',
    incoming: { lastUpdated: '2026-05-11T10:00:00.000Z' },
    localExisting: undefined,
    hardDeletedAtMap,
    categoryWipedAtMap
  });
  assert.equal(recreatedRx.accept, true);
});

test('shouldAcceptCloudItem — preserves local soft-delete unless cloud has strictly newer restore', () => {
  const localSoftDeleted = {
    deletedAt: '2026-05-10T12:00:00.000Z',
    lastUpdated: '2026-05-10T12:00:00.000Z'
  };

  // Older active cloud record must NOT resurrect locally soft-deleted item
  const staleCloudActive = shouldAcceptCloudItem({
    col: 'expenses',
    docId: 'exp-1',
    incoming: { lastUpdated: '2026-05-10T11:00:00.000Z' },
    localExisting: localSoftDeleted,
    hardDeletedAtMap: {},
    categoryWipedAtMap: {}
  });
  assert.equal(staleCloudActive.accept, false);
  assert.equal(staleCloudActive.reason, 'LOCAL_SOFT_DELETE');

  // Strictly newer restore from another device is accepted
  const newerCloudRestore = shouldAcceptCloudItem({
    col: 'expenses',
    docId: 'exp-1',
    incoming: { lastUpdated: '2026-05-10T13:00:00.000Z' },
    localExisting: localSoftDeleted,
    hardDeletedAtMap: {},
    categoryWipedAtMap: {}
  });
  assert.equal(newerCloudRestore.accept, true);
});

test('classifyLocalMissingFromServer — never re-uploads synced items deleted from cloud', () => {
  // 1. Item already synced from cloud earlier, now absent from server -> deleted elsewhere -> DELETE_LOCAL
  assert.equal(
    classifyLocalMissingFromServer({
      col: 'farmers',
      localItem: { id: 'f-1', _syncedFromCloud: true, lastUpdated: '2026-05-10T10:00:00.000Z' },
      hasPendingOutbox: false,
      hardDeletedAtMap: {},
      categoryWipedAtMap: {}
    }),
    'DELETE_LOCAL'
  );

  // 2. Genuine offline-created item never synced to cloud -> UPLOAD
  assert.equal(
    classifyLocalMissingFromServer({
      col: 'farmers',
      localItem: { id: 'f-offline', _syncedFromCloud: false, lastUpdated: '2026-05-10T10:00:00.000Z' },
      hasPendingOutbox: true,
      hardDeletedAtMap: {},
      categoryWipedAtMap: {}
    }),
    'UPLOAD'
  );

  // 3. Offline item created BEFORE category wipe -> DELETE_LOCAL (wiped across account)
  assert.equal(
    classifyLocalMissingFromServer({
      col: 'inventory',
      localItem: { id: 'inv-offline-old', _syncedFromCloud: false, lastUpdated: '2026-05-10T09:00:00.000Z' },
      hasPendingOutbox: false,
      hardDeletedAtMap: {},
      categoryWipedAtMap: { inventory: '2026-05-10T12:00:00.000Z' }
    }),
    'DELETE_LOCAL'
  );
});

test('tombstone & category wipe storage helpers — record, read, and clear scopes cleanly', () => {
  const restoreStorage = installMockLocalStorage();
  try {
    const uid = 'user-test-123';
    recordHardDeletes(
      [
        { col: 'farmers', id: 'f1' },
        { col: 'inventory', id: 'i1' }
      ],
      '2026-05-15T10:00:00.000Z',
      uid
    );
    const map1 = readHardDeletedMap(uid);
    assert.equal(map1['farmers:f1'], '2026-05-15T10:00:00.000Z');
    assert.equal(map1['inventory:i1'], '2026-05-15T10:00:00.000Z');

    clearHardDeleteEntry('farmers', 'f1', uid);
    const map2 = readHardDeletedMap(uid);
    assert.equal('farmers:f1' in map2, false);
    assert.equal(map2['inventory:i1'], '2026-05-15T10:00:00.000Z');

    markCategoriesWiped(['farmers', 'inventory'], '2026-05-15T11:00:00.000Z', uid);
    // Older timestamp must not overwrite newer wipe timestamp
    markCategoriesWiped(['farmers'], '2026-05-14T11:00:00.000Z', uid);
    const wipes1 = readCategoryWipeMap(uid);
    assert.equal(wipes1.farmers, '2026-05-15T11:00:00.000Z');
    assert.equal(wipes1.inventory, '2026-05-15T11:00:00.000Z');

    clearCategoryWipes(['farmers'], uid);
    const wipes2 = readCategoryWipeMap(uid);
    assert.equal('farmers' in wipes2, false);
    assert.equal(wipes2.inventory, '2026-05-15T11:00:00.000Z');
  } finally {
    restoreStorage();
  }
});

test('mergeCloudHardDeletedMap — propagates cross-device tombstones and blocks offline resurrection', () => {
  const restoreStorage = installMockLocalStorage();
  try {
    const uid = 'uid-device-b';
    // Device B already had a local tombstone for farmer f-local
    recordHardDeletes([{ col: 'farmers', id: 'f-local' }], '2026-06-01T10:00:00.000Z', uid);

    // Cloud brings tombstones from Device A (including newer timestamp for f-local & new f-remote)
    const cloudMap = {
      'farmers:f-local': '2026-06-01T12:00:00.000Z',
      'farmers:f-remote': '2026-06-02T09:00:00.000Z',
      'inventory:inv-remote': '2026-06-02T09:05:00.000Z'
    };
    const mergedKeys = mergeCloudHardDeletedMap(cloudMap, uid);
    assert.deepEqual(
      mergedKeys.sort(),
      ['farmers:f-local', 'farmers:f-remote', 'inventory:inv-remote'].sort()
    );

    const localAfter = readHardDeletedMap(uid);
    assert.equal(localAfter['farmers:f-local'], '2026-06-01T12:00:00.000Z');
    assert.equal(localAfter['farmers:f-remote'], '2026-06-02T09:00:00.000Z');

    // Older cloud map entry must NOT downgrade newer local timestamp
    const downgradeKeys = mergeCloudHardDeletedMap(
      { 'farmers:f-local': '2026-05-30T00:00:00.000Z' },
      uid
    );
    assert.deepEqual(downgradeKeys, []);
    assert.equal(readHardDeletedMap(uid)['farmers:f-local'], '2026-06-01T12:00:00.000Z');

    // Device B has an unsynced / outbox-pending stale local copy of f-remote -> MUST be DELETE_LOCAL, never UPLOAD!
    const action = classifyLocalMissingFromServer({
      col: 'farmers',
      localItem: {
        id: 'f-remote',
        _syncedFromCloud: false,
        lastUpdated: '2026-06-02T08:00:00.000Z'
      },
      hasPendingOutbox: true,
      hardDeletedAtMap: localAfter,
      categoryWipedAtMap: {}
    });
    assert.equal(action, 'DELETE_LOCAL');

    // getCappedCloudHardDeletedMap retains entries sorted newest first up to cap
    const capped = getCappedCloudHardDeletedMap(uid, 2);
    assert.equal(Object.keys(capped).length, 2);
    assert.equal('inventory:inv-remote' in capped, true);
    assert.equal('farmers:f-remote' in capped, true);
  } finally {
    restoreStorage();
  }
});

test('shouldAcceptCloudItem — prioritizes HARD_DELETED/WIPED and newer cloud edits over stale outbox', () => {
  const hardDeletedAtMap = {
    'farmers:f-del': '2026-06-05T10:00:00.000Z'
  };
  const categoryWipedAtMap = {
    expenses: '2026-06-05T12:00:00.000Z'
  };

  // 1. Even with pendingOutbox=true, a hard-deleted doc must stay deleted
  const hdPending = shouldAcceptCloudItem({
    col: 'farmers',
    docId: 'f-del',
    incoming: { lastUpdated: '2026-06-05T09:00:00.000Z' },
    localExisting: { lastUpdated: '2026-06-05T09:30:00.000Z' },
    pendingOutbox: true,
    hardDeletedAtMap,
    categoryWipedAtMap
  });
  assert.equal(hdPending.accept, false);
  assert.equal(hdPending.reason, 'HARD_DELETED');

  // 2. Even with pendingOutbox=true, an item from before category wipe must be rejected as WIPED
  const wipedPending = shouldAcceptCloudItem({
    col: 'expenses',
    docId: 'exp-1',
    incoming: { lastUpdated: '2026-06-05T11:00:00.000Z' },
    localExisting: { lastUpdated: '2026-06-05T11:30:00.000Z' },
    pendingOutbox: true,
    hardDeletedAtMap,
    categoryWipedAtMap
  });
  assert.equal(wipedPending.accept, false);
  assert.equal(wipedPending.reason, 'WIPED');

  // 3. Strictly newer cloud edit beats older local item even if pendingOutbox=true
  const newerCloud = shouldAcceptCloudItem({
    col: 'farmers',
    docId: 'f-active',
    incoming: { lastUpdated: '2026-06-05T15:00:00.000Z' },
    localExisting: { lastUpdated: '2026-06-05T14:00:00.000Z' },
    pendingOutbox: true,
    hardDeletedAtMap,
    categoryWipedAtMap
  });
  assert.equal(newerCloud.accept, true);

  // 4. Older/equal cloud edit loses to local item when pendingOutbox=true
  const olderCloud = shouldAcceptCloudItem({
    col: 'farmers',
    docId: 'f-active',
    incoming: { lastUpdated: '2026-06-05T13:00:00.000Z' },
    localExisting: { lastUpdated: '2026-06-05T14:00:00.000Z' },
    pendingOutbox: true,
    hardDeletedAtMap,
    categoryWipedAtMap
  });
  assert.equal(olderCloud.accept, false);
  assert.equal(olderCloud.reason, 'PENDING_OUTBOX');
});

test('hydrateLocalStorageFromEdmDataDoc — hydrates all 4 scoped EDM keys and strips config password', () => {
  const restoreStorage = installMockLocalStorage();
  try {
    const uid = 'uid-edm-sync';
    const warehousePayload = [{ id: 'w1', productName: 'Koruma İlacı', efaturaStock: 10, bktsStock: 0, gtsStock: 0 }];
    const incomingPayload = [{ id: 'inc1', invoiceNo: 'ABC2026000001' }];
    const outgoingPayload = [{ id: 'out1', invoiceNo: 'MKS2026000001' }];
    const configPayload = { enabled: true, provider: 'VERIBAN', username: 'user1', password: 'secret-should-not-store' };

    hydrateLocalStorageFromEdmDataDoc({ id: 'mks_official_efatura_warehouse_v2', data: warehousePayload }, uid);
    hydrateLocalStorageFromEdmDataDoc({ id: 'mks_edm_incoming_invoices_v2', data: incomingPayload }, uid);
    hydrateLocalStorageFromEdmDataDoc({ id: 'mks_edm_outgoing_invoices_v2', data: outgoingPayload }, uid);
    hydrateLocalStorageFromEdmDataDoc({ id: 'mks_edm_config_v2', data: configPayload }, uid);

    assert.deepEqual(
      JSON.parse(localStorage.getItem(`mks_official_efatura_warehouse_v2_${uid}`) || '[]'),
      warehousePayload
    );
    assert.deepEqual(
      JSON.parse(localStorage.getItem(`mks_edm_incoming_invoices_v2_${uid}`) || '[]'),
      incomingPayload
    );
    assert.deepEqual(
      JSON.parse(localStorage.getItem(`mks_edm_outgoing_invoices_v2_${uid}`) || '[]'),
      outgoingPayload
    );
    const storedConfig = JSON.parse(localStorage.getItem(`mks_edm_config_v2_${uid}`) || '{}');
    assert.equal(storedConfig.provider, 'VERIBAN');
    assert.equal('password' in storedConfig, false);
  } finally {
    restoreStorage();
  }
});
