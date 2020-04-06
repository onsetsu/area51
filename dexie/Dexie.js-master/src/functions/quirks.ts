import { maxString } from '../globals/constants';

export function safariMultiStoreFix(storeNames: string[]) {
  return storeNames.length === 1 ? storeNames[0] : storeNames;
}

export function getNativeGetDatabaseNamesFn(indexedDB) {
  var fn = indexedDB && (indexedDB.getDatabaseNames || indexedDB.webkitGetDatabaseNames);
  return fn && fn.bind(indexedDB);
}

export function getMaxKey (IdbKeyRange: typeof IDBKeyRange) {
  try {
    IdbKeyRange.only([[]]);
    return [[]];
  } catch (e) {
    return maxString;
  }
}
