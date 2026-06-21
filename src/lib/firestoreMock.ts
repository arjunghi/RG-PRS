class MockQuery {
  collectionName: string;
  constraints: any[];
  constructor(collectionName: string, constraints: any[] = []) {
    this.collectionName = collectionName;
    this.constraints = constraints;
  }
}

class MockDocRef {
  collectionName: string;
  docId: string;
  constructor(collectionName: string, docId: string) {
    this.collectionName = collectionName;
    this.docId = docId;
  }
}

interface Listener {
  id: string;
  ref: MockQuery | MockDocRef;
  lastHash: string;
  callback: (snapshot: any) => void;
}

export function isDocMatch(item: any, docId: string): boolean {
  if (!item) return false;
  const dId = String(item.id || "").toLowerCase().trim();
  const dEmail = String(item.email || "").toLowerCase().trim();
  const dUid = String(item.uid || "").toLowerCase().trim();
  const target = String(docId || "").toLowerCase().trim();
  
  if (dId === target || dEmail === target || dUid === target) return true;
  
  const normId = dId.replace(/[^a-z0-9]/g, "_");
  const normEmail = dEmail.replace(/[^a-z0-9]/g, "_");
  const normUid = dUid.replace(/[^a-z0-9]/g, "_");
  const normTarget = target.replace(/[^a-z0-9]/g, "_");
  
  if (normId === normTarget || normEmail === normTarget || normUid === normTarget) return true;
  return false;
}

const activeListeners: Listener[] = [];
let pollInterval: any = null;
let cachedSyncData: any = null;

// Fetch and broadcast updates to all active listeners
async function fetchData() {
  try {
    const res = await fetch("/api/db/sync");
    if (!res.ok) throw new Error("Sync fetch failed");
    const data = await res.json();
    cachedSyncData = data;
    
    // Notify lists
    for (const listener of activeListeners) {
      try {
        const ref = listener.ref;
        let snap: any = null;

        if (ref instanceof MockDocRef) {
          const docData = ref.collectionName === "settings"
            ? data.settings?.[ref.docId]
            : data[ref.collectionName]?.find((d: any) => isDocMatch(d, ref.docId));
          
          const currentHash = JSON.stringify(docData || null);
          if (currentHash !== listener.lastHash) {
            listener.lastHash = currentHash;
            snap = {
              exists: () => !!docData,
              data: () => docData,
              id: ref.docId
            };
          }
        } else if (ref instanceof MockQuery) {
          const rawArray = data[ref.collectionName] || [];
          let array = Array.isArray(rawArray) ? [...rawArray] : [];
          
          for (const c of ref.constraints) {
            if (c.type === "where") {
              array = array.filter((item) => {
                const itemVal = item[c.field];
                const filterVal = c.value;
                if (c.op === "==" || c.op === "===") return String(itemVal) === String(filterVal);
                if (c.op === "!=") return String(itemVal) !== String(filterVal);
                if (c.op === "in") return Array.isArray(filterVal) && filterVal.includes(itemVal);
                return true;
              });
            } else if (c.type === "orderBy") {
              array.sort((a, b) => {
                const valA = a[c.field];
                const valB = b[c.field];
                if (valA === undefined || valB === undefined) return 0;
                if (typeof valA === "string") {
                  return c.dir === "desc" ? valB.localeCompare(valA) : valA.localeCompare(valB);
                }
                return c.dir === "desc" ? valB - valA : valA - valB;
              });
            } else if (c.type === "limit") {
              array = array.slice(0, c.num);
            }
          }

          const currentHash = JSON.stringify(array);
          if (currentHash !== listener.lastHash) {
            listener.lastHash = currentHash;
            const docArray = array.map((item) => ({
              id: item.id || item.uid || item.email,
              data: () => item,
              exists: () => true
            }));
            snap = {
              docs: docArray,
              size: docArray.length,
              empty: docArray.length === 0,
              forEach: (callbackFn: any) => docArray.forEach(callbackFn)
            };
          }
        }

        if (snap) {
          listener.callback(snap);
        }
      } catch (err) {
        console.error("Failed to run mock snapshot listener callback:", err);
      }
    }
  } catch (err) {
    console.warn("Real-time sync polling server error:", err);
  }
}

