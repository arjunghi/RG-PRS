export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  authStr?: any
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: authStr?.currentUser?.uid,
      email: authStr?.currentUser?.email,
      emailVerified: authStr?.currentUser?.emailVerified,
      isAnonymous: authStr?.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  alert(`Database Operation Failed (${operationType}): ${errInfo.error}\nPlease check your network connection or permissions.`);
  // throw new Error(JSON.stringify(errInfo)); // Removing throw so it doesn't leave uncaught promise
}