function startGlobalPoll() {
  if (pollInterval) return;
  fetchData();
  pollInterval = setInterval(fetchData, 3000);
}

function stopGlobalPoll() {
  if (activeListeners.length === 0 && pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

export function collection(db: any, name: string) {
  return new MockQuery(name);
}

export function doc(first: any, second?: string, ...rest: string[]) {
  if (!second) {
    const collectionName = first.collectionName || String(first);
    const randomId = "doc_" + Math.random().toString(36).substring(2, 12);
    return new MockDocRef(collectionName, randomId);
  }
  
  let collectionName = "";
  let docId = "";
  if (first && first.collectionName) {
    collectionName = first.collectionName;
    docId = second;
  } else {
    if (rest.length > 0) {
      collectionName = second;
      docId = rest[0];
    } else if (second.includes("/")) {
      const parts = second.split("/");
      collectionName = parts[0];
      docId = parts[1];
    } else {
      collectionName = second;
      docId = "default";
    }
  }
  return new MockDocRef(collectionName, docId);
}

export function query(ref: any, ...constraints: any[]) {
  const collectionName = ref.collectionName || ref;
  const existingConstraints = ref.constraints || [];
  return new MockQuery(collectionName, [...existingConstraints, ...constraints]);
}

export function where(field: string, op: string, value: any) {
  return { type: "where", field, op, value };
}

export function orderBy(field: string, dir: "asc" | "desc" = "asc") {
  return { type: "orderBy", field, dir };
}

export function limit(num: number) {
  return { type: "limit", num };
}

export function onSnapshot(ref: any, callback: (snap: any) => void, onError?: (err: any) => void) {
  const listener: Listener = {
    id: Math.random().toString(36).substring(2, 12) + "_" + Date.now(),
    ref,
    lastHash: "",
    callback
  };

  activeListeners.push(listener);
  startGlobalPoll();

  // If we already have cached sync data, satisfy the callback instantly so user sees immediate load
  if (cachedSyncData) {
    setTimeout(() => {
      try {
        let snap: any = null;
        if (ref instanceof MockDocRef) {
          const docData = ref.collectionName === "settings"
            ? cachedSyncData.settings?.[ref.docId]
            : cachedSyncData[ref.collectionName]?.find((d: any) => isDocMatch(d, ref.docId));
          
          listener.lastHash = JSON.stringify(docData || null);
          snap = {
            exists: () => !!docData,
            data: () => docData,
            id: ref.docId
          };
        } else if (ref instanceof MockQuery) {
          const rawArray = cachedSyncData[ref.collectionName] || [];
          let array = Array.isArray(rawArray) ? [...rawArray] : [];
          
          for (const c of ref.constraints) {
            if (c.type === "where") {
              array = array.filter((item) => {
                const itemVal = item[c.field];
                const filterVal = c.value;
                if (c.op === "==" || c.op === "===") return String(itemVal) === String(filterVal);
                if (c.op === "!=") return String(itemVal) !== String(filterVal);
                if (c.op === "in") return Array.isArray(filterVal) && filterVal.includes(itemVal);
                return true;
              });
            } else if (c.type === "orderBy") {
              array.sort((a, b) => {
                const valA = a[c.field];
                const valB = b[c.field];
                if (valA === undefined || valB === undefined) return 0;
                if (typeof valA === "string") {
                  return c.dir === "desc" ? valB.localeCompare(valA) : valA.localeCompare(valB);
                }
                return c.dir === "desc" ? valB - valA : valA - valB;
              });
            } else if (c.type === "limit") {
              array = array.slice(0, c.num);
            }
          }
          listener.lastHash = JSON.stringify(array);
          const docArray = array.map((item) => ({
            id: item.id || item.uid || item.email,
            data: () => item,
            exists: () => true
          }));
          snap = {
            docs: docArray,
            size: docArray.length,
            empty: docArray.length === 0,
            forEach: (callbackFn: any) => docArray.forEach(callbackFn)
          };
        }
        if (snap) callback(snap);
      } catch (err) {
        console.error("Initial mock load error:", err);
      }
    }, 50);
  }

  // Unsubscribe function
  return () => {
    const idx = activeListeners.findIndex((l) => l.id === listener.id);
    if (idx !== -1) {
      activeListeners.splice(idx, 1);
    }
    stopGlobalPoll();
  };
}

export async function addDoc(collectionRef: any, data: any) {
  const collectionName = collectionRef.collectionName || collectionRef;
  const res = await fetch(`/api/db/${collectionName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Failed to add doc to ${collectionName}`);
  const result = await res.json();
  fetchData(); // Trigger immediate update callback in view
  return { id: result.id };
}

export async function setDoc(docRef: any, data: any, options?: any) {
  const collectionName = docRef.collectionName;
  const docId = docRef.docId;
  const merge = options?.merge !== false;
  const res = await fetch(`/api/db/${collectionName}/${docId}/set?merge=${merge}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Failed to set doc on ${collectionName}/${docId}`);
  fetchData();
  return true;
}

export async function updateDoc(docRef: any, data: any) {
  const collectionName = docRef.collectionName;
  const docId = docRef.docId;
  const res = await fetch(`/api/db/${collectionName}/${docId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Failed to update doc ${collectionName}/${docId}`);
  fetchData();
  return true;
}

export async function deleteDoc(docRef: any) {
  const collectionName = docRef.collectionName;
  const docId = docRef.docId;
  const res = await fetch(`/api/db/${collectionName}/${docId}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error(`Failed to delete doc ${collectionName}/${docId}`);
  fetchData();
  return true;
}

export async function getDoc(docRef: any) {
  const collectionName = docRef.collectionName;
  const docId = docRef.docId;
  const res = await fetch(`/api/db/${collectionName}/${docId}`);
  const data = res.ok ? await res.json() : null;
  return {
    exists: () => !!data,
    data: () => data,
    id: docId
  };
}

export async function getDocs(queryRef: any) {
  const collectionName = queryRef.collectionName || queryRef;
  const res = await fetch(`/api/db/${collectionName}`);
  const rawArray = res.ok ? await res.json() : [];
  
  let array = Array.isArray(rawArray) ? [...rawArray] : [];
  const constraints = queryRef.constraints || [];
  for (const c of constraints) {
    if (c.type === "where") {
      array = array.filter((item) => {
        const itemVal = item[c.field];
        const filterVal = c.value;
        if (c.op === "==" || c.op === "===") return String(itemVal) === String(filterVal);
        if (c.op === "!=") return String(itemVal) !== String(filterVal);
        if (c.op === "in") return Array.isArray(filterVal) && filterVal.includes(itemVal);
        return true;
      });
    }
  }
  
  const docArray = array.map((item) => ({
    id: item.id || item.uid || item.email,
    data: () => item,
    exists: () => true
  }));

  return {
    empty: docArray.length === 0,
    size: docArray.length,
    docs: docArray,
    forEach: (callbackFn: any) => docArray.forEach(callbackFn)
  };
}

class MockWriteBatch {
  operations: any[] = [];
  set(docRef: any, data: any, options?: any) {
    this.operations.push({
      type: "set",
      collection: docRef.collectionName,
      id: docRef.docId,
      data
    });
  }
  update(docRef: any, data: any) {
    this.operations.push({
      type: "update",
      collection: docRef.collectionName,
      id: docRef.docId,
      data
    });
  }
  delete(docRef: any) {
    this.operations.push({
      type: "delete",
      collection: docRef.collectionName,
      id: docRef.docId
    });
  }
  async commit() {
    const res = await fetch("/api/db/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operations: this.operations })
    });
    if (!res.ok) throw new Error("Batch commit failed");
    await fetchData();
    return true;
  }
}

export function writeBatch(db: any) {
  return new MockWriteBatch();
}

export function getFirestore(app?: any) {
  return {};
}

export function initializeFirestore(app?: any, config?: any) {
  return {};
}

export function memoryLocalCache() {
  return {};
}

export function serverTimestamp() {
  return new Date().toISOString();
}

